import type { LogFields, LoggerPort } from "application/ports/logger-port";

/** No-op logger until rotating file logger lands in 0.2. */
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
