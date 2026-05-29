import type {
	DiscoveredTrackFile,
	VaultScannerPort,
} from "application/ports/vault-scanner-port";
import { normalizeVaultRelativePath } from "domain/shared/vault-path";
import { matchTrackFileExtensionFromName } from "domain/track/track-file-name";
import type { TrackPath } from "domain/track/track-record";
import type { App, TFile } from "obsidian";

/** Minimal file shape for unit tests and Obsidian adapter input. */
export interface VaultFileCandidate {
	readonly path: string;
	readonly name: string;
}

/**
 * Lists supported track files from vault file metadata (extension match is case-insensitive).
 */
export function listTrackFilesFromCandidates(
	files: readonly VaultFileCandidate[],
): readonly DiscoveredTrackFile[] {
	const discovered: DiscoveredTrackFile[] = [];

	for (const file of files) {
		const extension = matchTrackFileExtensionFromName(file.name);
		if (!extension) {
			continue;
		}
		const path: TrackPath = normalizeVaultRelativePath(file.path);
		discovered.push({ path, extension });
	}

	discovered.sort((a, b) => a.path.localeCompare(b.path));
	return discovered;
}

export function createObsidianVaultScanner(app: App): VaultScannerPort {
	return {
		listTrackFiles(): Promise<readonly DiscoveredTrackFile[]> {
			const candidates = app.vault
				.getFiles()
				.map((file: TFile): VaultFileCandidate => ({
					path: file.path,
					name: file.name,
				}));
			return Promise.resolve(listTrackFilesFromCandidates(candidates));
		},
	};
}
