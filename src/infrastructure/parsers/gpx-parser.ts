import type { TrackParserPort } from "application/ports/parser-port";
import type { Bbox } from "domain/shared/geo";
import { domainError } from "domain/shared/errors";
import { err, ok } from "domain/shared/result";
import type {
	ParsedTrack,
	ParsedTrackPoint,
} from "domain/track/parsed-track";
import type { TrackSegment } from "domain/track/track-segment";

/** GPX 1.1 default namespace (Topografix). */
export const GPX_11_NAMESPACE = "http://www.topografix.com/GPX/1/1";

export type GpxLatLng = [lat: number, lng: number];

export type ParseGpxTrackResult =
	| { ok: true; points: GpxLatLng[] }
	| { ok: false; message: string };

export function parseGpxTrackPoints(xml: string): ParseGpxTrackResult {
	const trimmed = xml.trim();
	if (!trimmed) {
		return { ok: false, message: "GPX file is empty." };
	}

	let doc: Document;
	try {
		doc = new DOMParser().parseFromString(trimmed, "application/xml");
	} catch {
		return { ok: false, message: "Could not parse GPX." };
	}

	if (hasXmlParserError(doc)) {
		return { ok: false, message: "Could not parse GPX." };
	}

	const points = extractTrkptsFromDocument(doc);
	if (points.length === 0) {
		return { ok: false, message: "No track points in this GPX." };
	}

	return { ok: true, points };
}

/** Exported for unit tests with an injected Document. */
export function extractTrkptsFromDocument(doc: Document): GpxLatLng[] {
	const points: GpxLatLng[] = [];
	const seen = new Set<Element>();

	const fromNs = doc.getElementsByTagNameNS(GPX_11_NAMESPACE, "trkpt");
	for (let i = 0; i < fromNs.length; i++) {
		const el = fromNs.item(i);
		if (el && !seen.has(el)) {
			seen.add(el);
			pushTrkpt(el, points);
		}
	}

	if (points.length > 0) {
		return points;
	}

	const byTag = doc.getElementsByTagName("trkpt");
	for (let i = 0; i < byTag.length; i++) {
		const el = byTag.item(i);
		if (el && !seen.has(el)) {
			seen.add(el);
			pushTrkpt(el, points);
		}
	}

	if (points.length > 0) {
		return points;
	}

	const all = doc.getElementsByTagName("*");
	for (let i = 0; i < all.length; i++) {
		const el = all.item(i);
		if (el && el.localName === "trkpt" && !seen.has(el)) {
			seen.add(el);
			pushTrkpt(el, points);
		}
	}

	return points;
}

/** Maps GPX XML into the unified intermediate {@link ParsedTrack} model. */
export function parseGpxDocumentToParsedTrack(doc: Document): ParsedTrack {
	const points: ParsedTrackPoint[] = [];
	const segments: TrackSegment[] = [];
	let segmentIndex = 0;

	for (const trk of findAllByLocalName(doc, "trk")) {
		const trksegs = findAllByLocalName(trk, "trkseg");
		if (trksegs.length > 0) {
			for (const trkseg of trksegs) {
				segmentIndex += 1;
				appendSegmentPoints(trkseg, segmentIndex, points, segments);
			}
			continue;
		}
		segmentIndex += 1;
		appendSegmentPoints(trk, segmentIndex, points, segments);
	}

	const titleFromFile =
		readTrackField(doc, "name") ?? readMetadataField(doc, "name");
	const sportRaw = readTrackField(doc, "type");
	const startedAtRaw = firstNonNullTimestamp(points);
	const endedAtRaw = lastNonNullTimestamp(points);

	return {
		titleFromFile,
		sportRaw,
		startedAtRaw,
		endedAtRaw,
		points,
		segments,
		bbox: computeBbox(points),
	};
}

/** {@link TrackParserPort} adapter for GPX track files. */
export function createGpxParserPort(): TrackParserPort {
	return {
		parse: async (input) => {
			const xml = decodeTrackContent(input.content);
			const trimmed = xml.trim();
			if (!trimmed) {
				return err(domainError("parse_failed", "GPX file is empty."));
			}

			let doc: Document;
			try {
				doc = new DOMParser().parseFromString(trimmed, "application/xml");
			} catch (cause) {
				return err(
					domainError("parse_failed", "Could not parse GPX.", cause),
				);
			}

			if (hasXmlParserError(doc)) {
				return err(domainError("parse_failed", "Could not parse GPX."));
			}

			const track = parseGpxDocumentToParsedTrack(doc);
			if (track.points.length === 0) {
				return err(
					domainError("parse_failed", "No track points in this GPX."),
				);
			}

			return ok(track);
		},
	};
}

function decodeTrackContent(content: Uint8Array): string {
	return new TextDecoder("utf-8", { fatal: false }).decode(content);
}

function hasXmlParserError(doc: Document): boolean {
	const errors = doc.getElementsByTagName("parsererror");
	return errors.length > 0;
}

function pushTrkpt(el: Element, points: GpxLatLng[]): void {
	const lat = parseCoordinate(el.getAttribute("lat"));
	const lng = parseCoordinate(el.getAttribute("lon"));
	if (lat === null || lng === null || !isValidGpxCoordinate(lat, lng)) {
		return;
	}
	points.push([lat, lng]);
}

