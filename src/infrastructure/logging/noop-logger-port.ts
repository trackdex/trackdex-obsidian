import type { LogFields, LoggerPort } from "application/ports/logger-port";

/** No-op logger for composition until file logger is wired in 0.2-09. */
export function createNoopLoggerPort(): LoggerPort {
	const noop = (_message: string, _fields?: LogFields): void => {};
	return {
		debug: noop,
		info: noop,
		warn: noop,
		error: noop,
		child: () => createNoopLoggerPort(),
	};
}
