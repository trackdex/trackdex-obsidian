import type { TrackFileExtension } from "domain/track/parsed-track";

/**
 * Match v1 track extension from a file name (not Obsidian's `TFile.extension`).
 * Handles compound suffixes like `.fit.gz` (Obsidian reports extension `gz` only).
 */
export function matchTrackFileExtensionFromName(
	fileName: string,
): TrackFileExtension | null {
	const lower = fileName.toLowerCase();
	if (lower.endsWith(".fit.gz")) {
		return "fit.gz";
	}
	// Compressed GPX not in v1 scope; avoid treating as FIT when we register `gz`.
	if (lower.endsWith(".gpx.gz")) {
		return null;
	}
	const dot = lower.lastIndexOf(".");
	if (dot < 0) {
		return null;
	}
	const ext = lower.slice(dot + 1);
	if (ext === "gpx" || ext === "tcx" || ext === "fit") {
		return ext;
	}
	return null;
}

export function isFitTrackFileName(fileName: string): boolean {
	const kind = matchTrackFileExtensionFromName(fileName);
	return kind === "fit" || kind === "fit.gz";
}
