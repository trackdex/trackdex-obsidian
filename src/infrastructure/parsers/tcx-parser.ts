import type { ParseTrackInput, TrackParserPort } from "application/ports/parser-port";
import type { Bbox } from "domain/shared/geo";
import { domainError } from "domain/shared/errors";
import { err, ok, type Result } from "domain/shared/result";
import type {
	ParsedTrack,
	ParsedTrackPoint,
} from "domain/track/parsed-track";
import type { TrackSegment } from "domain/track/track-segment";

/** Garmin TCX Training Center Database v2 namespace. */
export const TCX_NAMESPACE =
	"http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2";

/** Garmin Activity Extensions v2 (TPX: speed, watts). */
export const TPX_NAMESPACE =
	"http://www.garmin.com/xmlschemas/ActivityExtension/v2";

export function createTcxParserPort(): TrackParserPort {
	return {
		parse: async (input: ParseTrackInput) => {
			const xml = new TextDecoder("utf-8", { fatal: false }).decode(
				input.content,
			);
			return parseTcxToParsedTrack(xml);
		},
	};
}

export function parseTcxToParsedTrack(
	xml: string,
): Result<ParsedTrack, ReturnType<typeof domainError>> {
	const trimmed = xml.trim();
	if (!trimmed) {
		return err(domainError("parse_failed", "TCX file is empty."));
	}

	let doc: Document;
	try {
		doc = new DOMParser().parseFromString(trimmed, "application/xml");
	} catch {
		return err(domainError("parse_failed", "Could not parse TCX."));
	}

	if (hasXmlParserError(doc)) {
		return err(domainError("parse_failed", "Could not parse TCX."));
	}

	const activity = findFirstByLocalName(doc, "Activity");
	if (!activity) {
		return err(domainError("parse_failed", "No activity in this TCX."));
	}

	const sportRaw = readAttribute(activity, "Sport");
	const titleFromFile = readChildText(activity, "Name");
	const activityId = readChildText(activity, "Id");

	const points: ParsedTrackPoint[] = [];
	const segments: TrackSegment[] = [];
	const laps = findAllByLocalName(activity, "Lap");

	for (let lapIndex = 0; lapIndex < laps.length; lapIndex++) {
		const lap = laps[lapIndex]!;
		const lapPoints = extractTrackpointsFromLap(lap);
		const lapStartedAtRaw =
			readAttribute(lap, "StartTime") ??
			lapPoints[0]?.timestampRaw ??
			null;
		const lapEndedAtRaw =
			lapPoints.length > 0
				? (lapPoints[lapPoints.length - 1]?.timestampRaw ?? null)
				: null;

		points.push(...lapPoints);

		segments.push({
			id: `lap-${String(lapIndex + 1)}`,
			name: readChildText(lap, "Name"),
			startedAtRaw: lapStartedAtRaw,
			endedAtRaw: lapEndedAtRaw,
			pointCount: lapPoints.length > 0 ? lapPoints.length : null,
			bbox: computeBbox(lapPoints),
		});
	}

	if (points.length === 0) {
		return err(domainError("parse_failed", "No track points in this TCX."));
	}

	const startedAtRaw =
		points[0]?.timestampRaw ?? activityId ?? segments[0]?.startedAtRaw ?? null;
	const endedAtRaw =
		points[points.length - 1]?.timestampRaw ??
		segments[segments.length - 1]?.endedAtRaw ??
		null;

	return ok({
		titleFromFile,
		sportRaw,
		startedAtRaw,
		endedAtRaw,
		points,
		segments,
		bbox: computeBbox(points),
	});
}

/** Exported for unit tests with an injected Document. */
export function extractTrackpointsFromDocument(doc: Document): ParsedTrackPoint[] {
	const points: ParsedTrackPoint[] = [];
	for (const lap of findAllByLocalName(doc, "Lap")) {
		points.push(...extractTrackpointsFromLap(lap));
	}
	return points;
}

function extractTrackpointsFromLap(lap: Element): ParsedTrackPoint[] {
	const points: ParsedTrackPoint[] = [];
	for (const tp of findAllByLocalName(lap, "Trackpoint")) {
		const point = parseTrackpoint(tp);
		if (point !== null) {
			points.push(point);
		}
	}
	return points;
}

