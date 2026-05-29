import type { Bbox } from "../../../domain/shared/geo";
import type {
	ParsedTrack,
	ParsedTrackPoint,
} from "../../../domain/track/parsed-track";
import type { TrackSegment } from "../../../domain/track/track-segment";

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

