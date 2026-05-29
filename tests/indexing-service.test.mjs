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

const { createIndexingService } = importTs(
	"../src/application/services/indexing-service.ts",
);
const { createFullScanWorkQueue } = importTs(
	"../src/application/workflows/full-scan.ts",
);

function createMetaRepo(
	initial = {
		firstScanApproved: false,
		scanPaused: false,
		lastRunInterrupted: false,
	},
) {
	let meta = { ...initial };
	return {
		get: async () => meta,
		update: async (partial) => {
			meta = { ...meta, ...partial };
		},
	};
}

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

const clock = {
	nowMs: () => 1_700_000_000_000,
	nowUtcIso: () => "2026-05-29T12:00:00.000Z",
};

const noopLogger = {
	info() {},
	warn() {},
	error() {},
	debug() {},
	child() {
		return this;
	},
};

function createTestIndexingService(overrides = {}) {
	const indexMeta = overrides.indexMeta ?? createMetaRepo();
	const tracks = overrides.tracks ?? createMemoryTrackRepo();
	const scannerFiles = overrides.scannerFiles ?? [
		{ path: "tracks/a.gpx", extension: "gpx", mtimeMs: 100 },
		{ path: "tracks/b.tcx", extension: "tcx", mtimeMs: 200 },
	];

	return createIndexingService({
		logger: noopLogger,
		indexMeta,
		tracks,
		clock,
		queue: createFullScanWorkQueue({ isMobile: false }),
		createScanner: () => ({
			listTrackFiles: async () => scannerFiles,
		}),
		...overrides.deps,
	});
}

test("indexing service: approveFirstScan persists meta and enqueues full scan once", async () => {
	const indexMeta = createMetaRepo();
	const indexing = createTestIndexingService({ indexMeta });

	await indexing.approveFirstScan();
	assert.equal((await indexMeta.get()).firstScanApproved, true);

	await indexing.approveFirstScan();
	assert.equal((await indexMeta.get()).firstScanApproved, true);
});

test("indexing service: approveFirstScan skips enqueue when already approved", async () => {
	const indexMeta = createMetaRepo({ firstScanApproved: true, scanPaused: false });
	const tracks = createMemoryTrackRepo();
	const indexing = createTestIndexingService({ indexMeta, tracks });

	await indexing.approveFirstScan();
	assert.equal((await tracks.list()).length, 0);
});

test("indexing service: beginScanRun write-ahead persists interrupted flag", async () => {
	const indexMeta = createMetaRepo();
	const indexing = createTestIndexingService({ indexMeta });

	await indexing.beginScanRun();
	assert.equal((await indexMeta.get()).lastRunInterrupted, true);
});

test("indexing service: markInterruptedIfScanActive clears in-memory run only", async () => {
	const indexMeta = createMetaRepo();
	const indexing = createTestIndexingService({ indexMeta });

	indexing.markInterruptedIfScanActive();
	assert.equal((await indexMeta.get()).lastRunInterrupted, false);

	await indexing.beginScanRun();
	assert.equal((await indexMeta.get()).lastRunInterrupted, true);

	indexing.markInterruptedIfScanActive();
	assert.equal((await indexMeta.get()).lastRunInterrupted, true);

	indexing.markInterruptedIfScanActive();
	assert.equal((await indexMeta.get()).lastRunInterrupted, true);
});

test("indexing service: completeScanRun clears interrupted flag", async () => {
	const indexMeta = createMetaRepo({ lastRunInterrupted: true });
	const indexing = createTestIndexingService({ indexMeta });

	await indexing.beginScanRun();
	await indexing.completeScanRun();
	assert.equal((await indexMeta.get()).lastRunInterrupted, false);
});

test("indexing service: completeScanRun no-op after interrupt marking", async () => {
	const indexMeta = createMetaRepo();
	const indexing = createTestIndexingService({ indexMeta });

	await indexing.beginScanRun();
	indexing.markInterruptedIfScanActive();
	await indexing.completeScanRun();
	assert.equal((await indexMeta.get()).lastRunInterrupted, true);
});

test("indexing service: resumeAfterInterrupt clears flag and enqueues scan", async () => {
	const indexMeta = createMetaRepo({ lastRunInterrupted: true });
	const tracks = createMemoryTrackRepo();
	const indexing = createTestIndexingService({ indexMeta, tracks });

	await indexing.resumeAfterInterrupt();
	assert.equal((await indexMeta.get()).lastRunInterrupted, false);
	assert.equal((await tracks.findByPath("tracks/a.gpx"))?.status, "pending");

	await indexing.resumeAfterInterrupt();
	assert.equal((await tracks.findByPath("tracks/b.tcx"))?.status, "pending");
});

test("indexing service E2E: vault scan writes pending statuses to track store", async () => {
	const indexMeta = createMetaRepo();
	const tracks = createMemoryTrackRepo();
	const indexing = createTestIndexingService({ indexMeta, tracks });

	await indexing.scanOrResumeIndexing();

	const a = await tracks.findByPath("tracks/a.gpx");
	const b = await tracks.findByPath("tracks/b.tcx");
	assert.equal(a?.status, "pending");
	assert.equal(b?.status, "pending");
	assert.equal((await indexMeta.get()).lastFullScanAtUtc, "2026-05-29T12:00:00.000Z");
	assert.equal((await indexMeta.get()).lastRunInterrupted, false);
});

test("indexing service: scan progress updates during full scan", async () => {
	const indexing = createTestIndexingService();
	const snapshots = [];
	indexing.scanProgress.subscribe((snapshot) => snapshots.push({ ...snapshot }));

	await indexing.scanOrResumeIndexing();

	const indexingSnapshots = snapshots.filter((s) => s.phase === "indexing");
	assert.ok(indexingSnapshots.length > 0);
	assert.equal(
		indexingSnapshots.some((s) => s.completedCount === 2),
		true,
	);
	assert.equal(indexing.scanProgress.getSnapshot().phase, "idle");
});

test("indexing service: pauseIndexing prevents scanOrResumeIndexing", async () => {
	const indexMeta = createMetaRepo({ scanPaused: true });
	const tracks = createMemoryTrackRepo();
	const indexing = createTestIndexingService({ indexMeta, tracks });

	await indexing.scanOrResumeIndexing();
	assert.equal(await tracks.findByPath("tracks/a.gpx"), null);
});

test("indexing service: pauseIndexing and resumeIndexing update meta", async () => {
	const indexMeta = createMetaRepo();
	const indexing = createTestIndexingService({ indexMeta });

	await indexing.pauseIndexing();
	assert.equal((await indexMeta.get()).scanPaused, true);

	await indexing.resumeIndexing();
	assert.equal((await indexMeta.get()).scanPaused, false);
});
