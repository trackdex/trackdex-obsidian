/** Plugin settings persisted in plugin data (expanded in milestone 0.9). */
export interface TrackdexSettings {
	/** Vault-relative glob patterns; defaults from scan exclude matcher always apply. */
	scanExcludePatterns: string[];
}

export const DEFAULT_SETTINGS: TrackdexSettings = {
	scanExcludePatterns: [],
};
