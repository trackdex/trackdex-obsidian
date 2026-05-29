import type {TrackSegment} from "../../domain/track/track-segment";
import {
	formatDistanceM,
	formatDurationSec,
	formatNullableMetric,
	MISSING_STATS_VALUE,
} from "./track-stats-format";

/** Derive segment duration from raw start/end timestamps when both parse. */
export function computeSegmentDurationSec(
	startedAtRaw: string | null | undefined,
	endedAtRaw: string | null | undefined,
): number | null {
	if (startedAtRaw == null || endedAtRaw == null) {
		return null;
	}
	const startMs = Date.parse(startedAtRaw);
	const endMs = Date.parse(endedAtRaw);
	if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
		return null;
	}
	const deltaSec = (endMs - startMs) / 1000;
	if (deltaSec < 0) {
		return null;
	}
	return deltaSec;
}

export function formatSegmentDuration(segment: TrackSegment): string {
	return formatDurationSec(
		computeSegmentDurationSec(segment.startedAtRaw, segment.endedAtRaw),
	);
}

/** Per-segment distance is not persisted in the index (0.4-08). */
export function formatSegmentDistance(_segment: TrackSegment): string {
	return formatDistanceM(null);
}

export function formatSegmentPointCount(pointCount: number | null | undefined): string {
	return formatNullableMetric(pointCount ?? null, (count) => String(count));
}

export function formatSegmentName(
	name: string | null | undefined,
	fallback: string,
): string {
	const trimmed = name?.trim();
	return trimmed && trimmed.length > 0 ? trimmed : fallback;
}

export function shouldShowSegmentList(
	segments: readonly TrackSegment[] | null | undefined,
): boolean {
	return segments !== null && segments !== undefined && segments.length > 1;
}

export {MISSING_STATS_VALUE};
