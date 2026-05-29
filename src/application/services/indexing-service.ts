import type { IndexMetaRepository } from "application/ports/repositories";
import type { LoggerPort } from "application/ports/logger-port";
import { resumeAfterInterrupt as runResumeAfterInterrupt } from "application/workflows/resume-after-interrupt";
import type { DomainError } from "domain/shared/errors";
import type { Result } from "domain/shared/result";
import { ok } from "domain/shared/result";

export interface IndexingScanResult {
	readonly enqueued: number;
}

/** Orchestrates vault track discovery and parse pipeline (§7). */
export interface IndexingService {
	approveFirstScan(): Promise<void>;
	scanTracksFolder(rootFolder: string): Promise<Result<IndexingScanResult, DomainError>>;
	pauseIndexing(): Promise<void>;
	resumeIndexing(): Promise<void>;
	beginScanRun(): Promise<void>;
	completeScanRun(): Promise<void>;
	markInterruptedIfScanActive(): Promise<void>;
	resumeAfterInterrupt(): Promise<void>;
}

/** Full vault scan hook; real workflow in 0.3-08 (`full-scan.ts`). */
export type EnqueueFullScan = () => Promise<void>;

export interface IndexingServiceDeps {
	readonly logger: LoggerPort;
	readonly indexMeta: IndexMetaRepository;
	readonly enqueueFullScan?: EnqueueFullScan;
}

export function createIndexingService(deps: IndexingServiceDeps): IndexingService {
	const log = deps.logger.child?.({ service: "indexing" }) ?? deps.logger;
	let scanRunActive = false;

	return {
		async approveFirstScan(): Promise<void> {
			const meta = await deps.indexMeta.get();
			if (meta.firstScanApproved) {
				return;
			}
			await deps.indexMeta.update({ firstScanApproved: true });
			log.info("first scan approved");
			if (deps.enqueueFullScan) {
				await deps.enqueueFullScan();
			} else {
				log.info("enqueueFullScan not wired (0.3-08)");
			}
		},

		async scanTracksFolder(rootFolder: string): Promise<Result<IndexingScanResult, DomainError>> {
			log.info("scanTracksFolder (stub)", { rootFolder });
			return ok({ enqueued: 0 });
		},

		async pauseIndexing(): Promise<void> {
			log.info("pauseIndexing (stub)");
			await deps.indexMeta.update({ scanPaused: true });
		},

		async resumeIndexing(): Promise<void> {
			log.info("resumeIndexing (stub)");
			await deps.indexMeta.update({ scanPaused: false });
		},

		async beginScanRun(): Promise<void> {
			scanRunActive = true;
			log.info("scan run started");
		},

		async completeScanRun(): Promise<void> {
			scanRunActive = false;
			await deps.indexMeta.update({ lastRunInterrupted: false });
			log.info("scan run completed");
		},

		async markInterruptedIfScanActive(): Promise<void> {
			if (!scanRunActive) {
				return;
			}
			scanRunActive = false;
			await deps.indexMeta.update({ lastRunInterrupted: true });
			log.info("indexing run marked interrupted (unsafe shutdown)");
		},

		async resumeAfterInterrupt(): Promise<void> {
			await runResumeAfterInterrupt({
				indexMeta: deps.indexMeta,
				enqueueFullScan: deps.enqueueFullScan,
				logger: log,
			});
		},
	};
}
