import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import jiti from "jiti";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FIXTURES = join(ROOT, "tests/fixtures");
const importTs = jiti(import.meta.url, {
	alias: {
		domain: join(ROOT, "src/domain"),
		application: join(ROOT, "src/application"),
	},
});

const { createFitGzParserPort } = importTs(
	"../src/infrastructure/parsers/fit-gz-parser.ts",
);
const { createDefaultParserRouter } = importTs(
	"../src/infrastructure/parsers/parser-router.ts",
);

function fitGzFixtureBytes() {
	return new Uint8Array(
		readFileSync(join(FIXTURES, "sample-activity.fit.gz")),
	);
}

function parseInput(content) {
	return {
		vaultRelativePath: "tracks/sample-activity.fit.gz",
		extension: "fit.gz",
		content,
	};
}

test("fit.gz parser: sample .fit.gz fixture → ParsedTrack", async () => {
	const parser = createFitGzParserPort();
	const result = await parser.parse(parseInput(fitGzFixtureBytes()));

	assert.equal(result.ok, true);
	const track = result.value;
	assert.equal(track.sportRaw, "cycling");
	assert.equal(track.points.length, 3228);
	assert.equal(track.segments.length, 1);
	assert.ok(track.bbox);
	assert.equal(track.startedAtRaw, "2015-10-12T15:47:45.000Z");
});

test("fit.gz parser: invalid gzip → parse_failed", async () => {
	const parser = createFitGzParserPort();
	const result = await parser.parse(parseInput(new Uint8Array([1, 2, 3])));

	assert.equal(result.ok, false);
	assert.equal(result.error.code, "parse_failed");
});

test("fit.gz parser: default router routes .fit.gz to production adapter", async () => {
	const router = createDefaultParserRouter();
	const result = await router.parse(parseInput(fitGzFixtureBytes()));

	assert.equal(result.ok, true);
	assert.equal(result.value.points.length, 3228);
});
