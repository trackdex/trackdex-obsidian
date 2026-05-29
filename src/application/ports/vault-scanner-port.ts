import type { TrackFileExtension } from "domain/track/parsed-track";
import type { TrackPath } from "domain/track/track-record";

/** A supported track file discovered during vault scan (§7.2). */
export interface DiscoveredTrackFile {
	readonly path: TrackPath;
	readonly extension: TrackFileExtension;
}

/**
 * Recursively discovers `.gpx`, `.tcx`, `.fit`, and `.fit.gz` in the vault.
 * Excludes and parsing are handled by later pipeline stages.
 */
export interface VaultScannerPort {
	listTrackFiles(): Promise<readonly DiscoveredTrackFile[]>;
}
