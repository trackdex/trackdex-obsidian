import {matchTrackFileExtensionFromName} from "domain/track/track-file-name";
import type {TFile} from "obsidian";
import type {TrackFileExtension} from "domain/track/parsed-track";

/** Resolves v1 track extension from vault file (handles `.fit.gz`). */
export function getTrackFileExtension(file: TFile): TrackFileExtension | null {
	return matchTrackFileExtensionFromName(file.name);
}
