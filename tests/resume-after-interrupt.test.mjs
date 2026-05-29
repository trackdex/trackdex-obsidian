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

const { resumeAfterInterrupt } = importTs(
	"../src/application/workflows/resume-after-interrupt.ts",
);

test("resumeAfterInterrupt: no-op when flag is false", async () => {
	let meta = { lastRunInterrupted: false };
	let enqueued = 0;
	await resumeAfterInterrupt({
		indexMeta: {
			get: async () => meta,
			update: async (partial) => {
				meta = { ...meta, ...partial };
			},
			tryApproveFirstScan: async () => false,
		},
		enqueueFullScan: async () => {
			enqueued += 1;
		},
	});
	assert.equal(meta.lastRunInterrupted, false);
	assert.equal(enqueued, 0);
});

test("resumeAfterInterrupt: clears flag and enqueues full scan", async () => {
	let meta = { lastRunInterrupted: true };
	let enqueued = 0;
	await resumeAfterInterrupt({
		indexMeta: {
			get: async () => meta,
			update: async (partial) => {
				meta = { ...meta, ...partial };
			},
			tryApproveFirstScan: async () => false,
		},
		enqueueFullScan: async () => {
			enqueued += 1;
		},
	});
	assert.equal(meta.lastRunInterrupted, false);
	assert.equal(enqueued, 1);
});
