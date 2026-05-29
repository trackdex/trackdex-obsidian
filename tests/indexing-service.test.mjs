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

test("indexing service: approveFirstScan persists meta and enqueues full scan once", async () => {
	const indexMeta = createMetaRepo();
	let fullScanCalls = 0;
	const indexing = createIndexingService({
		logger: { info() {}, warn() {}, error() {}, child() { return this; } },
		indexMeta,
		enqueueFullScan: async () => {
			fullScanCalls += 1;
		},
	});

	await indexing.approveFirstScan();
	assert.equal((await indexMeta.get()).firstScanApproved, true);
	assert.equal(fullScanCalls, 1);

	await indexing.approveFirstScan();
	assert.equal(fullScanCalls, 1);
});

test("indexing service: approveFirstScan skips enqueue when already approved", async () => {
	const indexMeta = createMetaRepo({ firstScanApproved: true, scanPaused: false });
	let fullScanCalls = 0;
	const indexing = createIndexingService({
		logger: { info() {}, warn() {}, error() {}, child() { return this; } },
		indexMeta,
		enqueueFullScan: async () => {
			fullScanCalls += 1;
		},
	});

	await indexing.approveFirstScan();
	assert.equal(fullScanCalls, 0);
});

test("indexing service: markInterruptedIfScanActive persists only while scan active", async () => {
	const indexMeta = createMetaRepo();
	const indexing = createIndexingService({
		logger: { info() {}, warn() {}, error() {}, child() { return this; } },
		indexMeta,
	});

	await indexing.markInterruptedIfScanActive();
	assert.equal((await indexMeta.get()).lastRunInterrupted, false);

	await indexing.beginScanRun();
	await indexing.markInterruptedIfScanActive();
	assert.equal((await indexMeta.get()).lastRunInterrupted, true);

	await indexing.markInterruptedIfScanActive();
	assert.equal((await indexMeta.get()).lastRunInterrupted, true);
});

test("indexing service: completeScanRun clears interrupted flag", async () => {
	const indexMeta = createMetaRepo({ lastRunInterrupted: true });
	const indexing = createIndexingService({
		logger: { info() {}, warn() {}, error() {}, child() { return this; } },
		indexMeta,
	});

	await indexing.beginScanRun();
	await indexing.completeScanRun();
	assert.equal((await indexMeta.get()).lastRunInterrupted, false);
});

test("indexing service: resumeAfterInterrupt clears flag and enqueues scan", async () => {
	const indexMeta = createMetaRepo({ lastRunInterrupted: true });
	let fullScanCalls = 0;
	const indexing = createIndexingService({
		logger: { info() {}, warn() {}, error() {}, child() { return this; } },
		indexMeta,
		enqueueFullScan: async () => {
			fullScanCalls += 1;
		},
	});

	await indexing.resumeAfterInterrupt();
	assert.equal((await indexMeta.get()).lastRunInterrupted, false);
	assert.equal(fullScanCalls, 1);

	await indexing.resumeAfterInterrupt();
	assert.equal(fullScanCalls, 1);
});
