import type { ParsedTrack } from "domain/track/parsed-track";
import type { TrackDataFlags } from "domain/track/track-data-flags";

function hasNonEmptyString(value: string | null): boolean {
	return value != null && value.length > 0;
}

function pointsHaveField(
	points: ParsedTrack["points"],
	read: (point: ParsedTrack["points"][number]) => unknown,
): boolean {
	for (const point of points) {
		if (read(point) !== null) {
			return true;
		}
	}
	return false;
}

/**
 * Derive extensible presence flags from a parsed track (REQUIREMENTS §4.2, F-01h).
 * Only `true` flags are emitted; omitted keys mean the field is absent.
 */
export function deriveTrackDataFlags(track: ParsedTrack): TrackDataFlags {
	const hasGeometry = track.points.length > 0;
	const hasTime =
		hasNonEmptyString(track.startedAtRaw) ||
		hasNonEmptyString(track.endedAtRaw) ||
		pointsHaveField(track.points, (point) => point.timestampRaw);
	const hasElevation = pointsHaveField(track.points, (point) => point.elevationM);
	const hasHr = pointsHaveField(track.points, (point) => point.hrBpm);
	const hasPower = pointsHaveField(track.points, (point) => point.powerW);
	const hasCadence = pointsHaveField(track.points, (point) => point.cadenceRpm);
	const hasSport = hasNonEmptyString(track.sportRaw);
	const hasFileMetrics = pointsHaveField(track.points, (point) => point.speedMps);

	return {
		...(hasGeometry ? { hasGeometry: true } : {}),
		...(hasTime ? { hasTime: true } : {}),
		...(hasElevation ? { hasElevation: true } : {}),
		...(hasHr ? { hasHr: true } : {}),
		...(hasPower ? { hasPower: true } : {}),
		...(hasCadence ? { hasCadence: true } : {}),
		...(hasSport ? { hasSport: true } : {}),
		...(hasFileMetrics ? { hasFileMetrics: true } : {}),
	};
}
