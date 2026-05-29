import type { ClockPort } from "application/ports/clock-port";

export function createSystemClockPort(): ClockPort {
	return {
		nowMs: () => Date.now(),
		nowUtcIso: () => new Date().toISOString(),
	};
}
