import type { Bbox } from "domain/shared/geo";
import { deriveTrackDataFlags } from "domain/track/derive-track-data-flags";
import type { ParsedTrack } from "domain/track/parsed-track";
import type { TrackDataFlags } from "domain/track/track-data-flags";
import type { TrackSegment } from "domain/track/track-segment";
import type { ComputedTrackMetrics } from "domain/track/track-metrics";
import { computeTrackMetrics } from "domain/track/track-metrics";
import type {
	NormalizedTrackTimes,
	TimeNormalizationContext,
} from "domain/track/time-normalization";
import { normalizeTrackTimes } from "domain/track/time-normalization";

/**
 * File-level catalog fields derived from a parsed track (§7.4 step 4–5, TECHNICAL_DESIGN §8).
 * One {@link ParsedTrack} maps to one catalog row: metrics across all points, segment list for the view.
 */
export interface AggregatedTrackCatalogData {
	readonly titleFromFile: string | null;
	readonly sportRaw: string | null;
	readonly bbox: Bbox | null;
	/** Persisted as `segments_json` when non-empty; null when the parser found no segments. */
	readonly segments: TrackSegment[] | null;
	readonly times: NormalizedTrackTimes;
	readonly metrics: ComputedTrackMetrics;
	readonly dataFlags: TrackDataFlags;
}

/**
 * Aggregate a parsed file into catalog-ready metrics and segment metadata.
 * Metrics and time bounds use the full point stream (all segments/tracks in the file).
 */
export function aggregateParsedTrackForCatalog(
	track: ParsedTrack,
	context: TimeNormalizationContext,
): AggregatedTrackCatalogData {
	const times = normalizeTrackTimes(track, context);
	const metrics = computeTrackMetrics(track.points, times, context);
	const segments = track.segments.length > 0 ? [...track.segments] : null;

	return {
		titleFromFile: track.titleFromFile,
		sportRaw: track.sportRaw,
		bbox: track.bbox,
		segments,
		times,
		metrics,
		dataFlags: deriveTrackDataFlags(track),
	};
}
