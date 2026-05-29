import type { TrackFileExtension } from "domain/track/parsed-track";
import type { TrackPath } from "domain/track/track-record";

/** Raw vault track file bytes and metadata for the parse pipeline (§7.4). */
export interface VaultTrackFileContent {
	readonly content: Uint8Array;
	readonly extension: TrackFileExtension;
	readonly mtimeMs: number;
}

/**
 * Reads track file bytes from the vault by vault-relative path.
 * Implementations live in `infrastructure/obsidian/`.
 */
export interface VaultTrackFilePort {
	read(path: TrackPath): Promise<VaultTrackFileContent | null>;
}
