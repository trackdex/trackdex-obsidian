/** Display placeholder for missing indexed values (REQ-006 / 0.5-06). */
export const MISSING_STATS_VALUE = "—";

export function formatNullableMetric<T>(
	value: T | null,
	format: (resolved: T) => string,
): string {
	if (value === null) {
		return MISSING_STATS_VALUE;
	}
	return format(value);
}

export function formatDistanceM(distanceM: number | null): string {
	return formatNullableMetric(distanceM, (m) => `${(m / 1000).toFixed(2)} km`);
}

export function formatDurationSec(durationSec: number | null): string {
	return formatNullableMetric(durationSec, (sec) => {
		const total = Math.floor(sec);
		const hours = Math.floor(total / 3600);
		const minutes = Math.floor((total % 3600) / 60);
		const seconds = total % 60;
		if (hours > 0) {
			return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
		}
		return `${minutes}:${String(seconds).padStart(2, "0")}`;
	});
}

export function formatElevationM(elevationM: number | null): string {
	return formatNullableMetric(elevationM, (m) => `${Math.round(m)} m`);
}

export function formatSpeedMps(speedMps: number | null): string {
	return formatNullableMetric(speedMps, (mps) => `${(mps * 3.6).toFixed(1)} km/h`);
}

export function formatHeartRateBpm(bpm: number | null): string {
	return formatNullableMetric(bpm, (value) => `${Math.round(value)} bpm`);
}

export function formatPowerW(powerW: number | null): string {
	return formatNullableMetric(powerW, (value) => `${Math.round(value)} W`);
}

export function formatCadenceRpm(cadenceRpm: number | null): string {
	return formatNullableMetric(cadenceRpm, (value) => `${Math.round(value)} rpm`);
}

export function formatTrackDateUtc(
	startedAtUtc: string | null,
	locale?: string,
): string {
	if (startedAtUtc === null) {
		return MISSING_STATS_VALUE;
	}
	const date = new Date(startedAtUtc);
	if (Number.isNaN(date.getTime())) {
		return MISSING_STATS_VALUE;
	}
	return date.toLocaleString(locale);
}

export function formatSportDisplay(
	sportNormalized: string | null,
	sportRaw: string | null,
): string {
	const sport = sportNormalized ?? sportRaw;
	return sport ?? MISSING_STATS_VALUE;
}
