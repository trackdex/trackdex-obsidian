import type { TrackParserPort } from "application/ports/parser-port";
import { domainError } from "domain/shared/errors";
import { err } from "domain/shared/result";

/** Placeholder parser until GPX/TCX/FIT adapters are wired in later milestones. */
export function createNoopTrackParserPort(): TrackParserPort {
	return {
		parse: async () =>
			err(domainError("parse_failed", "Track parser not implemented")),
	};
}
