import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

test("track view layout: desktop split constants and builder", () => {
	const layout = readFileSync(
		join(ROOT, "src/ui/views/track-view-layout.ts"),
		"utf8",
	);
	assert.match(layout, /TRACK_VIEW_DESKTOP_MIN_WIDTH_PX = 769/);
	assert.match(layout, /export function buildTrackViewLayout/);
	assert.match(layout, /trackdex-track-view__stats-column/);
	assert.match(layout, /trackdex-track-view__map-column/);
});

test("track view layout: desktop CSS uses 60/40 split at 769px", () => {
	const css = readFileSync(join(ROOT, "src/styles/track-view.css"), "utf8");
	assert.match(css, /flex:\s*1\s+1\s+60%/);
	assert.match(css, /flex:\s*0\s+0\s+40%/);
	assert.match(css, /@media \(min-width: 769px\)/);
	assert.match(css, /trackdex-track-view__stats-column/);
});

test("track view layout: mobile tab switcher in builder", () => {
	const layout = readFileSync(
		join(ROOT, "src/ui/views/track-view-layout.ts"),
		"utf8",
	);
	assert.match(layout, /trackdex-track-view__mobile-tabs/);
	assert.match(layout, /trackdex-track-view__layout--tab-map/);
	assert.match(layout, /export type MobileTab/);
});

test("track view layout: mobile CSS hides inactive column at 768px", () => {
	const css = readFileSync(join(ROOT, "src/styles/track-view.css"), "utf8");
	assert.match(css, /trackdex-track-view__mobile-tabs/);
	assert.match(css, /@media \(max-width: 768px\)/);
	assert.match(css, /layout--tab-map .trackdex-track-view__stats-column/);
	assert.match(css, /layout--tab-stats .trackdex-track-view__map-column/);
});

test("track view: uses layout module and clears DOM on close", () => {
	const trackView = readFileSync(
		join(ROOT, "src/ui/views/track-view.ts"),
		"utf8",
	);
	assert.match(trackView, /buildTrackViewLayout/);
	assert.match(trackView, /from "\.\/track-view-layout"/);
	assert.match(trackView, /setMobileTab/);
	assert.match(trackView, /trackMobileTabMap/);
	assert.match(trackView, /scheduleMapResize/);
	assert.match(trackView, /closeView[\s\S]*?this\.contentEl\.empty\(\)/);
});
