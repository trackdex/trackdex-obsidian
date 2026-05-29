import type { ParseTrackInput, TrackParserPort } from "application/ports/parser-port";
import { domainError } from "domain/shared/errors";
import { err } from "domain/shared/result";
import type { TrackFileExtension } from "domain/track/parsed-track";
import { normalizeTrackFileExtension } from "domain/track/track-file-extension";
import { createTcxParserPort } from "./tcx-parser";

/** Per-format parsers wired into {@link createParserRouter}. */
export interface ParserRouterDeps {
	readonly gpx: TrackParserPort;
	readonly tcx: TrackParserPort;
	readonly fit: TrackParserPort;
	readonly fitGz: TrackParserPort;
}

const ROUTE_BY_EXTENSION: Record<
	TrackFileExtension,
	keyof ParserRouterDeps
> = {
	gpx: "gpx",
	tcx: "tcx",
	fit: "fit",
	"fit.gz": "fitGz",
};

/**
 * Routes parse requests to format-specific {@link TrackParserPort} implementations.
 * Extension matching is case-insensitive.
 */
export function createParserRouter(deps: ParserRouterDeps): TrackParserPort {
	return {
		parse: async (input: ParseTrackInput) => {
			const extension = normalizeTrackFileExtension(input.extension);
			if (extension === null) {
				return err(
					domainError(
						"unsupported_extension",
						`Unsupported track file extension: ${input.extension}`,
					),
				);
			}
			const parser = deps[ROUTE_BY_EXTENSION[extension]];
			return parser.parse({ ...input, extension });
		},
	};
}

function createUnimplementedFormatParserPort(
	format: TrackFileExtension,
): TrackParserPort {
	return {
		parse: async () =>
			err(domainError("parse_failed", `${format} parser not implemented`)),
	};
}

/** Default router with TCX adapter; GPX/FIT/FIT.GZ stubs until 0.4-02 / 0.4-04–0.4-05 land. */
export function createDefaultParserRouter(): TrackParserPort {
	return createParserRouter({
		gpx: createUnimplementedFormatParserPort("gpx"),
		tcx: createTcxParserPort(),
		fit: createUnimplementedFormatParserPort("fit"),
		fitGz: createUnimplementedFormatParserPort("fit.gz"),
	});
}