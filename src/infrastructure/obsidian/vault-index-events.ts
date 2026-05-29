import type { ScanExcludePattern } from "application/indexing/exclude-matcher";
import type { LoggerPort } from "application/ports/logger-port";
import type {
	VaultTrackEvent,
	VaultTrackEventHandlerPort,
} from "application/ports/vault-track-event-handler-port";
import { normalizeVaultRelativePath } from "domain/shared/vault-path";
import type { TrackPath } from "domain/track/track-record";
import { TFile, type App, type Plugin, type TAbstractFile } from "obsidian";
import {
	isVaultTrackFileCandidate,
	type ListTrackFilesOptions,
} from "./vault-scanner";

export interface VaultTrackRenameInput {
	readonly oldPath: string;
	readonly newPath: string;
	readonly newName: string;
	readonly mtimeMs: number;
	readonly scanExcludePatterns?: readonly ScanExcludePattern[];
}

export function vaultPathBasename(vaultRelativePath: string): string {
	const normalized = normalizeVaultRelativePath(vaultRelativePath);
	const slash = normalized.lastIndexOf("/");
	return slash >= 0 ? normalized.slice(slash + 1) : normalized;
}

/** Maps Obsidian `rename` to incremental jobs (§7.3 rename / delete / create). */
export function resolveVaultTrackRenameEvents(
	input: VaultTrackRenameInput,
): readonly VaultTrackEvent[] {
	const listOptions: ListTrackFilesOptions = {
		scanExcludePatterns: input.scanExcludePatterns,
	};
	const oldPath: TrackPath = normalizeVaultRelativePath(input.oldPath);
	const newPath: TrackPath = normalizeVaultRelativePath(input.newPath);
	const wasTrack = isVaultTrackFileCandidate(
		{ path: oldPath, name: vaultPathBasename(oldPath) },
		listOptions,
	);
	const isTrack = isVaultTrackFileCandidate(
		{ path: newPath, name: input.newName },
		listOptions,
	);

	if (wasTrack && isTrack) {
		return [
			{
				kind: "renamed",
				oldPath,
				newPath,
				mtimeMs: input.mtimeMs,
			},
		];
	}
	if (wasTrack) {
		return [{ kind: "deleted", path: oldPath }];
	}
	if (isTrack) {
		return [
			{
				kind: "created",
				path: newPath,
				mtimeMs: input.mtimeMs,
			},
		];
	}
	return [];
}

export function shouldDispatchVaultTrackEvents(
	scanPaused: boolean,
	firstScanApproved: boolean,
): boolean {
	return firstScanApproved && !scanPaused;
}

export interface RegisterVaultIndexEventsDeps {
	readonly plugin: Plugin;
	readonly app: App;
	readonly getScanExcludePatterns: () => readonly ScanExcludePattern[];
	readonly isScanPaused: () => Promise<boolean>;
	readonly isFirstScanApproved: () => Promise<boolean>;
	readonly handler: VaultTrackEventHandlerPort;
	readonly logger?: LoggerPort;
}

function trackFileMtimeMs(file: TFile): number {
	return file.stat.mtime;
}

function isIndexableTrackFile(
	file: TAbstractFile,
	scanExcludePatterns: readonly ScanExcludePattern[],
): file is TFile {
	if (!(file instanceof TFile)) {
		return false;
	}
	return isVaultTrackFileCandidate(
		{ path: file.path, name: file.name },
		{ scanExcludePatterns },
	);
}

/** Registers vault `create` / `modify` / `delete` / `rename` listeners (§7.2). */
export function registerVaultIndexEvents(deps: RegisterVaultIndexEventsDeps): void {
	const log = deps.logger?.child?.({ component: "vault-index-events" }) ?? deps.logger;

	const dispatch = (events: readonly VaultTrackEvent[]): void => {
		if (events.length === 0) {
			return;
		}
		void (async () => {
			try {
				const [paused, firstScanApproved] = await Promise.all([
					deps.isScanPaused(),
					deps.isFirstScanApproved(),
				]);
				if (!shouldDispatchVaultTrackEvents(paused, firstScanApproved)) {
					return;
				}
				for (const event of events) {
					await deps.handler.handleVaultTrackEvent(event);
				}
			} catch (err: unknown) {
				const message = err instanceof Error ? err.message : String(err);
				log?.warn("vault track event dispatch failed", { error: message });
			}
		})();
	};

	const excludePatterns = (): readonly ScanExcludePattern[] =>
		deps.getScanExcludePatterns();

	deps.plugin.registerEvent(
		deps.app.vault.on("create", (file) => {
			if (!isIndexableTrackFile(file, excludePatterns())) {
				return;
			}
			dispatch([
				{
					kind: "created",
					path: normalizeVaultRelativePath(file.path),
					mtimeMs: trackFileMtimeMs(file),
				},
			]);
		}),
	);

	deps.plugin.registerEvent(
		deps.app.vault.on("modify", (file) => {
			if (!isIndexableTrackFile(file, excludePatterns())) {
				return;
			}
			dispatch([
				{
					kind: "modified",
					path: normalizeVaultRelativePath(file.path),
					mtimeMs: trackFileMtimeMs(file),
					contentChanged: true,
				},
			]);
		}),
	);

	deps.plugin.registerEvent(
		deps.app.vault.on("delete", (file) => {
			const patterns = excludePatterns();
			const path: TrackPath = normalizeVaultRelativePath(file.path);
			if (
				!isVaultTrackFileCandidate(
					{ path, name: vaultPathBasename(path) },
					{ scanExcludePatterns: patterns },
				)
			) {
				return;
			}
			dispatch([{ kind: "deleted", path }]);
		}),
	);

	deps.plugin.registerEvent(
		deps.app.vault.on("rename", (file, oldPath) => {
			if (!(file instanceof TFile)) {
				const patterns = excludePatterns();
				const normalizedOld: TrackPath = normalizeVaultRelativePath(oldPath);
				if (
					isVaultTrackFileCandidate(
						{
							path: normalizedOld,
							name: vaultPathBasename(normalizedOld),
						},
						{ scanExcludePatterns: patterns },
					)
				) {
					dispatch([{ kind: "deleted", path: normalizedOld }]);
				}
				return;
			}
			dispatch(
				resolveVaultTrackRenameEvents({
					oldPath,
					newPath: file.path,
					newName: file.name,
					mtimeMs: trackFileMtimeMs(file),
					scanExcludePatterns: excludePatterns(),
				}),
			);
		}),
	);
}
