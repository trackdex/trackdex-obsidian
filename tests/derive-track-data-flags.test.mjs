import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DOMParser } from "@xmldom/xmldom";
import jiti from "jiti";

globalThis.DOMParser = DOMParser;

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FIXTURES = join(ROOT, "tests/fixtures");
const importTs = jiti(import.meta.url, {
	alias: {
		domain: join(ROOT, "src/domain"),
	},
});

const { deriveTrackDataFlags } = importTs("../src/domain/track/derive-track-data-flags.ts");
const { aggregateParsedTrackForCatalog } = importTs(
	"../src/domain/track/segment-aggregation.ts",
);
const { parseGpxDocumentToParsedTrack } = importTs(
	"../src/infrastructure/parsers/gpx-parser.ts",
);

const UTC_CONTEXT = { indexingOffsetMin: 0 };

function point(overrides = {}) {
	return {
		lat: 48.1,
		lon: 11.5,
		elevationM: null,
		timestampRaw: null,
		hrBpm: null,
		powerW: null,
		cadenceRpm: null,
		speedMps: null,
		...overrides,
	};
}

function parseSampleTrackGpx() {
	const xml = readFileSync(join(FIXTURES, "sample-track.gpx"), "utf8");
	const doc = new DOMParser().parseFromString(xml, "application/xml");
	return parseGpxDocumentToParsedTrack(doc);
}

test("deriveTrackDataFlags: full fixture exposes geometry, time, sport, elevation, hr", () => {
	const parsed = parseSampleTrackGpx();
	const flags = deriveTrackDataFlags(parsed);

	assert.deepEqual(flags, {
		hasGeometry: true,
		hasTime: true,
		hasElevation: true,
		hasHr: true,
		hasSport: true,
	});
});

test("deriveTrackDataFlags: partial track only marks present fields", () => {
	const flags = deriveTrackDataFlags({
		titleFromFile: null,
		sportRaw: null,
		startedAtRaw: null,
		endedAtRaw: null,
		points: [point()],
		segments: [],
		bbox: null,
	});

	assert.deepEqual(flags, { hasGeometry: true });
});

test("deriveTrackDataFlags: empty track yields no true flags", () => {
	const flags = deriveTrackDataFlags({
		titleFromFile: null,
		sportRaw: null,
		startedAtRaw: null,
		endedAtRaw: null,
		points: [],
		segments: [],
		bbox: null,
	});

	assert.deepEqual(flags, {});
});

test("deriveTrackDataFlags: file-level timestamps count as time", () => {
	const flags = deriveTrackDataFlags({
		titleFromFile: null,
		sportRaw: null,
		startedAtRaw: "2024-06-01T08:00:00Z",
		endedAtRaw: null,
		points: [],
		segments: [],
		bbox: null,
	});

	assert.deepEqual(flags, { hasTime: true });
});

test("deriveTrackDataFlags: optional sensors and file metrics", () => {
	const flags = deriveTrackDataFlags({
		titleFromFile: null,
		sportRaw: "running",
		startedAtRaw: null,
		endedAtRaw: null,
		points: [
			point({ powerW: 180, cadenceRpm: 90, speedMps: 3.2 }),
		],
		segments: [],
		bbox: null,
	});

	assert.deepEqual(flags, {
		hasGeometry: true,
		hasPower: true,
		hasCadence: true,
		hasSport: true,
		hasFileMetrics: true,
	});
});

test("aggregateParsedTrackForCatalog: includes derived data flags", () => {
	const parsed = parseSampleTrackGpx();
	const aggregated = aggregateParsedTrackForCatalog(parsed, UTC_CONTEXT);

	assert.deepEqual(aggregated.dataFlags, deriveTrackDataFlags(parsed));
});

test("deriveTrackDataFlags: reindex stability", () => {
	const parsed = parseSampleTrackGpx();
	const first = deriveTrackDataFlags(parsed);
	const second = deriveTrackDataFlags(parsed);
	assert.deepEqual(second, first);
});
