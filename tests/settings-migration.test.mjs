import test from "node:test";
import assert from "node:assert/strict";
import jiti from "jiti";

const importTs = jiti(import.meta.url);
const {migrateSettings} = importTs("../src/ui/settings/migrate-settings.ts");
const {DEFAULT_SETTINGS} = importTs("../src/ui/settings/settings-types.ts");

test("migrateSettings strips legacy prototype keys", () => {
	const {settings, strippedLegacy} = migrateSettings({
		tracksFolder: "custom",
		basemapTileUrl: "https://example.com/{z}/{x}/{y}.png",
		basemapStyleUrl: "https://old.example/style.json",
	});
	assert.deepEqual(settings, DEFAULT_SETTINGS);
	assert.equal(strippedLegacy, true);
});

test("migrateSettings leaves clean JSON unchanged", () => {
	const {settings, strippedLegacy} = migrateSettings({});
	assert.deepEqual(settings, DEFAULT_SETTINGS);
	assert.equal(strippedLegacy, false);
});

test("migrateSettings preserves scanExcludePatterns from saved data", () => {
	const {settings, strippedLegacy} = migrateSettings({
		scanExcludePatterns: ["archive/**", 42, "drafts/*"],
	});
	assert.deepEqual(settings.scanExcludePatterns, ["archive/**", "drafts/*"]);
	assert.equal(strippedLegacy, false);
});
