import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
	FIXTURES,
	assertPartialTrack,
	deriveTrackDataFlags,
	parseFixture,
} from "./helpers.mjs";

/** Valid / partial / invalid matrix for v1 parser formats (0.4-12). */
const PARSER_FIXTURE_MATRIX = [
	{
		id: "gpx-valid",
		extension: "gpx",
		category: "valid",
		fixture: "sample-track.gpx",
	},
	{
		id: "gpx-partial",
		extension: "gpx",
		category: "partial",
		fixture: "partial-track.gpx",
	},
	{
		id: "gpx-invalid",
		extension: "gpx",
		category: "invalid",
		fixture: "malformed-track.gpx",
	},
	{
		id: "tcx-valid",
		extension: "tcx",
		category: "valid",
		fixture: "sample-activity.tcx",
	},
	{
		id: "tcx-partial",
		extension: "tcx",
		category: "partial",
		fixture: "partial-activity.tcx",
	},
	{
		id: "tcx-invalid",
		extension: "tcx",
		category: "invalid",
		fixture: "malformed-activity.tcx",
	},
	{
		id: "fit-valid",
		extension: "fit",
		category: "valid",
		fixture: "sample-activity.fit",
	},
	{
		id: "fit-partial",
		extension: "fit",
		category: "partial",
		fixture: "partial-activity.fit",
	},
	{
		id: "fit-invalid",
		extension: "fit",
		category: "invalid",
		fixture: "malformed-activity.fit",
	},
	{
		id: "fit-gz-valid",
		extension: "fit.gz",
		category: "valid",
		fixture: "sample-activity.fit.gz",
	},
	{
		id: "fit-gz-partial",
		extension: "fit.gz",
		category: "partial",
		fixture: "partial-activity.fit.gz",
	},
	{
		id: "fit-gz-invalid",
		extension: "fit.gz",
		category: "invalid",
		fixture: "malformed-activity.fit.gz",
	},
];

test("parser fixture matrix: all declared fixtures exist on disk", () => {
	for (const entry of PARSER_FIXTURE_MATRIX) {
		const bytes = readFileSync(join(FIXTURES, entry.fixture));
		assert.ok(bytes.length > 0, `${entry.fixture} should not be empty`);
	}
});

for (const entry of PARSER_FIXTURE_MATRIX) {
	test(`parser fixture matrix: ${entry.id}`, async () => {
		const result = await parseFixture(entry.extension, entry.fixture);

		if (entry.category === "invalid") {
			assert.equal(result.ok, false, `${entry.id} should fail to parse`);
			if (result.ok) {
				return;
			}
			assert.equal(result.error.code, "parse_failed");
			return;
		}

		assert.equal(result.ok, true, `${entry.id} should parse successfully`);
		if (!result.ok) {
			return;
		}

		const track = result.value;
		assert.ok(track.points.length > 0, `${entry.id} should include GPS points`);
		assert.ok(track.bbox, `${entry.id} should compute bbox`);

		if (entry.category === "partial") {
			assertPartialTrack(track);
			return;
		}

		switch (entry.id) {
			case "gpx-valid":
				assert.equal(track.titleFromFile, "Morning ride");
				assert.equal(track.sportRaw, "cycling");
				assert.equal(track.points.length, 3);
				assert.equal(track.segments.length, 2);
				assert.deepEqual(deriveTrackDataFlags(track), {
					hasGeometry: true,
					hasTime: true,
					hasElevation: true,
					hasHr: true,
					hasSport: true,
				});
				break;
			case "tcx-valid":
				assert.equal(track.titleFromFile, "Morning ride");
				assert.equal(track.sportRaw, "Biking");
				assert.equal(track.points.length, 3);
				assert.equal(track.segments.length, 2);
				assert.deepEqual(deriveTrackDataFlags(track), {
					hasGeometry: true,
					hasTime: true,
					hasElevation: true,
					hasHr: true,
					hasPower: true,
					hasSport: true,
					hasCadence: true,
					hasFileMetrics: true,
				});
				break;
			case "fit-valid":
				assert.equal(track.sportRaw, "cycling");
				assert.ok(track.points.length > 1000);
				assert.equal(track.segments.length, 1);
				assert.ok(track.points.some((point) => point.powerW !== null));
				assert.ok(track.points.some((point) => point.cadenceRpm !== null));
				break;
			case "fit-gz-valid":
				assert.equal(track.sportRaw, "cycling");
				assert.ok(track.points.length > 1000);
				assert.equal(track.startedAtRaw, "2015-10-12T15:47:45.000Z");
				break;
			default:
				assert.fail(`missing valid expectations for ${entry.id}`);
		}
	});
}

test("parser fixture matrix: covers all v1 formats and categories", () => {
	const formats = new Set(PARSER_FIXTURE_MATRIX.map((entry) => entry.extension));
	const categories = new Set(
		PARSER_FIXTURE_MATRIX.map((entry) => entry.category),
	);

	assert.deepEqual([...formats].sort(), ["fit", "fit.gz", "gpx", "tcx"]);
	assert.deepEqual([...categories].sort(), ["invalid", "partial", "valid"]);
	assert.equal(PARSER_FIXTURE_MATRIX.length, 12);
});
