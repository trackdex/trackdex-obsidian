import type { TrackFileExtension } from "domain/track/parsed-track";
import type { TrackPath } from "domain/track/track-record";

/** A supported track file discovered during vault scan (§7.2). */
export interface DiscoveredTrackFile {
	readonly path: TrackPath;
	readonly extension: TrackFileExtension;
	readonly mtimeMs: number;
	readonly sizeBytes?: number;
}

/**
 * Recursively discovers `.gpx`, `.tcx`, `.fit`, and `.fit.gz` in the vault.
 * Applies default and settings-driven exclude patterns; parsing is a later stage.
 */
export interface VaultScannerPort {
	listTrackFiles(): Promise<readonly DiscoveredTrackFile[]>;
}
