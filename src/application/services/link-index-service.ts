import type { LoggerPort } from "application/ports/logger-port";
import type { NoteLinkRepository } from "application/ports/repositories";
import type { NotePath } from "domain/links/note-track-link";
import type { DomainError } from "domain/shared/errors";
import type { Result } from "domain/shared/result";
import { ok } from "domain/shared/result";

export interface LinkIndexResult {
	readonly notesProcessed: number;
}

/** Maintains markdown wikilink index for tracks (§11). */
export interface LinkIndexService {
	reindexAll(): Promise<Result<LinkIndexResult, DomainError>>;
	reindexNote(notePath: NotePath): Promise<Result<void, DomainError>>;
}

export interface LinkIndexServiceDeps {
	readonly logger: LoggerPort;
	readonly noteLinks: NoteLinkRepository;
}

export function createLinkIndexService(deps: LinkIndexServiceDeps): LinkIndexService {
	const log = deps.logger.child?.({ service: "link-index" }) ?? deps.logger;

	return {
		async reindexAll(): Promise<Result<LinkIndexResult, DomainError>> {
			log.info("reindexAll (stub)");
			return ok({ notesProcessed: 0 });
		},

		async reindexNote(notePath: NotePath): Promise<Result<void, DomainError>> {
			log.info("reindexNote (stub)", { notePath });
			await deps.noteLinks.listByNotePath(notePath);
			return ok(undefined);
		},
	};
}
