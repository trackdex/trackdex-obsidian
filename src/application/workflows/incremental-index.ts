import type { BoundedWorkQueue } from "application/indexing/work-queue";
import type { LoggerPort } from "application/ports/logger-port";
import type { TrackRepository } from "application/ports/repositories";
import type {
	VaultTrackEvent,
	VaultTrackEventHandlerPort,
} from "application/ports/vault-track-event-handler-port";
import type { DomainError } from "domain/shared/errors";
import {
	initialDiscoveredFileStatus,
	resolveVaultFileCreated,
	resolveVaultFileDeleted,
	resolveVaultFileModified,
	resolveVaultFileRenamed,
	type FileLifecycleEffect,
} from "domain/track/file-status";
import type { TrackPath } from "domain/track/track-record";
import type { IndexTrackFileJob } from "./full-scan";

export interface RunIncrementalIndexDeps {
	readonly tracks: TrackRepository;
	readonly queue: BoundedWorkQueue;
	readonly indexTrackFile?: IndexTrackFileJob;
	readonly isScanPaused?: () => Promise<boolean>;
	readonly logger?: LoggerPort;
}

function createStubIndexTrackJob(logger?: LoggerPort): IndexTrackFileJob {
	const log = logger?.child?.({ job: "index-track-stub" }) ?? logger;
	return async (path: TrackPath): Promise<void> => {
		log?.debug("index track job stubbed until 0.4", { path });
	};
}

async function enqueueIndexJob(
	deps: RunIncrementalIndexDeps,
	path: TrackPath,
): Promise<void> {
	const indexTrackFile = deps.indexTrackFile ?? createStubIndexTrackJob(deps.logger);
	await deps.queue.run(() => indexTrackFile(path));
}

async function applyFileLifecycleEffect(
	deps: RunIncrementalIndexDeps,
	effect: FileLifecycleEffect,
): Promise<void> {
	switch (effect.kind) {
		case "none":
			return;
		case "remove":
			return;
		case "insert_pending":
			await deps.tracks.insertDiscovered({
				path: effect.path,
				mtimeMs: effect.mtimeMs,
				status: initialDiscoveredFileStatus(),
			});
			await enqueueIndexJob(deps, effect.path);
			return;
		case "rename":
			await deps.tracks.renamePath(effect.oldPath, effect.newPath, effect.mtimeMs);
			await enqueueIndexJob(deps, effect.newPath);
			return;
		default: {
			const _exhaustive: never = effect;
			return _exhaustive;
		}
	}
}

function resolveModifyContentChanged(
	existingMtimeMs: number | null,
	eventMtimeMs: number,
): boolean {
	if (existingMtimeMs === null) {
		return true;
	}
	return existingMtimeMs !== eventMtimeMs;
}

async function logDomainFailure(
	log: LoggerPort | undefined,
	context: string,
	error: DomainError,
): Promise<void> {
	log?.warn(context, { code: error.code, message: error.message });
}

/** Applies one vault track filesystem event to the index (§7.2 / §7.3). */
export async function handleVaultTrackEvent(
	deps: RunIncrementalIndexDeps,
	event: VaultTrackEvent,
): Promise<void> {
	const log = deps.logger?.child?.({ workflow: "incremental-index" }) ?? deps.logger;

	if (deps.isScanPaused && (await deps.isScanPaused())) {
		log?.debug("incremental event skipped: indexing paused", { kind: event.kind });
		return;
	}

	switch (event.kind) {
		case "created": {
			const existing = await deps.tracks.findByPath(event.path);
			const effect = resolveVaultFileCreated(existing !== null, event.path, event.mtimeMs);
			await applyFileLifecycleEffect(deps, effect);
			return;
		}
		case "deleted": {
			const existing = await deps.tracks.findByPath(event.path);
			const effect = resolveVaultFileDeleted(existing?.status ?? null);
			if (effect.kind === "remove") {
				await deps.tracks.deleteByPath(event.path);
			}
			return;
		}
		case "renamed": {
			const hasExistingRow = (await deps.tracks.findByPath(event.oldPath)) !== null;
			const effect = resolveVaultFileRenamed(hasExistingRow, {
				oldPath: event.oldPath,
				newPath: event.newPath,
				mtimeMs: event.mtimeMs,
			});
			await applyFileLifecycleEffect(deps, effect);
			return;
		}
		case "modified": {
			const existing = await deps.tracks.findByPath(event.path);
			const contentChanged = resolveModifyContentChanged(
				existing?.mtimeMs ?? null,
				event.mtimeMs,
			);
			const resolution = resolveVaultFileModified(existing?.status ?? null, {
				path: event.path,
				mtimeMs: event.mtimeMs,
				contentChanged,
			});
			if (!resolution.ok) {
				await logDomainFailure(log, "incremental modify rejected", resolution.error);
				return;
			}
			const { effect, nextStatus } = resolution.value;
			await applyFileLifecycleEffect(deps, effect);
			if (nextStatus !== undefined) {
				await deps.tracks.updateStatus(event.path, nextStatus);
				await enqueueIndexJob(deps, event.path);
			}
			return;
		}
		default: {
			const _exhaustive: never = event;
			return _exhaustive;
		}
	}
}

/** Vault event handler wired from composition (0.3-09). */
export function createIncrementalVaultTrackEventHandler(
	deps: RunIncrementalIndexDeps,
): VaultTrackEventHandlerPort {
	return {
		handleVaultTrackEvent: (event) => handleVaultTrackEvent(deps, event),
	};
}
