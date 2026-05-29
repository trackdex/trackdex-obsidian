import type { Bbox } from "domain/shared/geo";
import type { TrackSegment } from "domain/track/track-segment";

/** Supported track file extensions (case-insensitive at discovery). */
export type TrackFileExtension = "gpx" | "tcx" | "fit" | "fit.gz";

export const TRACK_FILE_EXTENSIONS: readonly TrackFileExtension[] = [
	"gpx",
	"tcx",
	"fit",
	"fit.gz",
] as const;

/** Single parsed sample before domain metric computation. */
export interface ParsedTrackPoint {
	readonly lat: number;
	readonly lon: number;
	readonly elevationM: number | null;
	/** Raw timestamp string from the file when present. */
	readonly timestampRaw: string | null;
	readonly hrBpm: number | null;
	readonly powerW: number | null;
	readonly cadenceRpm: number | null;
	readonly speedMps: number | null;
}

/**
 * Normalized intermediate model from {@link TrackParserPort}.
 * Domain services compute persisted metrics from this shape (§7.4 step 4).
 */
export interface ParsedTrack {
	readonly titleFromFile: string | null;
	readonly sportRaw: string | null;
	readonly startedAtRaw: string | null;
	readonly endedAtRaw: string | null;
	readonly points: readonly ParsedTrackPoint[];
	readonly segments: readonly TrackSegment[];
	readonly bbox: Bbox | null;
}
