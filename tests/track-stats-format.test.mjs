import test from "node:test";
import assert from "node:assert/strict";
import jiti from "jiti";

const importTs = jiti(import.meta.url);

const {
	MISSING_STATS_VALUE,
	formatCadenceRpm,
	formatDistanceM,
	formatDurationSec,
	formatElevationM,
	formatHeartRateBpm,
	formatNullableMetric,
	formatPowerW,
	formatSpeedMps,
	formatSportDisplay,
	formatTrackDateUtc,
} = importTs("../src/ui/formatting/track-stats-format.ts");

test("formatNullableMetric returns em dash for null", () => {
	assert.equal(formatNullableMetric(null, (value) => String(value)), "—");
	assert.equal(formatDistanceM(null), "—");
	assert.equal(formatDurationSec(null), "—");
});

test("formatDistanceM renders kilometers without inventing zero", () => {
	assert.equal(formatDistanceM(12_345.6), "12.35 km");
});

test("formatDurationSec renders h:mm:ss and m:ss", () => {
	assert.equal(formatDurationSec(45), "0:45");
	assert.equal(formatDurationSec(125), "2:05");
	assert.equal(formatDurationSec(3665), "1:01:05");
});

test("formatElevationM and speed formatters use metric units", () => {
	assert.equal(formatElevationM(123.7), "124 m");
	assert.equal(formatSpeedMps(2.5), "9.0 km/h");
});

test("formatHeartRateBpm, power, and cadence round to integers", () => {
	assert.equal(formatHeartRateBpm(148.2), "148 bpm");
	assert.equal(formatPowerW(201.6), "202 W");
	assert.equal(formatCadenceRpm(89.4), "89 rpm");
});

test("formatTrackDateUtc uses locale and rejects invalid input", () => {
	const formatted = formatTrackDateUtc("2024-06-01T12:00:00.000Z", "en-US");
	assert.match(formatted, /2024/);
	assert.equal(formatTrackDateUtc(null), MISSING_STATS_VALUE);
	assert.equal(formatTrackDateUtc("not-a-date"), MISSING_STATS_VALUE);
});

test("formatSportDisplay prefers normalized sport and keeps missing explicit", () => {
	assert.equal(formatSportDisplay("running", "Run"), "running");
	assert.equal(formatSportDisplay(null, "Cycling"), "Cycling");
	assert.equal(formatSportDisplay(null, null), MISSING_STATS_VALUE);
});
