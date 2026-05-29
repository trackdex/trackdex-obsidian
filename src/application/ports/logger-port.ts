/** Log severity aligned with local rotating file logger (§13). */
export type LogLevel = "debug" | "info" | "warn" | "error";

/** Structured fields attached to a log line (JSON-serializable values). */
export type LogFields = Record<string, string | number | boolean | null>;

/**
 * Structured logging without rotation policy (adapter owns §13 rotation).
 */
export interface LoggerPort {
	debug(message: string, fields?: LogFields): void;
	info(message: string, fields?: LogFields): void;
	warn(message: string, fields?: LogFields): void;
	error(message: string, fields?: LogFields): void;
	/** Optional child logger with bound context (e.g. run_id, track path). */
	child?(fields: LogFields): LoggerPort;
}
