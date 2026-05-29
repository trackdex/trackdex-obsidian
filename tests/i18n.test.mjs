import test from "node:test";
import assert from "node:assert/strict";
import jiti from "jiti";

const importTs = jiti(import.meta.url);
const {normalizeLocaleTag, createTranslator, interpolate} = importTs(
	"../src/ui/i18n/index.ts",
);

test("normalizeLocaleTag maps ru variants and falls back to en", () => {
	assert.equal(normalizeLocaleTag("ru"), "ru");
	assert.equal(normalizeLocaleTag("ru-RU"), "ru");
	assert.equal(normalizeLocaleTag("RU"), "ru");
	assert.equal(normalizeLocaleTag("en"), "en");
	assert.equal(normalizeLocaleTag("de"), "en");
	assert.equal(normalizeLocaleTag(undefined), "en");
});

test("createTranslator returns RU strings for ru locale", () => {
	const tr = createTranslator("ru");
	assert.equal(tr("commands.openTracksSidebar"), "Открыть каталог треков");
});

test("createTranslator falls back to EN then key for missing entries", () => {
	const tr = createTranslator("en");
	assert.equal(tr("commands.openTracksSidebar"), "Open track catalog");
	assert.equal(tr("commands.nonexistentKey"), "commands.nonexistentKey");
});

test("interpolate replaces named placeholders", () => {
	assert.equal(
		interpolate("Folder: {folder}", {folder: "tracks"}),
		"Folder: tracks",
	);
});
