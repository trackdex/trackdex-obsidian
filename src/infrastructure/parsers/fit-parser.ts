import FitParser from "fit-file-parser";
import type { ParseTrackInput, TrackParserPort } from "application/ports/parser-port";
import { domainError } from "domain/shared/errors";
import { err, ok } from "domain/shared/result";
import { mapFitFileParserToParsedTrack } from "./candidates/map-to-parsed-track";

/** Production `.fit` adapter backed by `fit-file-parser` (§2.5). */
export function createFitParserPort(): TrackParserPort {
	return {
		parse: async (input: ParseTrackInput) => {
			try {
				const bytes = input.content;
				const parser = new FitParser({ force: true, mode: "both" });
				const parsed = await parser.parseAsync(
					bytes.buffer.slice(
						bytes.byteOffset,
						bytes.byteOffset + bytes.byteLength,
					),
				);
				const track = mapFitFileParserToParsedTrack(
					parsed as Parameters<typeof mapFitFileParserToParsedTrack>[0],
				);
				if (track.points.length === 0) {
					return err(
						domainError("parse_failed", "No GPS points in FIT file."),
					);
				}
				return ok(track);
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				return err(domainError("parse_failed", message, error));
			}
		},
	};
}
