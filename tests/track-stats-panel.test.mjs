import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {dirname, join} from "node:path";
import {fileURLToPath} from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

test("track stats panel loads indexed metrics via findTrackByPath", () => {
	const trackView = readFileSync(
		join(ROOT, "src/ui/views/track-view.ts"),
		"utf8",
	);
	const panel = readFileSync(
		join(ROOT, "src/ui/components/track-stats-panel.ts"),
		"utf8",
	);
	const format = readFileSync(
		join(ROOT, "src/ui/formatting/track-stats-format.ts"),
		"utf8",
	);

	assert.match(trackView, /renderTrackStatsPanel/);
	assert.match(trackView, /refreshStatsPanel/);
	assert.match(panel, /findTrackByPath/);
	assert.match(panel, /buildMetricRows/);
	assert.match(format, /MISSING_STATS_VALUE = "—"/);
	assert.doesNotMatch(panel, /parseGpxTrackPoints/);
});
