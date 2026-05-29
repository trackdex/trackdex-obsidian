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

const { normalizeTimestamp, normalizeTrackTimes } = importTs(
	"../src/domain/track/time-normalization.ts",
);

const UTC_PLUS_3 = { indexingOffsetMin: 180 };

test("normalizeTimestamp: null and empty -> unknown", () => {
	for (const raw of [null, undefined, "", "   "]) {
		const result = normalizeTimestamp(raw, UTC_PLUS_3);
		assert.equal(result.raw, null);
		assert.equal(result.utcIso, null);
		assert.equal(result.timezoneSource, "unknown");
		assert.equal(result.timezoneOffsetMin, null);
	}
});

test("normalizeTimestamp: explicit UTC Z suffix", () => {
	const result = normalizeTimestamp("2024-06-01T08:00:00Z", UTC_PLUS_3);
	assert.equal(result.raw, "2024-06-01T08:00:00Z");
	assert.equal(result.utcIso, "2024-06-01T08:00:00.000Z");
	assert.equal(result.timezoneSource, "explicit");
	assert.equal(result.timezoneOffsetMin, 0);
});

test("normalizeTimestamp: explicit positive offset", () => {
	const result = normalizeTimestamp("2026-01-15T09:00:00+01:00", UTC_PLUS_3);
	assert.equal(result.utcIso, "2026-01-15T08:00:00.000Z");
	assert.equal(result.timezoneSource, "explicit");
	assert.equal(result.timezoneOffsetMin, 60);
});

test("normalizeTimestamp: explicit negative offset with minutes", () => {
	const result = normalizeTimestamp("2024-06-01T13:30:00-05:30", UTC_PLUS_3);
	assert.equal(result.utcIso, "2024-06-01T19:00:00.000Z");
	assert.equal(result.timezoneSource, "explicit");
	assert.equal(result.timezoneOffsetMin, -330);
});

test("normalizeTimestamp: explicit compact offset and lowercase z", () => {
	const plusTwo = normalizeTimestamp("2024-06-01T10:00:00+0200", UTC_PLUS_3);
	assert.equal(plusTwo.utcIso, "2024-06-01T08:00:00.000Z");
	assert.equal(plusTwo.timezoneOffsetMin, 120);

	const lowerZ = normalizeTimestamp("2024-06-01T08:00:00.123z", UTC_PLUS_3);
	assert.equal(lowerZ.utcIso, "2024-06-01T08:00:00.123Z");
	assert.equal(lowerZ.timezoneSource, "explicit");
});

test("normalizeTimestamp: naive local uses indexing offset", () => {
	const result = normalizeTimestamp("2024-06-01T08:00:00", UTC_PLUS_3);
	assert.equal(result.raw, "2024-06-01T08:00:00");
	assert.equal(result.utcIso, "2024-06-01T05:00:00.000Z");
	assert.equal(result.timezoneSource, "indexing_local");
	assert.equal(result.timezoneOffsetMin, 180);
});

test("normalizeTimestamp: naive local with fractional seconds", () => {
	const result = normalizeTimestamp("2024-06-01T08:00:00.5", { indexingOffsetMin: -300 });
	assert.equal(result.utcIso, "2024-06-01T13:00:00.500Z");
	assert.equal(result.timezoneSource, "indexing_local");
	assert.equal(result.timezoneOffsetMin, -300);
});

test("normalizeTimestamp: naive local with space separator", () => {
	const result = normalizeTimestamp("2024-06-01 08:00:00", UTC_PLUS_3);
	assert.equal(result.utcIso, "2024-06-01T05:00:00.000Z");
	assert.equal(result.timezoneSource, "indexing_local");
});

test("normalizeTimestamp: unparseable -> unknown keeps raw", () => {
	const result = normalizeTimestamp("not-a-date", UTC_PLUS_3);
	assert.equal(result.raw, "not-a-date");
	assert.equal(result.utcIso, null);
	assert.equal(result.timezoneSource, "unknown");
});

test("normalizeTimestamp: invalid naive components -> unknown", () => {
	const result = normalizeTimestamp("2024-13-40T25:99:00", UTC_PLUS_3);
	assert.equal(result.timezoneSource, "unknown");
	assert.equal(result.utcIso, null);
});

test("normalizeTrackTimes: uses track fields and falls back to points", () => {
	const result = normalizeTrackTimes(
		{
			startedAtRaw: null,
			endedAtRaw: null,
			points: [
				{ timestampRaw: "2024-06-01T08:00:00Z" },
				{ timestampRaw: "2024-06-01T08:10:00Z" },
			],
		},
		UTC_PLUS_3,
	);

	assert.equal(result.startedAtRaw, "2024-06-01T08:00:00Z");
	assert.equal(result.endedAtRaw, "2024-06-01T08:10:00Z");
	assert.equal(result.startedAtUtc, "2024-06-01T08:00:00.000Z");
	assert.equal(result.endedAtUtc, "2024-06-01T08:10:00.000Z");
	assert.equal(result.timezoneSource, "explicit");
	assert.equal(result.timezoneOffsetMin, 0);
});

test("normalizeTrackTimes: prefers track-level raw over points", () => {
	const result = normalizeTrackTimes(
		{
			startedAtRaw: "2024-06-01T08:00:00",
			endedAtRaw: "2024-06-01T09:00:00",
			points: [{ timestampRaw: "2024-06-01T07:00:00Z" }],
		},
		UTC_PLUS_3,
	);

	assert.equal(result.startedAtRaw, "2024-06-01T08:00:00");
	assert.equal(result.endedAtRaw, "2024-06-01T09:00:00");
	assert.equal(result.startedAtUtc, "2024-06-01T05:00:00.000Z");
	assert.equal(result.endedAtUtc, "2024-06-01T06:00:00.000Z");
	assert.equal(result.timezoneSource, "indexing_local");
	assert.equal(result.timezoneOffsetMin, 180);
});

test("normalizeTrackTimes: no timestamps -> unknown", () => {
	const result = normalizeTrackTimes(
		{
			startedAtRaw: null,
			endedAtRaw: null,
			points: [{ timestampRaw: null }, { timestampRaw: "  " }],
		},
		UTC_PLUS_3,
	);

	assert.equal(result.startedAtRaw, null);
	assert.equal(result.endedAtRaw, null);
	assert.equal(result.startedAtUtc, null);
	assert.equal(result.endedAtUtc, null);
	assert.equal(result.timezoneSource, "unknown");
	assert.equal(result.timezoneOffsetMin, null);
});

test("normalizeTrackTimes: endedAt falls back to last point with timestamp", () => {
	const result = normalizeTrackTimes(
		{
			startedAtRaw: "2024-06-01T08:00:00Z",
			endedAtRaw: null,
			points: [
				{ timestampRaw: "2024-06-01T08:00:00Z" },
				{ timestampRaw: null },
				{ timestampRaw: "2024-06-01T08:30:00Z" },
			],
		},
		UTC_PLUS_3,
	);

	assert.equal(result.endedAtRaw, "2024-06-01T08:30:00Z");
	assert.equal(result.endedAtUtc, "2024-06-01T08:30:00.000Z");
});
