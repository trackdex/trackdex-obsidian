import type { ParsedTrackPoint } from "domain/track/parsed-track";
import type {
	NormalizedTrackTimes,
	TimeNormalizationContext,
} from "domain/track/time-normalization";
import { normalizeTimestamp } from "domain/track/time-normalization";

/** v1 elevation gain/loss noise threshold (REQUIREMENTS §4.2.1, TECHNICAL_DESIGN §8). */
export const ELEVATION_GAIN_LOSS_THRESHOLD_M = 3;

const EARTH_RADIUS_M = 6_371_000;

/** Domain-computed metrics from parsed points and normalized times (§8). */
export interface ComputedTrackMetrics {
	readonly durationSec: number | null;
	readonly distanceM: number | null;
	readonly elevationGainM: number | null;
	readonly elevationLossM: number | null;
	readonly avgSpeedMps: number | null;
	readonly maxSpeedMps: number | null;
	readonly hrAvg: number | null;
	readonly hrMax: number | null;
	readonly powerAvg: number | null;
	readonly cadenceAvg: number | null;
}

function utcIsoToMs(iso: string | null): number | null {
	if (iso === null) {
		return null;
	}
	const ms = Date.parse(iso);
	return Number.isNaN(ms) ? null : ms;
}

function toRadians(degrees: number): number {
	return (degrees * Math.PI) / 180;
}

