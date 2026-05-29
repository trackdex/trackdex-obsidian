import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import jiti from "jiti";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FIXTURES = join(ROOT, "tests/fixtures");
const importTs = jiti(import.meta.url);
const { parseWithFitFileParser } = importTs(
	"../src/infrastructure/parsers/candidates/fit-file-parser-candidate.ts",
);
const { parseWithGarminSdk } = importTs(
	"../src/infrastructure/parsers/candidates/garmin-sdk-candidate.ts",
);
const { gunzipFit } = importTs(
	"../src/infrastructure/parsers/candidates/gunzip.ts",
);

async function runFixturePair(backend) {
	const fitLabel = "tests/fixtures/sample-activity.fit";
	const gzLabel = "tests/fixtures/sample-activity.fit.gz";
	const fitBytes = new Uint8Array(
		readFileSync(join(FIXTURES, "sample-activity.fit")),
	);
	const gzBytes = new Uint8Array(
		readFileSync(join(FIXTURES, "sample-activity.fit.gz")),
	);
	const parse =
		backend === "fit-file-parser" ? parseWithFitFileParser : parseWithGarminSdk;
	const gzLoaded = await gunzipFit(gzBytes);
	return [
		await parse(fitLabel, fitBytes),
		await parse(gzLabel, gzLoaded),
	];
}

test("fixtures: sample .fit and .fit.gz exist", () => {
	const fit = readFileSync(join(FIXTURES, "sample-activity.fit"));
	const gz = readFileSync(join(FIXTURES, "sample-activity.fit.gz"));
	assert.ok(fit.length > 100);
	assert.ok(gz.length > 50);
	const decompressed = gunzipSync(gz);
	assert.equal(decompressed.length, fit.length);
});

test("FIT spike: fit-file-parser parses .fit and .fit.gz", async () => {
	const results = await runFixturePair("fit-file-parser");
	assert.equal(results.length, 2);
	for (const result of results) {
		assert.equal(result.ok, true, result.message);
		assert.ok(result.metrics);
		assert.ok(result.metrics.pointCount > 1000);
		assert.equal(result.metrics.hasPower, true);
		assert.equal(result.metrics.hasCadence, true);
		assert.ok(result.sample);
		assert.equal(result.sample.sportRaw, "cycling");
	}
});

test("FIT spike: garmin-sdk parses .fit and .fit.gz", async () => {
	const results = await runFixturePair("garmin-sdk");
	assert.equal(results.length, 2);
	for (const result of results) {
		assert.equal(result.ok, true, result.message);
		assert.ok(result.metrics);
		assert.ok(result.metrics.pointCount > 1000);
		assert.ok(result.sample);
	}
});
