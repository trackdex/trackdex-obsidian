import type { Bbox } from "domain/shared/geo";

/** Segment metadata for multi-track / lap files (persisted in `segments_json`). */
export interface TrackSegment {
	readonly id: string;
	readonly name?: string | null;
	readonly startedAtRaw?: string | null;
	readonly endedAtRaw?: string | null;
	readonly pointCount?: number | null;
	readonly bbox?: Bbox | null;
}
