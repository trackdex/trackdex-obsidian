import type { ParsedTrack } from "domain/track/parsed-track";
import type { TimezoneSource } from "domain/track/timezone-source";

/** Minutes east of UTC at indexing time (e.g. +60 for UTC+1). */
export interface TimeNormalizationContext {
	readonly indexingOffsetMin: number;
}

/** Normalized instant with raw preservation and UTC storage (§9). */
export interface NormalizedTimestamp {
	readonly raw: string | null;
	readonly utcIso: string | null;
	readonly timezoneSource: TimezoneSource;
	readonly timezoneOffsetMin: number | null;
}

/** Track-level start/end bounds after timezone normalization. */
export interface NormalizedTrackTimes {
	readonly startedAtRaw: string | null;
	readonly endedAtRaw: string | null;
	readonly startedAtUtc: string | null;
	readonly endedAtUtc: string | null;
	readonly timezoneSource: TimezoneSource;
	readonly timezoneOffsetMin: number | null;
}

const EXPLICIT_TZ_SUFFIX = /(?:Z|[+-]\d{2}(?::?\d{2})?(?::?\d{2})?)$/i;
const NAIVE_ISO_PATTERN =
	/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/;
const EXPLICIT_OFFSET_PATTERN = /([+-])(\d{2})(?::?(\d{2}))?(?::?(\d{2}))?$/;

function trimRaw(raw: string | null | undefined): string | null {
	if (raw == null) {
		return null;
	}
	const trimmed = raw.trim();
	return trimmed.length > 0 ? trimmed : null;
}

function hasExplicitTimezone(raw: string): boolean {
	return EXPLICIT_TZ_SUFFIX.test(raw.trim());
}

function parseExplicitOffsetMin(raw: string): number | null {
	const trimmed = raw.trim();
	if (/Z$/i.test(trimmed)) {
		return 0;
	}

	const match = trimmed.match(EXPLICIT_OFFSET_PATTERN);
	if (!match) {
		return null;
	}

	const sign = match[1] === "-" ? -1 : 1;
	const hours = Number(match[2]);
	const minutes = match[3] ? Number(match[3]) : 0;
	const seconds = match[4] ? Number(match[4]) : 0;

	if (
		Number.isNaN(hours) ||
		Number.isNaN(minutes) ||
		Number.isNaN(seconds) ||
		minutes >= 60 ||
		seconds >= 60
	) {
		return null;
	}

	return sign * (hours * 60 + minutes + Math.trunc(seconds / 60));
}

function parseExplicitToUtcMs(raw: string): number | null {
	const parsed = Date.parse(raw.trim());
	if (Number.isNaN(parsed)) {
		return null;
	}
	return parsed;
}

function parseNaiveLocalToUtcMs(raw: string, indexingOffsetMin: number): number | null {
	const match = raw.trim().match(NAIVE_ISO_PATTERN);
	if (!match) {
		return null;
	}

	const year = Number(match[1]);
	const month = Number(match[2]);
	const day = Number(match[3]);
	const hour = Number(match[4]);
	const minute = Number(match[5]);
	const second = match[6] ? Number(match[6]) : 0;
	const fractionMs = match[7] ? Number(match[7].padEnd(3, "0")) : 0;

	if (
		[year, month, day, hour, minute, second, fractionMs].some(Number.isNaN) ||
		month < 1 ||
		month > 12 ||
		day < 1 ||
		day > 31 ||
		hour > 23 ||
		minute > 59 ||
		second > 59
	) {
		return null;
	}

	const localAsUtcMs = Date.UTC(
		year,
		month - 1,
		day,
		hour,
		minute,
		second,
		fractionMs,
	);
	return localAsUtcMs - indexingOffsetMin * 60_000;
}

function utcMsToIso(utcMs: number): string {
	return new Date(utcMs).toISOString();
}

function unknownTimestamp(raw: string | null): NormalizedTimestamp {
	return {
		raw,
		utcIso: null,
		timezoneSource: "unknown",
		timezoneOffsetMin: null,
	};
}

/** Normalize one timestamp string per §9 rules. */
export function normalizeTimestamp(
	raw: string | null | undefined,
	context: TimeNormalizationContext,
): NormalizedTimestamp {
	const trimmed = trimRaw(raw);
	if (trimmed === null) {
		return unknownTimestamp(null);
	}

	if (hasExplicitTimezone(trimmed)) {
		const offsetMin = parseExplicitOffsetMin(trimmed);
		const utcMs = parseExplicitToUtcMs(trimmed);
		if (offsetMin === null || utcMs === null) {
			return unknownTimestamp(trimmed);
		}
		return {
			raw: trimmed,
			utcIso: utcMsToIso(utcMs),
			timezoneSource: "explicit",
			timezoneOffsetMin: offsetMin,
		};
	}

	const utcMs = parseNaiveLocalToUtcMs(trimmed, context.indexingOffsetMin);
	if (utcMs === null) {
		return unknownTimestamp(trimmed);
	}

	return {
		raw: trimmed,
		utcIso: utcMsToIso(utcMs),
		timezoneSource: "indexing_local",
		timezoneOffsetMin: context.indexingOffsetMin,
	};
}

function resolveStartedAtRaw(track: Pick<ParsedTrack, "startedAtRaw" | "points">): string | null {
	return trimRaw(track.startedAtRaw) ?? trimRaw(track.points[0]?.timestampRaw ?? null);
}

function resolveEndedAtRaw(
	track: Pick<ParsedTrack, "endedAtRaw" | "points">,
): string | null {
	const fromTrack = trimRaw(track.endedAtRaw);
	if (fromTrack !== null) {
		return fromTrack;
	}
	for (let index = track.points.length - 1; index >= 0; index -= 1) {
		const candidate = trimRaw(track.points[index]?.timestampRaw ?? null);
		if (candidate !== null) {
			return candidate;
		}
	}
	return null;
}

/** Normalize track start/end bounds from {@link ParsedTrack} raw timestamps. */
export function normalizeTrackTimes(
	track: Pick<ParsedTrack, "startedAtRaw" | "endedAtRaw" | "points">,
	context: TimeNormalizationContext,
): NormalizedTrackTimes {
	const startedAtRaw = resolveStartedAtRaw(track);
	const endedAtRaw = resolveEndedAtRaw(track);
	const started = normalizeTimestamp(startedAtRaw, context);
	const ended = normalizeTimestamp(endedAtRaw, context);

	const primary = startedAtRaw !== null ? started : ended;

	return {
		startedAtRaw,
		endedAtRaw,
		startedAtUtc: started.utcIso,
		endedAtUtc: ended.utcIso,
		timezoneSource: primary.timezoneSource,
		timezoneOffsetMin: primary.timezoneOffsetMin,
	};
}
