import type { ParseTrackInput, TrackParserPort } from "application/ports/parser-port";
import { domainError } from "domain/shared/errors";
import { err } from "domain/shared/result";
import { gunzipFit } from "./candidates/gunzip";
import { createFitParserPort } from "./fit-parser";

export interface FitGzParserDeps {
	readonly fit: TrackParserPort;
}

/** Production `.fit.gz` adapter: gunzip via `DecompressionStream`, then FIT parse. */
export function createFitGzParserPort(
	deps: FitGzParserDeps = { fit: createFitParserPort() },
): TrackParserPort {
	return {
		parse: async (input: ParseTrackInput) => {
			try {
				const decompressed = await gunzipFit(input.content);
				return deps.fit.parse({
					...input,
					extension: "fit",
					content: decompressed,
				});
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				return err(domainError("parse_failed", message, error));
			}
		},
	};
}
