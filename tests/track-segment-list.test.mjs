import test from "node:test";
import assert from "node:assert/strict";
import jiti from "jiti";

const importTs = jiti(import.meta.url);

const {
	computeSegmentDurationSec,
	formatSegmentDistance,
	formatSegmentDuration,
	formatSegmentName,
	formatSegmentPointCount,
	shouldShowSegmentList,
} = importTs("../src/ui/formatting/track-segment-format.ts");

const {buildSegmentRows} = importTs("../src/ui/components/track-segment-list.ts");

test("shouldShowSegmentList is true only for multi-segment tracks", () => {
	assert.equal(shouldShowSegmentList(null), false);
	assert.equal(shouldShowSegmentList([]), false);
	assert.equal(shouldShowSegmentList([{id: "seg-1"}]), false);
	assert.equal(
		shouldShowSegmentList([{id: "seg-1"}, {id: "seg-2"}]),
		true,
	);
});

test("computeSegmentDurationSec derives seconds from raw timestamps", () => {
	assert.equal(
		computeSegmentDurationSec(
			"2024-06-01T10:00:00.000Z",
			"2024-06-01T10:05:30.000Z",
		),
		330,
	);
	assert.equal(computeSegmentDurationSec(null, "2024-06-01T10:05:30.000Z"), null);
	assert.equal(
		computeSegmentDurationSec(
			"2024-06-01T10:05:30.000Z",
			"2024-06-01T10:00:00.000Z",
		),
		null,
	);
	assert.equal(
		computeSegmentDurationSec("not-a-date", "2024-06-01T10:05:30.000Z"),
		null,
	);
});

test("formatSegmentDuration and distance use em dash for missing values", () => {
	const segment = {
		id: "seg-1",
		startedAtRaw: null,
		endedAtRaw: null,
		pointCount: null,
	};
	assert.equal(formatSegmentDuration(segment), "—");
	assert.equal(formatSegmentDistance(segment), "—");
	assert.equal(formatSegmentPointCount(null), "—");
	assert.equal(formatSegmentPointCount(42), "42");
});

test("formatSegmentName falls back when name is blank", () => {
	assert.equal(formatSegmentName("Lap 1", "Segment 1"), "Lap 1");
	assert.equal(formatSegmentName("  ", "Segment 2"), "Segment 2");
	assert.equal(formatSegmentName(null, "Segment 3"), "Segment 3");
});

test("buildSegmentRows formats indexed segment metadata", () => {
	const rows = buildSegmentRows([
		{
			id: "seg-1",
			name: "Warm up",
			startedAtRaw: "2024-06-01T10:00:00.000Z",
			endedAtRaw: "2024-06-01T10:10:00.000Z",
			pointCount: 120,
		},
		{
			id: "seg-2",
			name: null,
			startedAtRaw: "2024-06-01T10:10:00.000Z",
			endedAtRaw: "2024-06-01T10:25:00.000Z",
			pointCount: 300,
		},
	]);

	assert.equal(rows.length, 2);
	assert.equal(rows[0].name, "Warm up");
	assert.equal(rows[0].duration, "10:00");
	assert.equal(rows[0].distance, "—");
	assert.equal(rows[0].pointCount, "120");
	assert.equal(rows[1].duration, "15:00");
});
