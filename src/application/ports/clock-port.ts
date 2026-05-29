/**
 * Injectable time source for deterministic tests and timezone normalization (§9).
 * Listed in TECHNICAL_DESIGN module layout; use when indexing-local offset is needed.
 */
export interface ClockPort {
	/** Current instant as Unix epoch milliseconds. */
	nowMs(): number;
	/** Current instant as ISO-8601 UTC string. */
	nowUtcIso(): string;
}
