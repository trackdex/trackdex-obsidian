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

const { runFullScan, createFullScanWorkQueue } = importTs(
	"../src/application/workflows/full-scan.ts",
);
const { createScanProgress } = importTs(
	"../src/application/indexing/scan-progress.ts",
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
		renamePath: async () => {},
		list: async () => [...rows.values()],
		listPathsByStatus: async (status) =>
			[...rows.values()].filter((r) => r.status === status).map((r) => r.path),
	};
}

function createMetaRepo(initial = {}) {
	let meta = {
		lastFullScanAtUtc: null,
		scanPaused: false,
		...initial,
	};
	return {
		get: async () => meta,
		update: async (partial) => {
			meta = { ...meta, ...partial };
		},
	};
}

const clock = {
	nowMs: () => 1_700_000_000_000,
	nowUtcIso: () => "2026-05-29T12:00:00.000Z",
};

test("runFullScan: discovers new files as pending and enqueues jobs", async () => {
	const tracks = createMemoryTrackRepo();
	const indexMeta = createMetaRepo();
	const queue = createFullScanWorkQueue({ isMobile: false });
	const indexedPaths = [];

	await runFullScan({
		scanner: {
			listTrackFiles: async () => [
				{ path: "tracks/a.gpx", extension: "gpx", mtimeMs: 100 },
				{ path: "tracks/b.tcx", extension: "tcx", mtimeMs: 200 },
			],
		},
		tracks,
		indexMeta,
		clock,
		queue,
		indexTrackFile: async (path) => {
			indexedPaths.push(path);
		},
	});

	const a = await tracks.findByPath("tracks/a.gpx");
	const b = await tracks.findByPath("tracks/b.tcx");
	assert.equal(a?.status, "pending");
	assert.equal(b?.status, "pending");
	assert.deepEqual(indexedPaths.sort(), ["tracks/a.gpx", "tracks/b.tcx"]);
	assert.equal((await indexMeta.get()).lastFullScanAtUtc, "2026-05-29T12:00:00.000Z");
});

test("runFullScan: skips indexed files with unchanged mtime", async () => {
	const tracks = createMemoryTrackRepo([
		{ path: "tracks/a.gpx", mtimeMs: 100, status: "indexed" },
	]);
	const indexMeta = createMetaRepo();
	const queue = createFullScanWorkQueue({ isMobile: false });
	let jobCalls = 0;

	const result = await runFullScan({
		scanner: {
			listTrackFiles: async () => [
				{ path: "tracks/a.gpx", extension: "gpx", mtimeMs: 100 },
			],
		},
		tracks,
		indexMeta,
		clock,
		queue,
		indexTrackFile: async () => {
			jobCalls += 1;
		},
	});

	assert.equal(result.enqueued, 0);
	assert.equal(jobCalls, 0);
	assert.equal((await tracks.findByPath("tracks/a.gpx"))?.status, "indexed");
});

test("runFullScan: marks indexed file stale when mtime changes", async () => {
	const tracks = createMemoryTrackRepo([
		{ path: "tracks/a.gpx", mtimeMs: 100, status: "indexed" },
	]);
	const indexMeta = createMetaRepo();
	const queue = createFullScanWorkQueue({ isMobile: false });
	const indexedPaths = [];

	await runFullScan({
		scanner: {
			listTrackFiles: async () => [
				{ path: "tracks/a.gpx", extension: "gpx", mtimeMs: 999 },
			],
		},
		tracks,
		indexMeta,
		clock,
		queue,
		indexTrackFile: async (path) => {
			indexedPaths.push(path);
		},
	});

	assert.equal((await tracks.findByPath("tracks/a.gpx"))?.status, "stale");
	assert.deepEqual(indexedPaths, ["tracks/a.gpx"]);
});

test("runFullScan: respects scan paused", async () => {
	const tracks = createMemoryTrackRepo();
	const indexMeta = createMetaRepo({ scanPaused: true });
	const queue = createFullScanWorkQueue({ isMobile: false });

	const result = await runFullScan({
		scanner: {
			listTrackFiles: async () => [
				{ path: "tracks/a.gpx", extension: "gpx", mtimeMs: 1 },
			],
		},
		tracks,
		indexMeta,
		clock,
		queue,
		isScanPaused: async () => (await indexMeta.get()).scanPaused,
	});

	assert.equal(result.discovered, 0);
	assert.equal(await tracks.findByPath("tracks/a.gpx"), null);
	assert.equal((await indexMeta.get()).lastFullScanAtUtc, null);
});

test("runFullScan: updates scan progress counters during indexing", async () => {
	const tracks = createMemoryTrackRepo();
	const indexMeta = createMetaRepo();
	const queue = createFullScanWorkQueue({ isMobile: false });
	const progress = createScanProgress();
	const snapshots = [];
	progress.subscribe((snapshot) => snapshots.push({ ...snapshot }));

	await runFullScan({
		scanner: {
			listTrackFiles: async () => [
				{ path: "tracks/a.gpx", extension: "gpx", mtimeMs: 100, sizeBytes: 100 },
				{ path: "tracks/b.tcx", extension: "tcx", mtimeMs: 200, sizeBytes: 200 },
			],
		},
		tracks,
		indexMeta,
		clock,
		queue,
		scanProgress: progress,
		indexTrackFile: async () => {},
	});

	const indexingSnapshots = snapshots.filter((s) => s.phase === "indexing");
	assert.ok(indexingSnapshots.length > 0);
	assert.equal(
		indexingSnapshots.some((s) => s.completedCount === 2),
		true,
	);
	assert.equal(progress.getSnapshot().phase, "idle");
	assert.equal(progress.getSnapshot().active, false);
});
