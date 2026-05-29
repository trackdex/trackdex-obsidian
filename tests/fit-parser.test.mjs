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

const { createFitParserPort } = importTs(
	"../src/infrastructure/parsers/fit-parser.ts",
);
const { createDefaultParserRouter } = importTs(
	"../src/infrastructure/parsers/parser-router.ts",
);

function fitFixtureBytes() {
	return new Uint8Array(readFileSync(join(FIXTURES, "sample-activity.fit")));
}

function parseInput(content) {
	return {
		vaultRelativePath: "tracks/sample-activity.fit",
		extension: "fit",
		content,
	};
}

test("fit parser: sample .fit fixture → ParsedTrack", async () => {
	const parser = createFitParserPort();
	const result = await parser.parse(parseInput(fitFixtureBytes()));

	assert.equal(result.ok, true);
	const track = result.value;
	assert.equal(track.sportRaw, "cycling");
	assert.equal(track.points.length, 3228);
	assert.equal(track.segments.length, 1);
	assert.ok(track.bbox);
	assert.ok(track.bbox.south < track.bbox.north);
	assert.ok(track.bbox.west < track.bbox.east);
	assert.equal(track.startedAtRaw, "2015-10-12T15:47:45.000Z");

	let hasPower = false;
	let hasCadence = false;
	for (const point of track.points) {
		if (point.powerW !== null) {
			hasPower = true;
		}
		if (point.cadenceRpm !== null) {
			hasCadence = true;
		}
	}
	assert.equal(hasPower, true);
	assert.equal(hasCadence, true);
});

test("fit parser: empty content → parse_failed", async () => {
	const parser = createFitParserPort();
	const result = await parser.parse(parseInput(new Uint8Array(0)));

	assert.equal(result.ok, false);
	assert.equal(result.error.code, "parse_failed");
});

test("fit parser: default router routes .fit to production adapter", async () => {
	const router = createDefaultParserRouter();
	const result = await router.parse(parseInput(fitFixtureBytes()));

	assert.equal(result.ok, true);
	assert.equal(result.value.points.length, 3228);
});

test("fit parser: lap segments do not use total_cycles as pointCount", async () => {
	const parser = createFitParserPort();
	const result = await parser.parse(parseInput(fitFixtureBytes()));

	assert.equal(result.ok, true);
	if (!result.ok) {
		return;
	}

	assert.ok(result.value.segments.length > 0);
	for (const segment of result.value.segments) {
		assert.equal(segment.pointCount, null);
	}
});
