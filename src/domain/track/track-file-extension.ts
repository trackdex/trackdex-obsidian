import type { TrackFileExtension } from "domain/track/parsed-track";

/**
 * Canonical v1 extension from a string (case-insensitive).
 * Use for parser routing when the extension may not be normalized.
 */
export function normalizeTrackFileExtension(
	value: string,
): TrackFileExtension | null {
	const normalized = value.trim().toLowerCase();
	if (normalized === "fit.gz") {
		return "fit.gz";
	}
	if (normalized === "gpx" || normalized === "tcx" || normalized === "fit") {
		return normalized;
	}
	return null;
}
