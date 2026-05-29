import type {TFile} from "obsidian";
import type {TrackFileExtension} from "domain/track/parsed-track";

/** Resolves v1 track extension from vault file (handles `.fit.gz`). */
export function getTrackFileExtension(file: TFile): TrackFileExtension | null {
	const lower = file.name.toLowerCase();
	if (lower.endsWith(".fit.gz")) {
		return "fit.gz";
	}
	const ext = file.extension.toLowerCase();
	if (ext === "gpx" || ext === "tcx" || ext === "fit") {
		return ext;
	}
	return null;
}
