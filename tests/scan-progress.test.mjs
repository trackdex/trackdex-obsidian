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
	createScanProgress,
	isLargeTrackFile,
	LARGE_TRACK_FILE_BYTES,
} = importTs("../src/application/indexing/scan-progress.ts");

test("scan progress: idle snapshot by default", () => {
	const progress = createScanProgress();
	assert.deepEqual(progress.getSnapshot(), {
		phase: "idle",
		active: false,
		discoveredTotal: 0,
		indexTotal: 0,
		completedCount: 0,
		currentFilePath: null,
		isProcessingLargeFile: false,
	});
});

test("scan progress: subscribe receives current and future snapshots", () => {
	const progress = createScanProgress();
	const seen = [];
	const unsubscribe = progress.subscribe((snapshot) => seen.push({ ...snapshot }));

	progress.beginScan();
	progress.setDiscoveredTotal(3);
	progress.beginIndexing(2);
	progress.beginFile("tracks/a.gpx");
	progress.completeFile("tracks/a.gpx");
	unsubscribe();

	assert.equal(seen.length, 6);
	assert.equal(seen[0].phase, "idle");
	assert.equal(seen[1].phase, "discovering");
	assert.equal(seen[2].discoveredTotal, 3);
	assert.equal(seen[3].indexTotal, 2);
	assert.equal(seen[4].currentFilePath, "tracks/a.gpx");
	assert.equal(seen[5].completedCount, 1);
	assert.equal(seen[5].currentFilePath, null);
});

test("scan progress: large file flag when size meets threshold", () => {
	const progress = createScanProgress();
	progress.beginScan();
	progress.beginIndexing(1);

	progress.beginFile("tracks/big.fit", { sizeBytes: LARGE_TRACK_FILE_BYTES });
	assert.equal(progress.getSnapshot().isProcessingLargeFile, true);

	progress.completeFile("tracks/big.fit");
	assert.equal(progress.getSnapshot().isProcessingLargeFile, false);
});

test("isLargeTrackFile: false when size unknown or below threshold", () => {
	assert.equal(isLargeTrackFile(undefined), false);
	assert.equal(isLargeTrackFile(LARGE_TRACK_FILE_BYTES - 1), false);
	assert.equal(isLargeTrackFile(LARGE_TRACK_FILE_BYTES), true);
});

test("scan progress: endScan returns to idle", () => {
	const progress = createScanProgress();
	progress.beginScan();
	progress.setDiscoveredTotal(5);
	progress.endScan();

	assert.deepEqual(progress.getSnapshot(), {
		phase: "idle",
		active: false,
		discoveredTotal: 0,
		indexTotal: 0,
		completedCount: 0,
		currentFilePath: null,
		isProcessingLargeFile: false,
	});
});