function parseTrackpoint(tp: Element): ParsedTrackPoint | null {
	const position = findFirstByLocalName(tp, "Position");
	if (!position) {
		return null;
	}

	const lat = parseCoordinate(readChildText(position, "LatitudeDegrees"));
	const lon = parseCoordinate(readChildText(position, "LongitudeDegrees"));
	if (lat === null || lon === null || !isValidCoordinate(lat, lon)) {
		return null;
	}

	const hrEl = findFirstByLocalName(tp, "HeartRateBpm");
	const hrBpm = parseOptionalNumber(
		hrEl ? readChildText(hrEl, "Value") : null,
	);

	return {
		lat,
		lon,
		elevationM: parseOptionalNumber(readChildText(tp, "AltitudeMeters")),
		timestampRaw: readChildText(tp, "Time"),
		hrBpm,
		powerW: readTpxNumber(tp, "Watts"),
		cadenceRpm: parseOptionalNumber(readChildText(tp, "Cadence")),
		speedMps: readTpxNumber(tp, "Speed"),
	};
}

function readTpxNumber(tp: Element, localName: string): number | null {
	const extensions = findFirstByLocalName(tp, "Extensions");
	if (!extensions) {
		return null;
	}
	const tpx =
		extensions.getElementsByTagNameNS(TPX_NAMESPACE, "TPX").item(0) ??
		findFirstByLocalName(extensions, "TPX");
	if (!tpx) {
		return null;
	}
	return parseOptionalNumber(readChildText(tpx, localName));
}

function hasXmlParserError(doc: Document): boolean {
	return doc.getElementsByTagName("parsererror").length > 0;
}

function findFirstByLocalName(root: ParentNode, localName: string): Element | null {
	for (const el of findAllByLocalName(root, localName)) {
		return el;
	}
	return null;
}

function isXmlDocument(root: ParentNode): root is Document {
	return root.nodeType === 9;
}

function findAllByLocalName(root: ParentNode, localName: string): Element[] {
	const out: Element[] = [];
	const seen = new Set<Element>();

	const fromNs = isXmlDocument(root)
		? root.getElementsByTagNameNS(TCX_NAMESPACE, localName)
		: (root as Element).getElementsByTagNameNS(TCX_NAMESPACE, localName);
	for (let i = 0; i < fromNs.length; i++) {
		const el = fromNs.item(i);
		if (el && !seen.has(el)) {
			seen.add(el);
			out.push(el);
		}
	}

	if (out.length > 0) {
		return out;
	}

	const byTag = isXmlDocument(root)
		? root.getElementsByTagName(localName)
		: (root as Element).getElementsByTagName(localName);
	for (let i = 0; i < byTag.length; i++) {
		const el = byTag.item(i);
		if (el && !seen.has(el)) {
			seen.add(el);
			out.push(el);
		}
	}

	if (out.length > 0) {
		return out;
	}

	const all = isXmlDocument(root)
		? root.getElementsByTagName("*")
		: (root as Element).getElementsByTagName("*");
	for (let i = 0; i < all.length; i++) {
		const el = all.item(i);
		if (el && el.localName === localName && !seen.has(el)) {
			seen.add(el);
			out.push(el);
		}
	}

	return out;
}

function readChildText(parent: Element, localName: string): string | null {
	const child = findFirstByLocalName(parent, localName);
	if (!child) {
		return null;
	}
	const text = child.textContent?.trim();
	return text && text.length > 0 ? text : null;
}

function readAttribute(el: Element, name: string): string | null {
	const value = el.getAttribute(name)?.trim();
	return value && value.length > 0 ? value : null;
}

function parseCoordinate(value: string | null): number | null {
	if (value === null) {
		return null;
	}
	const n = Number.parseFloat(value);
	return Number.isFinite(n) ? n : null;
}

function parseOptionalNumber(value: string | null): number | null {
	if (value === null) {
		return null;
	}
	const n = Number.parseFloat(value);
	return Number.isFinite(n) ? n : null;
}

/** Validates a parsed lat/lng pair (exported for tests). */
export function isValidCoordinate(lat: number, lon: number): boolean {
	return lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
}

function computeBbox(points: readonly ParsedTrackPoint[]): Bbox | null {
	if (points.length === 0) {
		return null;
	}
	let south = points[0]!.lat;
	let north = points[0]!.lat;
	let west = points[0]!.lon;
	let east = points[0]!.lon;
	for (const p of points) {
		south = Math.min(south, p.lat);
		north = Math.max(north, p.lat);
		west = Math.min(west, p.lon);
		east = Math.max(east, p.lon);
	}
	return { south, west, north, east };
}
