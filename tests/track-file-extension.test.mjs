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
const { normalizeTrackFileExtension } = importTs(
	"../src/domain/track/track-file-extension.ts",
);
const { getTrackFileExtension } = importTs(
	"../src/ui/views/track-file-extension.ts",
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

test("getTrackFileExtension: resolves from file name (Obsidian extension gz)", () => {
	assert.equal(
		getTrackFileExtension({ name: "ride.fit.gz", extension: "gz" }),
		"fit.gz",
	);
	assert.equal(
		getTrackFileExtension({ name: "trail.gpx", extension: "gpx" }),
		"gpx",
	);
	assert.equal(
		getTrackFileExtension({ name: "archive.gpx.gz", extension: "gz" }),
		null,
	);
});
