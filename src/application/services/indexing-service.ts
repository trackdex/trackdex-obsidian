import { createScanProgress, type ScanProgressStore } from "application/indexing/scan-progress";
import type { BoundedWorkQueue } from "application/indexing/work-queue";
import type { ClockPort } from "application/ports/clock-port";
import type { LoggerPort } from "application/ports/logger-port";
import type { IndexMetaRepository, TrackRepository } from "application/ports/repositories";
import type { VaultScannerPort } from "application/ports/vault-scanner-port";
import {
	runFullScan,
	type IndexTrackFileJob,
} from "application/workflows/full-scan";
import { resumeAfterInterrupt as runResumeAfterInterrupt } from "application/workflows/resume-after-interrupt";
import type { DomainError } from "domain/shared/errors";
import type { Result } from "domain/shared/result";
import { ok } from "domain/shared/result";

export interface IndexingScanResult {
	readonly enqueued: number;
}

/** Orchestrates vault track discovery and parse pipeline (§7). */
export interface IndexingService {
	readonly scanProgress: ScanProgressStore;
	approveFirstScan(): Promise<void>;
	scanTracksFolder(rootFolder: string): Promise<Result<IndexingScanResult, DomainError>>;
	pauseIndexing(): Promise<void>;
	resumeIndexing(): Promise<void>;
	scanOrResumeIndexing(): Promise<void>;
	beginScanRun(): Promise<void>;
	completeScanRun(): Promise<void>;
	markInterruptedIfScanActive(): Promise<void>;
	resumeAfterInterrupt(): Promise<void>;
}

/** Full vault scan hook passed to resume-after-interrupt workflow. */
export type EnqueueFullScan = () => Promise<void>;

export interface IndexingServiceDeps {
	readonly logger: LoggerPort;
	readonly indexMeta: IndexMetaRepository;
	readonly tracks: TrackRepository;
	readonly clock: ClockPort;
	readonly queue: BoundedWorkQueue;
	readonly createScanner: () => VaultScannerPort;
	readonly indexTrackFile?: IndexTrackFileJob;
}

export function createIndexingService(deps: IndexingServiceDeps): IndexingService {
	const log = deps.logger.child?.({ service: "indexing" }) ?? deps.logger;
	const scanProgress = createScanProgress();
	let scanRunActive = false;

	const isScanPaused = async (): Promise<boolean> =>
		(await deps.indexMeta.get()).scanPaused;

	const enqueueFullScan: EnqueueFullScan = async (): Promise<void> => {
		await service.beginScanRun();
		try {
			await runFullScan({
				scanner: deps.createScanner(),
				tracks: deps.tracks,
				indexMeta: deps.indexMeta,
				clock: deps.clock,
				queue: deps.queue,
				scanProgress,
				indexTrackFile: deps.indexTrackFile,
				isScanPaused,
				logger: log,
			});
		} finally {
			await service.completeScanRun();
		}
	};

	const service: IndexingService = {
		scanProgress,

		async approveFirstScan(): Promise<void> {
			const meta = await deps.indexMeta.get();
			if (meta.firstScanApproved) {
				return;
			}
			await deps.indexMeta.update({ firstScanApproved: true });
			log.info("first scan approved");
			await enqueueFullScan();
		},

		async scanTracksFolder(rootFolder: string): Promise<Result<IndexingScanResult, DomainError>> {
			log.info("scanTracksFolder (stub)", { rootFolder });
			return ok({ enqueued: 0 });
		},

		async pauseIndexing(): Promise<void> {
			await deps.indexMeta.update({ scanPaused: true });
			log.info("indexing paused");
		},

		async resumeIndexing(): Promise<void> {
			await deps.indexMeta.update({ scanPaused: false });
			log.info("indexing resumed");
		},

		async scanOrResumeIndexing(): Promise<void> {
			if (scanRunActive) {
				log.info("scanOrResumeIndexing skipped: scan already active");
				return;
			}
			const meta = await deps.indexMeta.get();
			if (meta.lastRunInterrupted) {
				await service.resumeAfterInterrupt();
				return;
			}
			if (meta.scanPaused) {
				log.info("scanOrResumeIndexing skipped: indexing paused");
				return;
			}
			await enqueueFullScan();
		},

		async beginScanRun(): Promise<void> {
			scanRunActive = true;
			// Write-ahead: persist before scan work so force-quit / sync onunload need not
			// await async I/O (Obsidian onunload is synchronous).
			await deps.indexMeta.update({ lastRunInterrupted: true });
			log.info("scan run started");
		},

		async completeScanRun(): Promise<void> {
			if (!scanRunActive) {
				return;
			}
			scanRunActive = false;
			await deps.indexMeta.update({ lastRunInterrupted: false });
			log.info("scan run completed");
		},

		async markInterruptedIfScanActive(): Promise<void> {
			if (!scanRunActive) {
				return;
			}
			scanRunActive = false;
			log.info("indexing run marked interrupted (unsafe shutdown)");
		},

		async resumeAfterInterrupt(): Promise<void> {
			await runResumeAfterInterrupt({
				indexMeta: deps.indexMeta,
				enqueueFullScan,
				logger: log,
			});
		},
	};

	return service;
}
