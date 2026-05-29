import type { Bbox, LatLng } from "domain/shared/geo";
import type { TrackDataFlags } from "domain/track/track-data-flags";
import type { TrackSegment } from "domain/track/track-segment";
import type { TrackStatus } from "domain/track/track-status";
import type { TimezoneSource } from "domain/track/timezone-source";

/** Vault-relative path to a track file (primary key). */
export type TrackPath = string;

/** Persisted track index row (`tracks` table logical model). */
export interface TrackRecord {
	readonly path: TrackPath;
	readonly mtimeMs: number;
	readonly sha256: string | null;
	readonly status: TrackStatus;
	readonly errorMessage: string | null;
	readonly errorDetails: string | null;
	readonly titleFromFile: string | null;
	readonly startedAtUtc: string | null;
	readonly endedAtUtc: string | null;
	readonly startedAtRaw: string | null;
	readonly endedAtRaw: string | null;
	readonly timezoneSource: TimezoneSource;
	readonly timezoneOffsetMin: number | null;
	readonly durationSec: number | null;
	readonly distanceM: number | null;
	readonly elevationGainM: number | null;
	readonly elevationLossM: number | null;
	readonly avgSpeedMps: number | null;
	readonly maxSpeedMps: number | null;
	readonly sportRaw: string | null;
	readonly sportNormalized: string | null;
	readonly bbox: Bbox | null;
	readonly polylineSimplified: LatLng[] | null;
	readonly segments: TrackSegment[] | null;
	readonly dataFlags: TrackDataFlags;
	readonly hrAvg: number | null;
	readonly hrMax: number | null;
	readonly powerAvg: number | null;
	readonly cadenceAvg: number | null;
}

/** Fields required when first registering a discovered file. */
export type NewTrackRecord = Pick<TrackRecord, "path" | "mtimeMs"> &
	Partial<
		Pick<TrackRecord, "sha256" | "status" | "titleFromFile">
	>;
