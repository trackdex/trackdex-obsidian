import type { AggregatedTrackCatalogData } from "domain/track/segment-aggregation";
import type { TrackPath, TrackRecord } from "domain/track/track-record";

export interface BuildIndexedTrackRecordInput {
	readonly path: TrackPath;
	readonly mtimeMs: number;
	readonly sha256: string | null;
	readonly aggregated: AggregatedTrackCatalogData;
}

/** Maps aggregated parse output to a persisted `indexed` row (§7.4 step 6). */
export function buildIndexedTrackRecord(input: BuildIndexedTrackRecordInput): TrackRecord {
	const { aggregated, path, mtimeMs, sha256 } = input;
	const { metrics, times, dataFlags } = aggregated;

	return {
		path,
		mtimeMs,
		sha256,
		status: "indexed",
		errorMessage: null,
		errorDetails: null,
		titleFromFile: aggregated.titleFromFile,
		startedAtUtc: times.startedAtUtc,
		endedAtUtc: times.endedAtUtc,
		startedAtRaw: times.startedAtRaw,
		endedAtRaw: times.endedAtRaw,
		timezoneSource: times.timezoneSource,
		timezoneOffsetMin: times.timezoneOffsetMin,
		durationSec: metrics.durationSec,
		distanceM: metrics.distanceM,
		elevationGainM: metrics.elevationGainM,
		elevationLossM: metrics.elevationLossM,
		avgSpeedMps: metrics.avgSpeedMps,
		maxSpeedMps: metrics.maxSpeedMps,
		sportRaw: aggregated.sportRaw,
		sportNormalized: null,
		bbox: aggregated.bbox,
		polylineSimplified: aggregated.polylineSimplified,
		segments: aggregated.segments,
		dataFlags,
		hrAvg: metrics.hrAvg,
		hrMax: metrics.hrMax,
		powerAvg: metrics.powerAvg,
		cadenceAvg: metrics.cadenceAvg,
	};
}
