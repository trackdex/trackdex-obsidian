import test from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import jiti from "jiti";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const importTs = jiti(import.meta.url, {
	alias: {
		domain: join(ROOT, "src/domain"),
		application: join(ROOT, "src/application"),
	},
});

const { handleVaultTrackEvent, createIncrementalVaultTrackEventHandler } = importTs(
	"../src/application/workflows/incremental-index.ts",
);
const { createFullScanWorkQueue } = importTs(
	"../src/application/workflows/full-scan.ts",
);

function createMemoryTrackRepo(initial = []) {
	const rows = new Map(initial.map((row) => [row.path, { ...row }]));
	return {
		upsert: async (record) => {
			rows.set(record.path, { ...record });
		},
		insertDiscovered: async (record) => {
			rows.set(record.path, {
				path: record.path,
				mtimeMs: record.mtimeMs,
				status: record.status ?? "pending",
			});
		},
		findByPath: async (path) => rows.get(path) ?? null,
		deleteByPath: async (path) => {
			rows.delete(path);
		},
		updateStatus: async (path, status) => {
			const row = rows.get(path);
			if (row) {
				rows.set(path, { ...row, status });
			}
		},
		renamePath: async (oldPath, newPath, mtimeMs) => {
			const row = rows.get(oldPath);
			if (!row) {
				return;
			}
			rows.delete(oldPath);
			rows.set(newPath, { ...row, path: newPath, mtimeMs });
		},
		list: async () => [...rows.values()],
		listPathsByStatus: async (status) =>
			[...rows.values()].filter((r) => r.status === status).map((r) => r.path),
	};
}

test("incremental: created registers pending and enqueues job", async () => {
	const tracks = createMemoryTrackRepo();
	const queue = createFullScanWorkQueue({ isMobile: false });
	const indexedPaths = [];

	await handleVaultTrackEvent(
		{
			tracks,
			queue,
			indexTrackFile: async (path) => {
				indexedPaths.push(path);
			},
		},
		{ kind: "created", path: "tracks/new.gpx", mtimeMs: 50 },
	);

	const row = await tracks.findByPath("tracks/new.gpx");
	assert.equal(row?.status, "pending");
	assert.deepEqual(indexedPaths, ["tracks/new.gpx"]);
});

test("incremental: deleted removes row", async () => {
	const tracks = createMemoryTrackRepo([
		{ path: "tracks/old.gpx", mtimeMs: 1, status: "indexed" },
	]);
	const queue = createFullScanWorkQueue({ isMobile: false });

	await handleVaultTrackEvent(
		{ tracks, queue },
		{ kind: "deleted", path: "tracks/old.gpx" },
	);

	assert.equal(await tracks.findByPath("tracks/old.gpx"), null);
});

test("incremental: modified marks indexed stale when mtime changes", async () => {
	const tracks = createMemoryTrackRepo([
		{ path: "tracks/a.gpx", mtimeMs: 100, status: "indexed" },
	]);
	const queue = createFullScanWorkQueue({ isMobile: false });
	const indexedPaths = [];

	await handleVaultTrackEvent(
		{
			tracks,
			queue,
			indexTrackFile: async (path) => {
				indexedPaths.push(path);
			},
		},
		{
			kind: "modified",
			path: "tracks/a.gpx",
			mtimeMs: 200,
			contentChanged: true,
		},
	);

	assert.equal((await tracks.findByPath("tracks/a.gpx"))?.status, "stale");
	assert.deepEqual(indexedPaths, ["tracks/a.gpx"]);
});

test("incremental: modified ignores unchanged mtime on indexed file", async () => {
	const tracks = createMemoryTrackRepo([
		{ path: "tracks/a.gpx", mtimeMs: 100, status: "indexed" },
	]);
	const queue = createFullScanWorkQueue({ isMobile: false });
	let jobCalls = 0;

	await handleVaultTrackEvent(
		{
			tracks,
			queue,
			indexTrackFile: async () => {
				jobCalls += 1;
			},
		},
		{
			kind: "modified",
			path: "tracks/a.gpx",
			mtimeMs: 100,
			contentChanged: true,
		},
	);

	assert.equal((await tracks.findByPath("tracks/a.gpx"))?.status, "indexed");
	assert.equal(jobCalls, 0);
});

test("incremental: respects scan paused", async () => {
	const tracks = createMemoryTrackRepo();
	const queue = createFullScanWorkQueue({ isMobile: false });

	await handleVaultTrackEvent(
		{
			tracks,
			queue,
			isScanPaused: async () => true,
		},
		{ kind: "created", path: "tracks/x.gpx", mtimeMs: 1 },
	);

	assert.equal(await tracks.findByPath("tracks/x.gpx"), null);
});

test("incremental: handler port delegates to workflow", async () => {
	const tracks = createMemoryTrackRepo();
	const queue = createFullScanWorkQueue({ isMobile: false });
	const handler = createIncrementalVaultTrackEventHandler({ tracks, queue });

	await handler.handleVaultTrackEvent({
		kind: "created",
		path: "tracks/via-port.gpx",
		mtimeMs: 7,
	});

	assert.equal((await tracks.findByPath("tracks/via-port.gpx"))?.status, "pending");
});
