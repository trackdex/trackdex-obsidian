import type { LoggerPort } from "application/ports/logger-port";
import type { PlaceRepository } from "application/ports/repositories";
import type { PlaceNotePath } from "domain/place/place-record";
import type { DomainError } from "domain/shared/errors";
import type { Result } from "domain/shared/result";
import { ok } from "domain/shared/result";

export interface PlaceReindexResult {
	readonly placesProcessed: number;
}

/** Recalculates track↔place relations from place notes (§10.3). */
export interface PlaceReindexService {
	reindexAll(): Promise<Result<PlaceReindexResult, DomainError>>;
	reindexPlace(notePath: PlaceNotePath): Promise<Result<void, DomainError>>;
}

export interface PlaceReindexServiceDeps {
	readonly logger: LoggerPort;
	readonly places: PlaceRepository;
}

export function createPlaceReindexService(deps: PlaceReindexServiceDeps): PlaceReindexService {
	const log = deps.logger.child?.({ service: "place-reindex" }) ?? deps.logger;

	return {
		async reindexAll(): Promise<Result<PlaceReindexResult, DomainError>> {
			log.info("reindexAll (stub)");
			await deps.places.listValid();
			return ok({ placesProcessed: 0 });
		},

		async reindexPlace(notePath: PlaceNotePath): Promise<Result<void, DomainError>> {
			log.info("reindexPlace (stub)", { notePath });
			await deps.places.findByNotePath(notePath);
			return ok(undefined);
		},
	};
}
