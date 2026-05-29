import test from "node:test";
import assert from "node:assert/strict";
import jiti from "jiti";

const importTs = jiti(import.meta.url);
const { normalizeTrackFileExtension } = importTs(
	"../src/domain/track/track-file-extension.ts",
);

test("normalizeTrackFileExtension: v1 extensions", () => {
	assert.equal(normalizeTrackFileExtension("gpx"), "gpx");
	assert.equal(normalizeTrackFileExtension("GPX"), "gpx");
	assert.equal(normalizeTrackFileExtension(" fit.gz "), "fit.gz");
});

test("normalizeTrackFileExtension: rejects unknown", () => {
	assert.equal(normalizeTrackFileExtension("kml"), null);
	assert.equal(normalizeTrackFileExtension("gpx.gz"), null);
});
