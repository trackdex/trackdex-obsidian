import test from "node:test";
import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import jiti from "jiti";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const importTs = jiti(import.meta.url, {
	alias: {
		domain: join(ROOT, "src/domain"),
		application: join(ROOT, "src/application"),
	},
});

const {
	LOG_MAX_BYTES,
	LOG_MAX_FILES,
	LOG_FILE_BASENAME,
	logSegmentNames,
	buildRotationSteps,
	needsRotationBeforeAppend,
} = importTs("../src/infrastructure/logging/log-rotation.ts");
const {
	appendLogEntry,
	formatLogLine,
} = importTs("../src/infrastructure/logging/file-logger.ts");

function createMemoryLogIo() {
	/** @type {Map<string, Uint8Array>} */
	const files = new Map();

	return {
		files,
		exists: async (path) => files.has(path),
		statSize: async (path) => files.get(path)?.length ?? 0,
		read: async (path) => files.get(path) ?? null,
		write: async (path, data) => {
			files.set(path, data);
		},
		remove: async (path) => {
			files.delete(path);
		},
		rename: async (from, to) => {
			const data = files.get(from);
			if (!data) {
				return;
			}
			files.set(to, data);
			files.delete(from);
		},
		mkdir: async () => {},
	};
}

const LOGS_DIR = "/plugin-data/logs";

test("log rotation policy is 5 files x 1 MB", () => {
	assert.equal(LOG_MAX_FILES, 5);
	assert.equal(LOG_MAX_BYTES, 1_048_576);
});

test("logSegmentNames lists active file and rotated segments", () => {
	assert.deepEqual(logSegmentNames(LOG_FILE_BASENAME, 5), [
		"trackdex.log",
		"trackdex.log.1",
		"trackdex.log.2",
		"trackdex.log.3",
		"trackdex.log.4",
	]);
});

test("buildRotationSteps drops oldest and shifts segments", () => {
	const steps = buildRotationSteps(LOGS_DIR, LOG_FILE_BASENAME, 5);
	assert.deepEqual(steps, [
		{ op: "remove", path: `${LOGS_DIR}/trackdex.log.4` },
		{
			op: "rename",
			from: `${LOGS_DIR}/trackdex.log.3`,
			to: `${LOGS_DIR}/trackdex.log.4`,
		},
		{
			op: "rename",
			from: `${LOGS_DIR}/trackdex.log.2`,
			to: `${LOGS_DIR}/trackdex.log.3`,
		},
		{
			op: "rename",
			from: `${LOGS_DIR}/trackdex.log.1`,
			to: `${LOGS_DIR}/trackdex.log.2`,
		},
		{
			op: "rename",
			from: `${LOGS_DIR}/trackdex.log`,
			to: `${LOGS_DIR}/trackdex.log.1`,
		},
	]);
});

test("needsRotationBeforeAppend respects empty active file", () => {
	assert.equal(needsRotationBeforeAppend(0, LOG_MAX_BYTES + 1, LOG_MAX_BYTES), false);
	assert.equal(needsRotationBeforeAppend(100, LOG_MAX_BYTES, LOG_MAX_BYTES), true);
	assert.equal(needsRotationBeforeAppend(100, 10, LOG_MAX_BYTES), false);
});

test("appendLogEntry rotates when active file would exceed maxBytes", async () => {
	const io = createMemoryLogIo();
	const config = {
		logsDir: LOGS_DIR,
		io,
		maxFiles: LOG_MAX_FILES,
		maxBytes: 100,
		basename: LOG_FILE_BASENAME,
	};

	const chunk = new Uint8Array(60);
	chunk.fill(97);
	await appendLogEntry(config, chunk);
	await appendLogEntry(config, chunk);

	const active = `${LOGS_DIR}/${LOG_FILE_BASENAME}`;
	const rotated = `${LOGS_DIR}/trackdex.log.1`;

	assert.equal(io.files.has(active), true);
	assert.equal(io.files.has(rotated), true);
	assert.equal(io.files.get(active)?.length, 60);
	assert.equal(io.files.get(rotated)?.length, 60);
});

test("appendLogEntry keeps at most maxFiles segments", async () => {
	const io = createMemoryLogIo();
	const config = {
		logsDir: LOGS_DIR,
		io,
		maxFiles: LOG_MAX_FILES,
		maxBytes: 40,
		basename: LOG_FILE_BASENAME,
	};

	const chunk = new Uint8Array(30);
	chunk.fill(98);
	for (let i = 0; i < 12; i++) {
		await appendLogEntry(config, chunk);
	}

	const paths = [...io.files.keys()].sort();
	const expected = logSegmentNames(LOG_FILE_BASENAME, LOG_MAX_FILES).map(
		(name) => `${LOGS_DIR}/${name}`,
	);
	assert.deepEqual(paths, expected);
});

test("formatLogLine emits JSON with level and message", () => {
	const line = formatLogLine("error", "parse: failed", { path: "a.gpx" });
	const parsed = JSON.parse(line);
	assert.equal(parsed.level, "error");
	assert.equal(parsed.msg, "parse: failed");
	assert.equal(parsed.path, "a.gpx");
	assert.equal(typeof parsed.ts, "string");
});
