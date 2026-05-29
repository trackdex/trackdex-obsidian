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

function createMetaRepo(initial = { firstScanApproved: false, scanPaused: false }) {
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
