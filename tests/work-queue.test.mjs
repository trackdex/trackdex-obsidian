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

const {
	createBoundedWorkQueue,
	DEFAULT_MICRO_BATCH_SIZE,
	resolveScanConcurrency,
	SCAN_CONCURRENCY_DESKTOP,
	SCAN_CONCURRENCY_MOBILE,
} = importTs("../src/application/indexing/work-queue.ts");

function tick() {
	return new Promise((resolve) => setTimeout(resolve, 0));
}

function createGate(count) {
	let released = 0;
	const waiters = [];
	return {
		wait() {
			if (released > 0) {
				released--;
				return Promise.resolve();
			}
			return new Promise((resolve) => waiters.push(resolve));
		},
		releaseAll() {
			while (waiters.length > 0) {
				waiters.shift()();
			}
			released = count;
		},
	};
}

test("work queue: resolveScanConcurrency uses desktop/mobile caps", () => {
	assert.equal(SCAN_CONCURRENCY_DESKTOP, 2);
	assert.equal(SCAN_CONCURRENCY_MOBILE, 1);
	assert.equal(resolveScanConcurrency(false), 2);
	assert.equal(resolveScanConcurrency(true), 1);
});

test("work queue: rejects invalid concurrency", () => {
	assert.throws(
		() => createBoundedWorkQueue({ concurrency: 0 }),
		/concurrency must be >= 1/,
	);
});

test("work queue: active concurrency never exceeds cap", async () => {
	const queue = createBoundedWorkQueue({
		concurrency: 2,
		yield: async () => {},
	});
	const gate = createGate(10);
	let active = 0;
	let maxActive = 0;

	const tasks = Array.from({ length: 6 }, () => async () => {
		active++;
		maxActive = Math.max(maxActive, active);
		await gate.wait();
		active--;
	});

	const done = queue.runMany(tasks);
	await tick();
	await tick();

	assert.ok(maxActive <= 2, `expected max active <= 2, got ${maxActive}`);
	assert.equal(maxActive, 2);

	gate.releaseAll();
	await done;
	await queue.whenIdle();
	assert.equal(queue.activeCount, 0);
	assert.equal(queue.pendingCount, 0);
});

test("work queue: runMany yields between micro-batches", async () => {
	let yieldCalls = 0;
	const queue = createBoundedWorkQueue({
		concurrency: 4,
		batchSize: 3,
		yield: async () => {
			yieldCalls++;
		},
	});

	const tasks = Array.from({ length: 7 }, () => async () => {});
	await queue.runMany(tasks);

	assert.equal(yieldCalls, 2);
});

test("work queue: default micro-batch size is 32", () => {
	assert.equal(DEFAULT_MICRO_BATCH_SIZE, 32);
});

test("work queue: runMany completes and propagates task errors", async () => {
	const queue = createBoundedWorkQueue({ concurrency: 1, yield: async () => {} });

	await assert.rejects(
		queue.runMany([
			async () => {},
			async () => {
				throw new Error("boom");
			},
		]),
		/boom/,
	);
	await queue.whenIdle();
});
