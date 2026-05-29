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

const { aggregateParsedTrackForCatalog } = importTs(
	"../src/domain/track/segment-aggregation.ts",
);
const { computeTrackMetrics, haversineDistanceM } = importTs(
	"../src/domain/track/track-metrics.ts",
);
const { normalizeTrackTimes } = importTs("../src/domain/track/time-normalization.ts");
const { parseGpxDocumentToParsedTrack } = importTs(
	"../src/infrastructure/parsers/gpx-parser.ts",
);

const UTC_CONTEXT = { indexingOffsetMin: 0 };

function parseSampleTrackGpx() {
	const xml = readFileSync(join(FIXTURES, "sample-track.gpx"), "utf8");
	const doc = new DOMParser().parseFromString(xml, "application/xml");
	return parseGpxDocumentToParsedTrack(doc);
}

test("aggregateParsedTrackForCatalog: multi-segment fixture → one row + segments list", () => {
	const parsed = parseSampleTrackGpx();
	const aggregated = aggregateParsedTrackForCatalog(parsed, UTC_CONTEXT);

	assert.equal(parsed.segments.length, 2);
	assert.ok(aggregated.segments);
	assert.equal(aggregated.segments.length, 2);
	assert.equal(aggregated.segments[0]?.id, "seg-1");
	assert.equal(aggregated.segments[0]?.pointCount, 2);
	assert.equal(aggregated.segments[1]?.id, "seg-2");
	assert.equal(aggregated.segments[1]?.pointCount, 1);
	assert.equal(aggregated.segments[0]?.startedAtRaw, "2024-06-01T08:00:00Z");
	assert.equal(aggregated.segments[0]?.endedAtRaw, "2024-06-01T08:05:00Z");

	assert.equal(aggregated.titleFromFile, "Morning ride");
	assert.equal(aggregated.sportRaw, "cycling");
	assert.deepEqual(aggregated.bbox, parsed.bbox);
	assert.ok(aggregated.polylineSimplified);
	assert.ok(aggregated.polylineSimplified.length >= 2);

	assert.equal(aggregated.times.startedAtRaw, "2024-06-01T08:00:00Z");
	assert.equal(aggregated.times.endedAtRaw, "2024-06-01T08:10:00Z");
	assert.equal(aggregated.times.startedAtUtc, "2024-06-01T08:00:00.000Z");
	assert.equal(aggregated.times.endedAtUtc, "2024-06-01T08:10:00.000Z");

	const directTimes = normalizeTrackTimes(parsed, UTC_CONTEXT);
	const directMetrics = computeTrackMetrics(parsed.points, directTimes, UTC_CONTEXT);
	assert.deepEqual(aggregated.metrics, directMetrics);
	assert.equal(aggregated.metrics.durationSec, 600);
	assert.ok(aggregated.metrics.distanceM > 0);

	const expectedDistance =
		haversineDistanceM(
			{ lat: parsed.points[0].lat, lon: parsed.points[0].lon },
			{ lat: parsed.points[1].lat, lon: parsed.points[1].lon },
		) +
		haversineDistanceM(
			{ lat: parsed.points[1].lat, lon: parsed.points[1].lon },
			{ lat: parsed.points[2].lat, lon: parsed.points[2].lon },
		);
	assert.ok(Math.abs(aggregated.metrics.distanceM - expectedDistance) < 0.001);
	assert.equal(aggregated.metrics.hrAvg, 122.5);
});

test("aggregateParsedTrackForCatalog: no segments → segments null", () => {
	const parsed = {
		titleFromFile: null,
		sportRaw: null,
		startedAtRaw: null,
		endedAtRaw: null,
		points: [
			{
				lat: 0,
				lon: 0,
				elevationM: null,
				timestampRaw: null,
				hrBpm: null,
				powerW: null,
				cadenceRpm: null,
				speedMps: null,
			},
		],
		segments: [],
		bbox: null,
	};

	const aggregated = aggregateParsedTrackForCatalog(parsed, UTC_CONTEXT);
	assert.equal(aggregated.segments, null);
	assert.ok(aggregated.metrics.distanceM >= 0 || aggregated.metrics.distanceM === null);
});

test("aggregateParsedTrackForCatalog: reindex stability", () => {
	const parsed = parseSampleTrackGpx();
	const first = aggregateParsedTrackForCatalog(parsed, UTC_CONTEXT);
	const second = aggregateParsedTrackForCatalog(parsed, UTC_CONTEXT);
	assert.deepEqual(second, first);
});
