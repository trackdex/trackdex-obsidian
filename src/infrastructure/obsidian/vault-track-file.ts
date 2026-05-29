import type { VaultTrackFilePort } from "application/ports/vault-track-file-port";
import { normalizeVaultRelativePath } from "domain/shared/vault-path";
import { matchTrackFileExtensionFromName } from "domain/track/track-file-name";
import { TFile, type App } from "obsidian";

/** Reads vault track file bytes by vault-relative path for the indexing pipeline. */
export function createObsidianVaultTrackFilePort(app: App): VaultTrackFilePort {
	return {
		async read(path) {
			const normalized = normalizeVaultRelativePath(path);
			const abstract = app.vault.getAbstractFileByPath(normalized);
			if (abstract === null || !(abstract instanceof TFile)) {
				return null;
			}

			const extension = matchTrackFileExtensionFromName(abstract.name);
			if (extension === null) {
				return null;
			}

			const buffer = await app.vault.readBinary(abstract);
			return {
				content: new Uint8Array(buffer),
				extension,
				mtimeMs: abstract.stat.mtime,
			};
		},
	};
}