/** Haversine distance on WGS-84 sphere in meters. */
export function haversineDistanceM(
	a: Pick<ParsedTrackPoint, "lat" | "lon">,
	b: Pick<ParsedTrackPoint, "lat" | "lon">,
): number {
	const lat1 = toRadians(a.lat);
	const lat2 = toRadians(b.lat);
	const dLat = lat2 - lat1;
	const dLon = toRadians(b.lon - a.lon);
	const sinHalfDLat = Math.sin(dLat / 2);
	const sinHalfDLon = Math.sin(dLon / 2);
	const h =
		sinHalfDLat * sinHalfDLat +
		Math.cos(lat1) * Math.cos(lat2) * sinHalfDLon * sinHalfDLon;
	return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

function computeDurationSec(times: NormalizedTrackTimes): number | null {
	const startMs = utcIsoToMs(times.startedAtUtc);
	const endMs = utcIsoToMs(times.endedAtUtc);
	if (startMs === null || endMs === null) {
		return null;
	}
	const elapsedMs = endMs - startMs;
	if (elapsedMs < 0) {
		return null;
	}
	return elapsedMs / 1000;
}

function computeDistanceM(points: readonly ParsedTrackPoint[]): number | null {
	if (points.length === 0) {
		return null;
	}
	let total = 0;
	for (let index = 1; index < points.length; index += 1) {
		const prev = points[index - 1];
		const current = points[index];
		if (prev === undefined || current === undefined) {
			continue;
		}
		total += haversineDistanceM(prev, current);
	}
	return total;
}

function computeElevationGainLossM(points: readonly ParsedTrackPoint[]): {
	gainM: number | null;
	lossM: number | null;
} {
	let sawElevation = false;
	let gainM = 0;
	let lossM = 0;

	for (let index = 1; index < points.length; index += 1) {
		const prev = points[index - 1];
		const current = points[index];
		if (prev === undefined || current === undefined) {
			continue;
		}
		if (prev.elevationM === null || current.elevationM === null) {
			continue;
		}
		sawElevation = true;
		const deltaH = current.elevationM - prev.elevationM;
		if (deltaH >= ELEVATION_GAIN_LOSS_THRESHOLD_M) {
			gainM += deltaH;
		} else if (deltaH <= -ELEVATION_GAIN_LOSS_THRESHOLD_M) {
			lossM += Math.abs(deltaH);
		}
	}

	if (!sawElevation) {
		return { gainM: null, lossM: null };
	}
	return { gainM, lossM };
}

function averageFinite(values: readonly number[]): number | null {
	if (values.length === 0) {
		return null;
	}
	let sum = 0;
	for (const value of values) {
		sum += value;
	}
	return sum / values.length;
}

function maxFinite(values: readonly number[]): number | null {
	if (values.length === 0) {
		return null;
	}
	let max = values[0];
	for (let index = 1; index < values.length; index += 1) {
		const value = values[index];
		if (value !== undefined && max !== undefined && value > max) {
			max = value;
		}
	}
	return max ?? null;
}

function collectSampleSpeedsMps(points: readonly ParsedTrackPoint[]): number[] {
	const speeds: number[] = [];
	for (const point of points) {
		if (point.speedMps !== null) {
			speeds.push(point.speedMps);
		}
	}
	return speeds;
}

function computeDerivedMaxSpeedMps(
	points: readonly ParsedTrackPoint[],
	context: TimeNormalizationContext,
): number | null {
	const derived: number[] = [];

	for (let index = 1; index < points.length; index += 1) {
		const prev = points[index - 1];
		const current = points[index];
		if (prev === undefined || current === undefined) {
			continue;
		}

		const prevUtc = normalizeTimestamp(prev.timestampRaw, context).utcIso;
		const currentUtc = normalizeTimestamp(current.timestampRaw, context).utcIso;
		const prevMs = utcIsoToMs(prevUtc);
		const currentMs = utcIsoToMs(currentUtc);
		if (prevMs === null || currentMs === null) {
			continue;
		}

		const elapsedSec = (currentMs - prevMs) / 1000;
		if (elapsedSec <= 0) {
			continue;
		}

		const segmentDistanceM = haversineDistanceM(prev, current);
		derived.push(segmentDistanceM / elapsedSec);
	}

	return maxFinite(derived);
}

function computeAvgSpeedMps(
	distanceM: number | null,
	durationSec: number | null,
): number | null {
	if (distanceM === null || durationSec === null || durationSec <= 0) {
		return null;
	}
	return distanceM / durationSec;
}

function computeMaxSpeedMps(
	points: readonly ParsedTrackPoint[],
	context: TimeNormalizationContext,
): number | null {
	const sampleSpeeds = collectSampleSpeedsMps(points);
	if (sampleSpeeds.length > 0) {
		return maxFinite(sampleSpeeds);
	}
	return computeDerivedMaxSpeedMps(points, context);
}

function collectNumericField(
	points: readonly ParsedTrackPoint[],
	read: (point: ParsedTrackPoint) => number | null,
): number[] {
	const values: number[] = [];
	for (const point of points) {
		const value = read(point);
		if (value !== null) {
			values.push(value);
		}
	}
	return values;
}

/**
 * Compute deterministic track metrics from parsed points and normalized bounds (§8).
 * Missing inputs yield null metrics; no invented defaults.
 */
export function computeTrackMetrics(
	points: readonly ParsedTrackPoint[],
	times: NormalizedTrackTimes,
	context: TimeNormalizationContext,
): ComputedTrackMetrics {
	const durationSec = computeDurationSec(times);
	const distanceM = computeDistanceM(points);
	const { gainM, lossM } = computeElevationGainLossM(points);
	const hrSamples = collectNumericField(points, (point) => point.hrBpm);
	const powerSamples = collectNumericField(points, (point) => point.powerW);
	const cadenceSamples = collectNumericField(points, (point) => point.cadenceRpm);

	return {
		durationSec,
		distanceM,
		elevationGainM: gainM,
		elevationLossM: lossM,
		avgSpeedMps: computeAvgSpeedMps(distanceM, durationSec),
		maxSpeedMps: computeMaxSpeedMps(points, context),
		hrAvg: averageFinite(hrSamples),
		hrMax: maxFinite(hrSamples),
		powerAvg: averageFinite(powerSamples),
		cadenceAvg: averageFinite(cadenceSamples),
	};
}
