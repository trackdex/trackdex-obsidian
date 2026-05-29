import {
	createBoundedWorkQueue,
	resolveScanConcurrency,
	type BoundedWorkQueue,
} from "application/indexing/work-queue";
import type { ClockPort } from "application/ports/clock-port";
import type { LoggerPort } from "application/ports/logger-port";
import type { IndexMetaRepository, TrackRepository } from "application/ports/repositories";
import type { VaultScannerPort } from "application/ports/vault-scanner-port";
import {
	initialDiscoveredFileStatus,
	transitionFileStatus,
} from "domain/track/file-status";
import type { TrackPath } from "domain/track/track-record";
import type { TrackStatus } from "domain/track/track-status";

export interface FullScanResult {
	readonly discovered: number;
	readonly registered: number;
	readonly enqueued: number;
}

/** Per-file index job; real parser pipeline lands in milestone 0.4. */
export type IndexTrackFileJob = (path: TrackPath) => Promise<void>;

export interface RunFullScanDeps {
	readonly scanner: VaultScannerPort;
	readonly tracks: TrackRepository;
	readonly indexMeta: IndexMetaRepository;
	readonly clock: ClockPort;
	readonly queue: BoundedWorkQueue;
	readonly indexTrackFile?: IndexTrackFileJob;
	readonly isScanPaused?: () => Promise<boolean>;
	readonly logger?: LoggerPort;
}

const INDEXABLE_STATUSES: readonly TrackStatus[] = [
	"pending",
	"stale",
	"error",
	"indexing",
];

function isIndexableStatus(status: TrackStatus): boolean {
	return INDEXABLE_STATUSES.includes(status);
}

function createStubIndexTrackJob(logger?: LoggerPort): IndexTrackFileJob {
	const log = logger?.child?.({ job: "index-track-stub" }) ?? logger;
	return async (path: TrackPath): Promise<void> => {
		log?.debug("index track job stubbed until 0.4", { path });
	};
}

/**
 * Full vault scan (§7.2): discover supported files, register new rows as `pending`,
 * enqueue bounded index jobs, then persist `last_full_scan_at_utc`.
 */
export async function runFullScan(deps: RunFullScanDeps): Promise<FullScanResult> {
	const log = deps.logger?.child?.({ workflow: "full-scan" }) ?? deps.logger;
	const indexTrackFile = deps.indexTrackFile ?? createStubIndexTrackJob(log);

	if (deps.isScanPaused && (await deps.isScanPaused())) {
		log?.info("full scan skipped: indexing paused");
		return { discovered: 0, registered: 0, enqueued: 0 };
	}

	const discovered = await deps.scanner.listTrackFiles();
	log?.info("full scan discovered track files", { count: discovered.length });

	const pathsToIndex: TrackPath[] = [];
	let registered = 0;

	for (const file of discovered) {
		if (deps.isScanPaused && (await deps.isScanPaused())) {
			log?.info("full scan discovery stopped: indexing paused");
			break;
		}

		const existing = await deps.tracks.findByPath(file.path);
		if (existing === null) {
			await deps.tracks.insertDiscovered({
				path: file.path,
				mtimeMs: file.mtimeMs,
				status: initialDiscoveredFileStatus(),
			});
			registered += 1;
			pathsToIndex.push(file.path);
			continue;
		}

		if (existing.status === "indexed" && existing.mtimeMs !== file.mtimeMs) {
			const transitioned = transitionFileStatus(existing.status, "content_changed");
			if (transitioned.ok) {
				await deps.tracks.updateStatus(file.path, transitioned.value);
				pathsToIndex.push(file.path);
			}
			continue;
		}

		if (isIndexableStatus(existing.status)) {
			pathsToIndex.push(file.path);
		}
	}

	const tasks = pathsToIndex.map(
		(path) => (): Promise<void> => indexTrackFile(path),
	);
	await deps.queue.runMany(tasks);
	await deps.queue.whenIdle();

	await deps.indexMeta.update({
		lastFullScanAtUtc: deps.clock.nowUtcIso(),
	});

	log?.info("full scan completed", {
		discovered: discovered.length,
		registered,
		enqueued: pathsToIndex.length,
	});

	return {
		discovered: discovered.length,
		registered,
		enqueued: pathsToIndex.length,
	};
}

export interface CreateFullScanQueueOptions {
	readonly isMobile: boolean;
}

/** Shared bounded queue factory for composition (§7.2 concurrency). */
export function createFullScanWorkQueue(
	options: CreateFullScanQueueOptions,
): BoundedWorkQueue {
	return createBoundedWorkQueue({
		concurrency: resolveScanConcurrency(options.isMobile),
	});
}
