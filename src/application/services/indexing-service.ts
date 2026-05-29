import type { IndexMetaRepository } from "application/ports/repositories";
import type { LoggerPort } from "application/ports/logger-port";
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
}

export interface IndexingServiceDeps {
	readonly logger: LoggerPort;
	readonly indexMeta: IndexMetaRepository;
}

export function createIndexingService(deps: IndexingServiceDeps): IndexingService {
	const log = deps.logger.child?.({ service: "indexing" }) ?? deps.logger;

	return {
		async approveFirstScan(): Promise<void> {
			log.info("approveFirstScan (stub)");
			await deps.indexMeta.update({ firstScanApproved: true });
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
	};
}