function parseTrkptElement(el: Element): ParsedTrackPoint | null {
	const lat = parseCoordinate(el.getAttribute("lat"));
	const lon = parseCoordinate(el.getAttribute("lon"));
	if (lat === null || lon === null || !isValidGpxCoordinate(lat, lon)) {
		return null;
	}

	return {
		lat,
		lon,
		elevationM: readChildNumber(el, "ele"),
		timestampRaw: readChildText(el, "time"),
		hrBpm: readExtensionNumber(el, ["hr", "heartrate"]),
		powerW: readExtensionNumber(el, ["power", "watts"]),
		cadenceRpm: readExtensionNumber(el, ["cad", "cadence"]),
		speedMps: readExtensionNumber(el, ["speed", "velocity"]),
	};
}

function appendSegmentPoints(
	container: Element,
	segmentIndex: number,
	points: ParsedTrackPoint[],
	segments: TrackSegment[],
): void {
	const segmentPoints: ParsedTrackPoint[] = [];
	for (const trkpt of findAllByLocalName(container, "trkpt")) {
		const point = parseTrkptElement(trkpt);
		if (point === null) {
			continue;
		}
		segmentPoints.push(point);
		points.push(point);
	}
	if (segmentPoints.length > 0) {
		segments.push(buildSegment(segmentIndex, segmentPoints));
	}
}

function buildSegment(
	index: number,
	segmentPoints: readonly ParsedTrackPoint[],
): TrackSegment {
	return {
		id: `seg-${String(index)}`,
		name: null,
		startedAtRaw: firstNonNullTimestamp(segmentPoints),
		endedAtRaw: lastNonNullTimestamp(segmentPoints),
		pointCount: segmentPoints.length,
		bbox: computeBbox(segmentPoints),
	};
}

function computeBbox(points: readonly ParsedTrackPoint[]): Bbox | null {
	if (points.length === 0) {
		return null;
	}
	let south = points[0]!.lat;
	let north = points[0]!.lat;
	let west = points[0]!.lon;
	let east = points[0]!.lon;
	for (const point of points) {
		south = Math.min(south, point.lat);
		north = Math.max(north, point.lat);
		west = Math.min(west, point.lon);
		east = Math.max(east, point.lon);
	}
	return { south, west, north, east };
}

function isXmlDocument(root: ParentNode): root is Document {
	return root.nodeType === 9;
}

function findAllByLocalName(root: ParentNode, localName: string): Element[] {
	const out: Element[] = [];
	const seen = new Set<Element>();

	const fromNs = isXmlDocument(root)
		? root.getElementsByTagNameNS(GPX_11_NAMESPACE, localName)
		: (root as Element).getElementsByTagNameNS(GPX_11_NAMESPACE, localName);
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

function readTrackField(doc: Document, localName: string): string | null {
	for (const trk of findAllByLocalName(doc, "trk")) {
		const value = readChildText(trk, localName);
		if (value !== null) {
			return value;
		}
	}
	return null;
}

function readMetadataField(doc: Document, localName: string): string | null {
	for (const metadata of findAllByLocalName(doc, "metadata")) {
		const value = readChildText(metadata, localName);
		if (value !== null) {
			return value;
		}
	}
	return null;
}

function readChildText(parent: Element, localName: string): string | null {
	const child = findFirstByLocalName(parent, localName);
	if (child === null) {
		return null;
	}
	const text = child.textContent?.trim();
	return text && text.length > 0 ? text : null;
}

function findFirstByLocalName(root: ParentNode, localName: string): Element | null {
	for (const el of findAllByLocalName(root, localName)) {
		return el;
	}
	return null;
}

function readChildNumber(parent: Element, localName: string): number | null {
	const text = readChildText(parent, localName);
	if (text === null) {
		return null;
	}
	const value = Number.parseFloat(text);
	return Number.isFinite(value) ? value : null;
}

function readExtensionNumber(
	trkpt: Element,
	localNames: readonly string[],
): number | null {
	const extensions = findFirstByLocalName(trkpt, "extensions");
	if (extensions === null) {
		return null;
	}
	for (const localName of localNames) {
		const value = readDescendantNumber(extensions, localName);
		if (value !== null) {
			return value;
		}
	}
	return null;
}

function readDescendantNumber(root: Element, localName: string): number | null {
	const all = root.getElementsByTagName("*");
	for (let i = 0; i < all.length; i++) {
		const el = all.item(i);
		if (el && el.localName === localName) {
			const text = el.textContent?.trim();
			if (!text) {
				continue;
			}
			const value = Number.parseFloat(text);
			if (Number.isFinite(value)) {
				return value;
			}
		}
	}
	return null;
}

function firstNonNullTimestamp(
	points: readonly ParsedTrackPoint[],
): string | null {
	for (const point of points) {
		if (point.timestampRaw !== null) {
			return point.timestampRaw;
		}
	}
	return null;
}

function lastNonNullTimestamp(
	points: readonly ParsedTrackPoint[],
): string | null {
	for (let i = points.length - 1; i >= 0; i -= 1) {
		const timestamp = points[i]?.timestampRaw ?? null;
		if (timestamp !== null) {
			return timestamp;
		}
	}
	return null;
}

function parseCoordinate(value: string | null): number | null {
	if (value === null || value === "") {
		return null;
	}
	const n = Number.parseFloat(value);
	if (!Number.isFinite(n)) {
		return null;
	}
	return n;
}

/** Validates a parsed lat/lng pair (exported for tests). */
export function isValidGpxCoordinate(lat: number, lng: number): boolean {
	return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}
