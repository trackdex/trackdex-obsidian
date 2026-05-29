import test from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import jiti from "jiti";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const importTs = jiti(import.meta.url, {
	alias: {
		domain: join(ROOT, "src/domain"),
	},
});

const {
	FILE_STATUS_TRANSITIONS,
	canTransitionFileStatus,
	initialDiscoveredFileStatus,
	resolveVaultFileCreated,
	resolveVaultFileDeleted,
	resolveVaultFileModified,
	resolveVaultFileRenamed,
	transitionFileStatus,
} = importTs("../src/domain/track/file-status.ts");
const { TRACK_STATUSES } = importTs("../src/domain/track/track-status.ts");

const ALL_SIGNALS = [
	"start_indexing",
	"index_succeeded",
	"index_failed",
	"content_changed",
];

test("file status: table covers every declared transition", () => {
	const keys = new Set(
		FILE_STATUS_TRANSITIONS.map((row) => `${row.from}:${row.signal}`),
	);
	assert.equal(keys.size, FILE_STATUS_TRANSITIONS.length);
});

test("file status: table-driven valid transitions", () => {
	for (const row of FILE_STATUS_TRANSITIONS) {
		assert.equal(canTransitionFileStatus(row.from, row.signal), true);
		const result = transitionFileStatus(row.from, row.signal);
		assert.equal(result.ok, true);
		if (result.ok) {
			assert.equal(result.value, row.to);
		}
	}
});

test("file status: rejects transitions not in table", () => {
	const allowed = new Set(
		FILE_STATUS_TRANSITIONS.map((row) => `${row.from}:${row.signal}`),
	);

	for (const from of TRACK_STATUSES) {
		for (const signal of ALL_SIGNALS) {
			const key = `${from}:${signal}`;
			if (allowed.has(key)) {
				continue;
			}
			assert.equal(canTransitionFileStatus(from, signal), false);
			const result = transitionFileStatus(from, signal);
			assert.equal(result.ok, false);
			if (!result.ok) {
				assert.match(result.error.message, /Invalid file status transition/);
			}
		}
	}
});

test("file status: initial discovered status is pending", () => {
	assert.equal(initialDiscoveredFileStatus(), "pending");
});

test("file status: vault delete always removes", () => {
	for (const status of TRACK_STATUSES) {
		assert.deepEqual(resolveVaultFileDeleted(status), { kind: "remove" });
	}
	assert.deepEqual(resolveVaultFileDeleted(null), { kind: "remove" });
});

test("file status: vault rename updates path or inserts pending", () => {
	const input = {
		oldPath: "tracks/a.gpx",
		newPath: "archive/a.gpx",
		mtimeMs: 42,
	};

	assert.deepEqual(resolveVaultFileRenamed(true, input), {
		kind: "rename",
		oldPath: input.oldPath,
		newPath: input.newPath,
		mtimeMs: input.mtimeMs,
	});
	assert.deepEqual(resolveVaultFileRenamed(false, input), {
		kind: "insert_pending",
		path: input.newPath,
		mtimeMs: input.mtimeMs,
	});
});

test("file status: vault create inserts pending when unknown", () => {
	assert.deepEqual(resolveVaultFileCreated(false, "tracks/new.gpx", 10), {
		kind: "insert_pending",
		path: "tracks/new.gpx",
		mtimeMs: 10,
	});
	assert.deepEqual(resolveVaultFileCreated(true, "tracks/new.gpx", 10), {
		kind: "none",
	});
});

test("file status: vault modify marks indexed stale when content changed", () => {
	const result = resolveVaultFileModified("indexed", {
		path: "tracks/a.gpx",
		mtimeMs: 99,
		contentChanged: true,
	});
	assert.equal(result.ok, true);
	if (result.ok) {
		assert.deepEqual(result.value, {
			effect: { kind: "none" },
			nextStatus: "stale",
		});
	}
});

test("file status: vault modify no-op when content unchanged", () => {
	for (const status of TRACK_STATUSES) {
		const result = resolveVaultFileModified(status, {
			path: "tracks/a.gpx",
			mtimeMs: 1,
			contentChanged: false,
		});
		assert.equal(result.ok, true);
		if (result.ok) {
			assert.deepEqual(result.value, { effect: { kind: "none" } });
		}
	}
});

test("file status: vault modify on unknown path inserts pending", () => {
	const result = resolveVaultFileModified(null, {
		path: "tracks/ghost.gpx",
		mtimeMs: 5,
		contentChanged: true,
	});
	assert.equal(result.ok, true);
	if (result.ok) {
		assert.deepEqual(result.value, {
			effect: {
				kind: "insert_pending",
				path: "tracks/ghost.gpx",
				mtimeMs: 5,
			},
		});
	}
});

test("file status: vault modify leaves in-flight rows unchanged", () => {
	for (const status of ["pending", "indexing", "stale", "error"]) {
		const result = resolveVaultFileModified(status, {
			path: "tracks/a.gpx",
			mtimeMs: 2,
			contentChanged: true,
		});
		assert.equal(result.ok, true);
		if (result.ok) {
			assert.deepEqual(result.value, { effect: { kind: "none" } });
			assert.equal(result.value.nextStatus, undefined);
		}
	}
});
