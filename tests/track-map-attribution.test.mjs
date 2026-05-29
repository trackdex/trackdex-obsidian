import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {dirname, join} from "node:path";
import {fileURLToPath} from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

test("track map attribution: component and view wiring", () => {
	const component = readFileSync(
		join(ROOT, "src/ui/components/track-map-attribution.ts"),
		"utf8",
	);
	const trackView = readFileSync(
		join(ROOT, "src/ui/views/track-view.ts"),
		"utf8",
	);
	const layout = readFileSync(
		join(ROOT, "src/ui/views/track-view-layout.ts"),
		"utf8",
	);
	const basemap = readFileSync(
		join(ROOT, "src/infrastructure/map/track-basemap.ts"),
		"utf8",
	);

	assert.match(component, /renderTrackMapAttribution/);
	assert.match(component, /DEFAULT_BASEMAP_ATTRIBUTION|tileAttributionHtml/);
	assert.match(component, /trackMapAttributionLegalLink/);
	assert.match(trackView, /renderTrackMapAttribution/);
	assert.match(trackView, /syncMapAttribution/);
	assert.match(trackView, /openPluginSettings/);
	assert.match(layout, /mapAttributionHostEl/);
	assert.match(basemap, /attributionControl: false/);
});

test("track map attribution: settings legal block and i18n", () => {
	const settings = readFileSync(
		join(ROOT, "src/ui/settings/settings-tab.ts"),
		"utf8",
	);
	const en = readFileSync(join(ROOT, "src/ui/i18n/locales/en.ts"), "utf8");
	const ru = readFileSync(join(ROOT, "src/ui/i18n/locales/ru.ts"), "utf8");
	const css = readFileSync(join(ROOT, "src/styles/track-view.css"), "utf8");

	assert.match(settings, /settings\.legalTitle/);
	assert.match(settings, /trackdex-settings__legal/);
	assert.match(en, /trackMapAttributionLegalLink/);
	assert.match(en, /legalTileNetwork/);
	assert.match(ru, /trackMapAttributionLegalLink/);
	assert.match(ru, /legalTileNetwork/);
	assert.match(css, /trackdex-track-stub__attribution-host/);
});
