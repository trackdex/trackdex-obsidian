import test from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { DOMParser } from "@xmldom/xmldom";
import jiti from "jiti";

globalThis.DOMParser = DOMParser;

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

test("parser router: default gpx and fit.gz adapters are wired (not stubs)", async () => {
	const { createDefaultParserRouter } = importTs(
		"../src/infrastructure/parsers/parser-router.ts",
	);
	const router = createDefaultParserRouter();

	for (const extension of ["gpx", "fit.gz"]) {
		const result = await router.parse(baseInput(extension));
		assert.equal(result.ok, false);
		assert.equal(result.error.code, "parse_failed");
		assert.doesNotMatch(result.error.message, /not implemented/);
	}
});

test("parser router: default fit adapter is wired (not a stub)", async () => {
	const { createDefaultParserRouter } = importTs(
		"../src/infrastructure/parsers/parser-router.ts",
	);
	const router = createDefaultParserRouter();
	const result = await router.parse(baseInput("fit"));

	assert.equal(result.ok, false);
	assert.equal(result.error.code, "parse_failed");
	assert.doesNotMatch(result.error.message, /not implemented/);
});

test("parser router: default tcx adapter is wired (not a stub)", async () => {
	const { createDefaultParserRouter } = importTs(
		"../src/infrastructure/parsers/parser-router.ts",
	);
	const { readFileSync } = await import("node:fs");
	const fixture = readFileSync(
		join(ROOT, "tests/fixtures/sample-activity.tcx"),
		"utf8",
	);
	const router = createDefaultParserRouter();
	const result = await router.parse({
		...baseInput("tcx"),
		content: new TextEncoder().encode(fixture),
	});

	assert.equal(result.ok, true);
	if (!result.ok) {
		return;
	}
	assert.ok(result.value.points.length > 0);
});
