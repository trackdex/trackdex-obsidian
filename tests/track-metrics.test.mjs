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

const {
	computeTrackMetrics,
	haversineDistanceM,
	ELEVATION_GAIN_LOSS_THRESHOLD_M,
} = importTs("../src/domain/track/track-metrics.ts");
const { normalizeTrackTimes } = importTs("../src/domain/track/time-normalization.ts");

const UTC_CONTEXT = { indexingOffsetMin: 0 };

function point(overrides) {
	return {
		lat: 0,
		lon: 0,
		elevationM: null,
		timestampRaw: null,
		hrBpm: null,
		powerW: null,
		cadenceRpm: null,
		speedMps: null,
		...overrides,
	};
}

function metricsFor(points, trackTimes = {}, context = UTC_CONTEXT) {
	const times = normalizeTrackTimes(
		{
			startedAtRaw: trackTimes.startedAtRaw ?? null,
			endedAtRaw: trackTimes.endedAtRaw ?? null,
			points,
		},
		context,
	);
	return computeTrackMetrics(points, times, context);
}

test("haversineDistanceM: equator one arc-minute longitude", () => {
	const distance = haversineDistanceM(
		{ lat: 0, lon: 0 },
		{ lat: 0, lon: 1 / 60 },
	);
	assert.equal(distance, 1853.2487774093122);
});

test("computeTrackMetrics: empty points -> null core metrics", () => {
	const result = metricsFor([]);
	assert.equal(result.durationSec, null);
	assert.equal(result.distanceM, null);
	assert.equal(result.elevationGainM, null);
	assert.equal(result.elevationLossM, null);
	assert.equal(result.avgSpeedMps, null);
	assert.equal(result.maxSpeedMps, null);
	assert.equal(result.hrAvg, null);
	assert.equal(result.hrMax, null);
	assert.equal(result.powerAvg, null);
	assert.equal(result.cadenceAvg, null);
});

test("computeTrackMetrics: deterministic distance elapsed speeds", () => {
	const seg1 = haversineDistanceM(
		{ lat: 0, lon: 0 },
		{ lat: 0, lon: 0.001 },
	);
	const seg2 = haversineDistanceM(
		{ lat: 0, lon: 0.001 },
		{ lat: 0, lon: 0.002 },
	);
	const expectedDistance = seg1 + seg2;

	const points = [
		point({
			lat: 0,
			lon: 0,
			timestampRaw: "2024-06-01T08:00:00Z",
			speedMps: 2,
		}),
		point({
			lat: 0,
			lon: 0.001,
			timestampRaw: "2024-06-01T08:05:00Z",
			speedMps: 4.5,
		}),
		point({
			lat: 0,
			lon: 0.002,
			timestampRaw: "2024-06-01T08:10:00Z",
			speedMps: 3,
		}),
	];

	const result = metricsFor(points, {
		startedAtRaw: "2024-06-01T08:00:00Z",
		endedAtRaw: "2024-06-01T08:10:00Z",
	});

	assert.ok(Math.abs(result.distanceM - expectedDistance) < 0.001);
	assert.equal(result.durationSec, 600);
	assert.ok(Math.abs(result.avgSpeedMps - expectedDistance / 600) < 0.000_001);
	assert.equal(result.maxSpeedMps, 4.5);
});

test(`computeTrackMetrics: elevation gain/loss with ${ELEVATION_GAIN_LOSS_THRESHOLD_M}m threshold`, () => {
	const points = [
		point({ elevationM: 100, timestampRaw: "2024-06-01T08:00:00Z" }),
		point({ elevationM: 104, timestampRaw: "2024-06-01T08:01:00Z" }),
		point({ elevationM: 110, timestampRaw: "2024-06-01T08:02:00Z" }),
		point({ elevationM: 105, timestampRaw: "2024-06-01T08:03:00Z" }),
	];

	const result = metricsFor(points, {
		startedAtRaw: "2024-06-01T08:00:00Z",
		endedAtRaw: "2024-06-01T08:03:00Z",
	});

	assert.equal(result.elevationGainM, 10);
	assert.equal(result.elevationLossM, 5);
});

