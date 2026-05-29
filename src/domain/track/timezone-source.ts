/** How UTC timestamps were derived for a track (§9). */
export type TimezoneSource = "explicit" | "indexing_local" | "unknown";

export const TIMEZONE_SOURCES: readonly TimezoneSource[] = [
	"explicit",
	"indexing_local",
	"unknown",
] as const;
