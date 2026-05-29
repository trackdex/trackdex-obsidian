/**
 * FIT parser spike gate (0.1-04). Keep `false` in committed builds so production
 * does not bundle parser candidates until 0.4.
 */
export const ENABLE_FIT_PARSER_SPIKE = true;

export type FitParserSpikeBackend = "fit-file-parser" | "garmin-sdk";

export const DEFAULT_FIT_PARSER_SPIKE_BACKEND: FitParserSpikeBackend =
	"fit-file-parser";
