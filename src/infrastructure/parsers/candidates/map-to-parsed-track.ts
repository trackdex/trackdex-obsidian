import type { Bbox } from "../../../domain/shared/geo";
import type {
	ParsedTrack,
	ParsedTrackPoint,
} from "../../../domain/track/parsed-track";
import type { TrackSegment } from "../../../domain/track/track-segment";

const SEMICIRCLE_TO_DEG = 180 / 2 ** 31;

function semicirclesToDegrees(value: number | undefined): number | null {
	if (value === undefined || value === null || Number.isNaN(value)) {
		return null;
	}
	return value * SEMICIRCLE_TO_DEG;
}

function toIsoString(value: unknown): string | null {
	if (value instanceof Date) {
		return value.toISOString();
	}
	if (typeof value === "string" && value.length > 0) {
		return value;
	}
	return null;
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

/** Map fit-file-parser output (mode both) into {@link ParsedTrack}. */
export function mapFitFileParserToParsedTrack(parsed: {
	records?: readonly { [key: string]: unknown }[];
	sessions?: readonly { [key: string]: unknown }[];
	laps?: readonly { [key: string]: unknown }[];
}): ParsedTrack {
	const points: ParsedTrackPoint[] = [];
	for (const record of parsed.records ?? []) {
		const lat = record["position_lat"];
		const lon = record["position_long"];
		if (typeof lat !== "number" || typeof lon !== "number") {
			continue;
		}
		points.push({
			lat,
			lon,
			elevationM:
				typeof record["altitude"] === "number" ? record["altitude"] : null,
			timestampRaw: toIsoString(record["timestamp"]),
			hrBpm: typeof record["heart_rate"] === "number" ? record["heart_rate"] : null,
			powerW: typeof record["power"] === "number" ? record["power"] : null,
			cadenceRpm:
				typeof record["cadence"] === "number" ? record["cadence"] : null,
			speedMps: typeof record["speed"] === "number" ? record["speed"] : null,
		});
	}

	const session = parsed.sessions?.[0];
	const segments: TrackSegment[] = (parsed.laps ?? []).map((lap, index) => ({
		id: `lap-${String(index + 1)}`,
		name: typeof lap["wkt_step_name"] === "string" ? lap["wkt_step_name"] : null,
		startedAtRaw: toIsoString(lap["start_time"]),
		endedAtRaw: toIsoString(lap["timestamp"]),
		pointCount:
			typeof lap["total_cycles"] === "number" ? lap["total_cycles"] : null,
		bbox: null,
	}));

	const sportRaw =
		typeof session?.["sport"] === "string" ? session["sport"] : null;

	return {
		titleFromFile: null,
		sportRaw,
		startedAtRaw: toIsoString(session?.["start_time"]),
		endedAtRaw: toIsoString(session?.["timestamp"]),
		points,
		segments,
		bbox: computeBbox(points),
	};
}

/** Map Garmin FIT SDK decoder messages into {@link ParsedTrack}. */
export function mapGarminSdkToParsedTrack(messages: {
	recordMesgs?: readonly Record<string, unknown>[];
	sessionMesgs?: readonly Record<string, unknown>[];
	lapMesgs?: readonly Record<string, unknown>[];
}): ParsedTrack {
	const points: ParsedTrackPoint[] = [];
	for (const record of messages.recordMesgs ?? []) {
		const lat = semicirclesToDegrees(record["positionLat"] as number | undefined);
		const lon = semicirclesToDegrees(
			record["positionLong"] as number | undefined,
		);
		if (lat === null || lon === null) {
			continue;
		}
		const timestamp = record["timestamp"];
		points.push({
			lat,
			lon,
			elevationM:
				typeof record["altitude"] === "number" ? record["altitude"] : null,
			timestampRaw: toIsoString(timestamp),
			hrBpm:
				typeof record["heartRate"] === "number" ? record["heartRate"] : null,
			powerW: typeof record["power"] === "number" ? record["power"] : null,
			cadenceRpm:
				typeof record["cadence"] === "number" ? record["cadence"] : null,
			speedMps: typeof record["speed"] === "number" ? record["speed"] : null,
		});
	}

	const session = messages.sessionMesgs?.[0];
	const sportEnum = session?.["sport"];
	const sportRaw = typeof sportEnum === "string" ? sportEnum : null;

	const segments: TrackSegment[] = (messages.lapMesgs ?? []).map(
		(lap, index) => ({
			id: `lap-${String(index + 1)}`,
			name: null,
			startedAtRaw: toIsoString(lap["startTime"]),
			endedAtRaw: toIsoString(lap["timestamp"]),
			pointCount: null,
			bbox: null,
		}),
	);

	return {
		titleFromFile: null,
		sportRaw,
		startedAtRaw: toIsoString(session?.["startTime"]),
		endedAtRaw: toIsoString(session?.["timestamp"]),
		points,
		segments,
		bbox: computeBbox(points),
	};
}

export function summarizeParsedTrack(track: ParsedTrack): {
	pointCount: number;
	segmentCount: number;
	hasHr: boolean;
	hasPower: boolean;
	hasCadence: boolean;
} {
	let hasHr = false;
	let hasPower = false;
	let hasCadence = false;
	for (const p of track.points) {
		if (p.hrBpm !== null) {
			hasHr = true;
		}
		if (p.powerW !== null) {
			hasPower = true;
		}
		if (p.cadenceRpm !== null) {
			hasCadence = true;
		}
	}
	return {
		pointCount: track.points.length,
		segmentCount: track.segments.length,
		hasHr,
		hasPower,
		hasCadence,
	};
}
