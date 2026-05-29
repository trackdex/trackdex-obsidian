import {
	isVaultPathExcluded,
	resolveScanExcludePatterns,
	type ScanExcludePattern,
} from "application/indexing/exclude-matcher";
import type {
	DiscoveredTrackFile,
	VaultScannerPort,
} from "application/ports/vault-scanner-port";
import { normalizeVaultRelativePath } from "domain/shared/vault-path";
import { matchTrackFileExtensionFromName } from "domain/track/track-file-name";
import type { App, TFile } from "obsidian";

export interface ListTrackFilesOptions {
	readonly scanExcludePatterns?: readonly ScanExcludePattern[];
}

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
	options?: ListTrackFilesOptions,
): readonly DiscoveredTrackFile[] {
	const excludePatterns = resolveScanExcludePatterns(
		options?.scanExcludePatterns,
	);
	const discovered: DiscoveredTrackFile[] = [];

	for (const file of files) {
		const path = normalizeVaultRelativePath(file.path);
		if (isVaultPathExcluded(path, excludePatterns)) {
			continue;
		}
		const extension = matchTrackFileExtensionFromName(file.name);
		if (!extension) {
			continue;
		}
		discovered.push({ path, extension });
	}

	discovered.sort((a, b) => a.path.localeCompare(b.path));
	return discovered;
}

export interface ObsidianVaultScannerOptions {
	readonly scanExcludePatterns?: readonly ScanExcludePattern[];
}

export function createObsidianVaultScanner(
	app: App,
	options?: ObsidianVaultScannerOptions,
): VaultScannerPort {
	const listOptions: ListTrackFilesOptions = {
		scanExcludePatterns: options?.scanExcludePatterns,
	};
	return {
		listTrackFiles(): Promise<readonly DiscoveredTrackFile[]> {
			const candidates = app.vault
				.getFiles()
				.map((file: TFile): VaultFileCandidate => ({
					path: file.path,
					name: file.name,
				}));
			return Promise.resolve(
				listTrackFilesFromCandidates(candidates, listOptions),
			);
		},
	};
}
