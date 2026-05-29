import test from "node:test";
import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import jiti from "jiti";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const importTs = jiti(import.meta.url);
const { isFitTrackFileName, matchTrackFileExtensionFromName } = importTs(
	"../src/domain/track/track-file-name.ts",
);

test("track file name: .fit.gz maps to fit.gz (not gz)", () => {
	assert.equal(
		matchTrackFileExtensionFromName("tracks/3828427456.fit.gz"),
		"fit.gz",
	);
	assert.equal(isFitTrackFileName("3828427456.fit.gz"), true);
});

test("track file name: .gpx.gz is not a v1 track extension", () => {
	assert.equal(matchTrackFileExtensionFromName("4074711732.gpx.gz"), null);
	assert.equal(isFitTrackFileName("4074711732.gpx.gz"), false);
});

test("track file name: simple extensions", () => {
	assert.equal(matchTrackFileExtensionFromName("a.gpx"), "gpx");
	assert.equal(matchTrackFileExtensionFromName("b.tcx"), "tcx");
	assert.equal(matchTrackFileExtensionFromName("c.fit"), "fit");
});
