import type { ClockPort } from "application/ports/clock-port";
import type { TimeNormalizationContext } from "domain/track/time-normalization";

/** Local offset at indexing time for naive timestamps (§9). */
export function createTimeNormalizationContext(
	clock: ClockPort,
): TimeNormalizationContext {
	return {
		indexingOffsetMin: -new Date(clock.nowMs()).getTimezoneOffset(),
	};
}