test("computeTrackMetrics: elevation below threshold yields zero gain/loss", () => {
	const points = [
		point({ elevationM: 100 }),
		point({ elevationM: 102 }),
		point({ elevationM: 101 }),
	];

	const result = metricsFor(points);
	assert.equal(result.elevationGainM, 0);
	assert.equal(result.elevationLossM, 0);
});

test("computeTrackMetrics: no elevation samples -> null gain/loss", () => {
	const points = [point({ lat: 1, lon: 1 }), point({ lat: 1.001, lon: 1.001 })];
	const result = metricsFor(points);
	assert.equal(result.elevationGainM, null);
	assert.equal(result.elevationLossM, null);
});

test("computeTrackMetrics: optional HR/cadence/power only when present", () => {
	const withSamples = metricsFor([
		point({ hrBpm: 100, powerW: 200, cadenceRpm: 80 }),
		point({ hrBpm: null, powerW: 220, cadenceRpm: 90 }),
		point({ hrBpm: 120, powerW: null, cadenceRpm: 100 }),
	]);
	assert.equal(withSamples.hrAvg, 110);
	assert.equal(withSamples.hrMax, 120);
	assert.equal(withSamples.powerAvg, 210);
	assert.equal(withSamples.cadenceAvg, 90);

	const withoutSamples = metricsFor([point({}), point({ lat: 1, lon: 1 })]);
	assert.equal(withoutSamples.hrAvg, null);
	assert.equal(withoutSamples.hrMax, null);
	assert.equal(withoutSamples.powerAvg, null);
	assert.equal(withoutSamples.cadenceAvg, null);
});

test("computeTrackMetrics: max speed derived when samples absent", () => {
	const points = [
		point({
			lat: 0,
			lon: 0,
			timestampRaw: "2024-06-01T08:00:00Z",
		}),
		point({
			lat: 0,
			lon: 0.001,
			timestampRaw: "2024-06-01T08:01:00Z",
		}),
		point({
			lat: 0,
			lon: 0.003,
			timestampRaw: "2024-06-01T08:02:00Z",
		}),
	];

	const result = metricsFor(points, {
		startedAtRaw: "2024-06-01T08:00:00Z",
		endedAtRaw: "2024-06-01T08:02:00Z",
	});

	const slowSeg = haversineDistanceM(
		{ lat: 0, lon: 0 },
		{ lat: 0, lon: 0.001 },
	);
	const fastSeg = haversineDistanceM(
		{ lat: 0, lon: 0.001 },
		{ lat: 0, lon: 0.003 },
	);
	const expectedMax = Math.max(slowSeg / 60, fastSeg / 60);

	assert.ok(Math.abs(result.maxSpeedMps - expectedMax) < 0.000_001);
});

test("computeTrackMetrics: unknown timestamps -> null duration and avg speed", () => {
	const points = [
		point({ lat: 0, lon: 0 }),
		point({ lat: 0, lon: 0.001 }),
	];
	const result = metricsFor(points);
	assert.equal(result.durationSec, null);
	assert.equal(result.avgSpeedMps, null);
	assert.ok(result.distanceM > 0);
});

test("computeTrackMetrics: reindex stability — identical input yields identical output", () => {
	const points = [
		point({
			lat: 48.1,
			lon: 11.5,
			elevationM: 520,
			timestampRaw: "2024-06-01T08:00:00Z",
			hrBpm: 142,
			speedMps: 2.8,
		}),
		point({
			lat: 48.1005,
			lon: 11.501,
			elevationM: 528,
			timestampRaw: "2024-06-01T08:02:30Z",
			hrBpm: 155,
			powerW: 180,
			cadenceRpm: 88,
		}),
		point({
			lat: 48.101,
			lon: 11.502,
			elevationM: 524,
			timestampRaw: "2024-06-01T08:05:00Z",
			hrBpm: 148,
			powerW: 175,
			cadenceRpm: 86,
			speedMps: 3.1,
		}),
	];
	const trackTimes = {
		startedAtRaw: "2024-06-01T08:00:00Z",
		endedAtRaw: "2024-06-01T08:05:00Z",
	};

	const first = metricsFor(points, trackTimes);
	const second = metricsFor(points, trackTimes);

	assert.deepEqual(second, first);
});
