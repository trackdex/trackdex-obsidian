import type { App, Plugin } from "obsidian";
import type { LogFields, LogLevel, LoggerPort } from "application/ports/logger-port";
import { getPluginDataDir } from "../storage/candidates/obsidian-binary-io";
import {
	LOG_FILE_BASENAME,
	LOG_MAX_BYTES,
	LOG_MAX_FILES,
	LOGS_SUBDIR,
	buildRotationSteps,
	needsRotationBeforeAppend,
} from "./log-rotation";

/** Binary I/O in plugin data dir (vault.adapter; not vault content paths). */
export interface LogFileIo {
	exists(path: string): Promise<boolean>;
	statSize(path: string): Promise<number>;
	read(path: string): Promise<Uint8Array | null>;
	write(path: string, data: Uint8Array): Promise<void>;
	remove(path: string): Promise<void>;
	rename(from: string, to: string): Promise<void>;
	mkdir(dir: string): Promise<void>;
}

/** Serializes async log writes (shared by root and child loggers). */
export interface LogWriteQueue {
	tail: Promise<void>;
}

export interface RotatingFileLoggerConfig {
	readonly logsDir: string;
	readonly io: LogFileIo;
	readonly maxFiles?: number;
	readonly maxBytes?: number;
	readonly basename?: string;
	readonly boundFields?: LogFields;
	readonly onIoError?: (err: unknown) => void;
	readonly writeQueue?: LogWriteQueue;
	/** Child loggers set this to avoid duplicate mkdir / lifecycle lines. */
	readonly skipInit?: boolean;
}

export function formatLogLine(
	level: LogLevel,
	message: string,
	fields?: LogFields,
): string {
	const record: Record<string, string | number | boolean | null> = {
		ts: new Date().toISOString(),
		level,
		msg: message,
	};
	if (fields) {
		for (const [key, value] of Object.entries(fields)) {
			record[key] = value;
		}
	}
	return JSON.stringify(record);
}

export function createObsidianLogFileIo(app: App): LogFileIo {
	const adapter = app.vault.adapter;
	return {
		exists: (path) => adapter.exists(path),
		statSize: async (path) => {
			const stat = await adapter.stat(path);
			return stat?.size ?? 0;
		},
		read: async (path) => {
			if (!(await adapter.exists(path))) {
				return null;
			}
			const buffer = await adapter.readBinary(path);
			return new Uint8Array(buffer);
		},
		write: async (path, data) => {
			const buffer = data.buffer.slice(
				data.byteOffset,
				data.byteOffset + data.byteLength,
			);
			await adapter.writeBinary(path, buffer);
		},
		remove: (path) => adapter.remove(path),
		rename: (from, to) => adapter.rename(from, to),
		mkdir: async (dir) => {
			if (!(await adapter.exists(dir))) {
				await adapter.mkdir(dir);
			}
		},
	};
}

async function executeRotation(
	io: LogFileIo,
	logsDir: string,
	basename: string,
	maxFiles: number,
): Promise<void> {
	const steps = buildRotationSteps(logsDir, basename, maxFiles);
	for (const step of steps) {
		if (step.op === "remove") {
			if (await io.exists(step.path)) {
				await io.remove(step.path);
			}
			continue;
		}
		if (await io.exists(step.from)) {
			await io.rename(step.from, step.to);
		}
	}
}

export async function appendLogEntry(
	config: RotatingFileLoggerConfig,
	entry: Uint8Array,
): Promise<void> {
	const maxFiles = config.maxFiles ?? LOG_MAX_FILES;
	const maxBytes = config.maxBytes ?? LOG_MAX_BYTES;
	const basename = config.basename ?? LOG_FILE_BASENAME;
	const activePath = `${config.logsDir}/${basename}`;

	let currentSize = (await config.io.exists(activePath))
		? await config.io.statSize(activePath)
		: 0;

	if (needsRotationBeforeAppend(currentSize, entry.length, maxBytes)) {
		await executeRotation(config.io, config.logsDir, basename, maxFiles);
		currentSize = 0;
	}

	if (currentSize > 0) {
		const existing = await config.io.read(activePath);
		const merged = new Uint8Array(currentSize + entry.length);
		merged.set(existing ?? new Uint8Array(0), 0);
		merged.set(entry, currentSize);
		await config.io.write(activePath, merged);
		return;
	}

	await config.io.write(activePath, entry);
}

/** Logger port plus drain for plugin unload (0.2-09). */
export interface RotatingFileLoggerHandle {
	readonly port: LoggerPort;
	flush(): Promise<void>;
}

/**
 * Rotating file logger (§13: 5 × 1 MB) under plugin data dir only.
 * Writes are serialized asynchronously; `LoggerPort` methods return immediately.
 */
export function createRotatingFileLoggerPort(plugin: Plugin): LoggerPort {
	return createRotatingFileLoggerHandle(plugin).port;
}

/** Composition wiring: shared write queue so unload can await pending log I/O. */
export function createRotatingFileLoggerHandle(plugin: Plugin): RotatingFileLoggerHandle {
	const writeQueue: LogWriteQueue = { tail: Promise.resolve() };
	const io = createObsidianLogFileIo(plugin.app);
	const logsDir = `${getPluginDataDir(plugin)}/${LOGS_SUBDIR}`;
	const onIoError =
		(err: unknown): void => {
			const message = err instanceof Error ? err.message : String(err);
			console.error(`Trackdex log write failed: ${message}`);
		};

	const port = createRotatingFileLoggerPortFromConfig({
		io,
		logsDir,
		onIoError,
		writeQueue,
	});

	return {
		port,
		flush: () => writeQueue.tail,
	};
}

/** Factory for tests and composition wiring (0.2-09). */
export function createRotatingFileLoggerPortFromConfig(
	config: RotatingFileLoggerConfig,
): LoggerPort {
	const writeQueue = config.writeQueue ?? { tail: Promise.resolve() };
	const baseConfig: RotatingFileLoggerConfig = { ...config, writeQueue };
	let ready: Promise<void> | null = null;

	const enqueue = (task: () => Promise<void>): void => {
		writeQueue.tail = writeQueue.tail
			.then(task)
			.catch((err: unknown) => {
				config.onIoError?.(err);
			});
	};

	const ensureReady = (): void => {
		if (baseConfig.skipInit) {
			return;
		}
		if (!ready) {
			ready = baseConfig.io.mkdir(baseConfig.logsDir).then(() => {
				const line = formatLogLine("info", "lifecycle: logger ready", {
					logsDir: baseConfig.logsDir,
				});
				return appendLogEntry(baseConfig, new TextEncoder().encode(`${line}\n`));
			});
			enqueue(() => ready ?? Promise.resolve());
		}
	};

	const write = (level: LogLevel, message: string, fields?: LogFields): void => {
		ensureReady();
		const merged: LogFields = { ...config.boundFields, ...fields };
		const hasFields = Object.keys(merged).length > 0;
		const line = formatLogLine(level, message, hasFields ? merged : undefined);
		const entry = new TextEncoder().encode(`${line}\n`);
		enqueue(() => appendLogEntry(baseConfig, entry));
	};

	const port: LoggerPort = {
		debug: (message, fields) => write("debug", message, fields),
		info: (message, fields) => write("info", message, fields),
		warn: (message, fields) => write("warn", message, fields),
		error: (message, fields) => write("error", message, fields),
		child: (fields) =>
			createRotatingFileLoggerPortFromConfig({
				...baseConfig,
				boundFields: { ...baseConfig.boundFields, ...fields },
				skipInit: true,
			}),
	};

	return port;
}
