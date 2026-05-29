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

const { createParserRouter } = importTs(
	"../src/infrastructure/parsers/parser-router.ts",
);
const { normalizeTrackFileExtension } = importTs(
	"../src/domain/track/track-file-extension.ts",
);
const { ok } = importTs("../src/domain/shared/result.ts");

const SAMPLE_TRACK = {
	titleFromFile: null,
	sportRaw: null,
	startedAtRaw: null,
	endedAtRaw: null,
	points: [],
	segments: [],
	bbox: null,
};

function mockParser(label) {
	return {
		parse: async (input) =>
			ok({ ...SAMPLE_TRACK, titleFromFile: `${label}:${input.extension}` }),
	};
}

function baseInput(extension) {
	return {
		vaultRelativePath: "tracks/sample",
		extension,
		content: new Uint8Array(0),
	};
}

test("normalizeTrackFileExtension: case-insensitive", () => {
	assert.equal(normalizeTrackFileExtension("GPX"), "gpx");
	assert.equal(normalizeTrackFileExtension("Tcx"), "tcx");
	assert.equal(normalizeTrackFileExtension("FIT"), "fit");
	assert.equal(normalizeTrackFileExtension("FIT.GZ"), "fit.gz");
	assert.equal(normalizeTrackFileExtension("json"), null);
});

test("parser router: routes supported extensions", async () => {
	const router = createParserRouter({
		gpx: mockParser("gpx"),
		tcx: mockParser("tcx"),
		fit: mockParser("fit"),
		fitGz: mockParser("fitGz"),
	});

	const gpx = await router.parse(baseInput("gpx"));
	assert.equal(gpx.ok, true);
	assert.equal(gpx.value.titleFromFile, "gpx:gpx");

	const tcx = await router.parse(baseInput("TCX"));
	assert.equal(tcx.ok, true);
	assert.equal(tcx.value.titleFromFile, "tcx:tcx");

	const fit = await router.parse(baseInput("Fit"));
	assert.equal(fit.ok, true);
	assert.equal(fit.value.titleFromFile, "fit:fit");

	const fitGz = await router.parse(baseInput("FIT.GZ"));
	assert.equal(fitGz.ok, true);
	assert.equal(fitGz.value.titleFromFile, "fitGz:fit.gz");
});

test("parser router: unknown extension returns unsupported_extension", async () => {
	const router = createParserRouter({
		gpx: mockParser("gpx"),
		tcx: mockParser("tcx"),
		fit: mockParser("fit"),
		fitGz: mockParser("fitGz"),
	});

	const result = await router.parse(baseInput("kml"));
	assert.equal(result.ok, false);
	assert.equal(result.error.code, "unsupported_extension");
	assert.match(result.error.message, /kml/);
});

test("parser router: default stubs return parse_failed per format", async () => {
	const { createDefaultParserRouter } = importTs(
		"../src/infrastructure/parsers/parser-router.ts",
	);
	const router = createDefaultParserRouter();

	for (const extension of ["gpx", "tcx", "fit", "fit.gz"]) {
		const result = await router.parse(baseInput(extension));
		assert.equal(result.ok, false);
		assert.equal(result.error.code, "parse_failed");
		assert.match(result.error.message, new RegExp(extension.replace(".", "\\.")));
	}
});
