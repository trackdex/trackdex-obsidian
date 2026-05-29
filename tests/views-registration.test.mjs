import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

test("views: track and sidebar view type constants", () => {
	const constants = readFileSync(join(ROOT, "src/constants.ts"), "utf8");
	assert.match(constants, /trackdex-track-view/);
	assert.match(constants, /trackdex-tracks-sidebar/);
	assert.match(constants, /"gpx"/);
	assert.match(constants, /"tcx"/);
	assert.match(constants, /"fit"/);
	assert.match(constants, /"gz"/);
	assert.match(constants, /TRACKDEX_REGISTERED_FILE_EXTENSIONS/);
});

test("views: registerViews wires container in composition", () => {
	const registerViews = readFileSync(
		join(ROOT, "src/composition/register-views.ts"),
		"utf8",
	);
	assert.match(registerViews, /export function registerViews/);
	assert.match(registerViews, /container\.trackQuery/);
	assert.match(registerViews, /container\.indexMeta/);
	assert.match(registerViews, /container\.indexing/);
	assert.match(registerViews, /TracksSidebarView/);
	assert.match(registerViews, /TrackView/);
});

test("views: tracks sidebar shows interrupted-run banner wiring", () => {
	const sidebar = readFileSync(
		join(ROOT, "src/ui/views/tracks-sidebar-view.ts"),
		"utf8",
	);
	assert.match(sidebar, /lastRunInterrupted/);
	assert.match(sidebar, /scanProgress\.getSnapshot\(\)\.active/);
	assert.match(sidebar, /renderInterruptedRunBanner/);
	assert.match(sidebar, /resumeAfterInterrupt/);
});
