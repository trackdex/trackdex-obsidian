import type { DomainError } from "domain/shared/errors";
import type { Result } from "domain/shared/result";
import type {
	ParsedTrack,
	TrackFileExtension,
} from "domain/track/parsed-track";
import type { TrackPath } from "domain/track/track-record";

/** Input to parse a vault track file (raw bytes; format from extension). */
export interface ParseTrackInput {
	readonly vaultRelativePath: TrackPath;
	readonly extension: TrackFileExtension;
	readonly content: Uint8Array;
}

/**
 * Parses track files into the unified intermediate model (§7.4 step 2–3).
 * Implementations live in `infrastructure/parsers/` (GPX/TCX/FIT adapters).
 */
export interface TrackParserPort {
	parse(input: ParseTrackInput): Promise<Result<ParsedTrack, DomainError>>;
}
