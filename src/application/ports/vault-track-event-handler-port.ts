import type { TrackPath } from "domain/track/track-record";

/** Vault filesystem signal for a supported track file (§7.2 / 0.3-05). */
export type VaultTrackEvent =
	| {
			readonly kind: "created";
			readonly path: TrackPath;
			readonly mtimeMs: number;
	  }
	| {
			readonly kind: "modified";
			readonly path: TrackPath;
			readonly mtimeMs: number;
			/** True when file bytes likely changed (mtime-based until 0.3-09 compares index). */
			readonly contentChanged: boolean;
	  }
	| { readonly kind: "deleted"; readonly path: TrackPath }
	| {
			readonly kind: "renamed";
			readonly oldPath: TrackPath;
			readonly newPath: TrackPath;
			readonly mtimeMs: number;
	  };

/** Consumes incremental vault track events (wired in 0.3-09). */
export interface VaultTrackEventHandlerPort {
	handleVaultTrackEvent(event: VaultTrackEvent): Promise<void>;
}
