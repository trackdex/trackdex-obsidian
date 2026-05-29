import test from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import jiti from "jiti";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const importTs = jiti(import.meta.url, {
	alias: {
		domain: join(ROOT, "src/domain"),
		application: join(ROOT, "src/application"),
	},
});

const {
	DEFAULT_SCAN_EXCLUDE_PATTERNS,
	isVaultPathExcluded,
	resolveScanExcludePatterns,
} = importTs("../src/application/indexing/exclude-matcher.ts");

test("exclude matcher: default patterns skip .obsidian and .trash", () => {
	const patterns = resolveScanExcludePatterns([]);

	assert.deepEqual(patterns, [...DEFAULT_SCAN_EXCLUDE_PATTERNS]);
	assert.equal(
		isVaultPathExcluded(".obsidian/plugins/trackdex/data.json", patterns),
		true,
	);
	assert.equal(isVaultPathExcluded(".obsidian/hidden.gpx", patterns), true);
	assert.equal(isVaultPathExcluded(".trash/old-ride.gpx", patterns), true);
	assert.equal(isVaultPathExcluded("tracks/alpha.gpx", patterns), false);
});

test("exclude matcher: user glob excludes matching vault paths", () => {
	const patterns = resolveScanExcludePatterns(["archive/**", "**/drafts/*"]);

	assert.equal(isVaultPathExcluded("archive/2024/ride.gpx", patterns), true);
	assert.equal(isVaultPathExcluded("nested/drafts/temp.fit", patterns), true);
	assert.equal(isVaultPathExcluded("tracks/alpha.gpx", patterns), false);
	assert.equal(isVaultPathExcluded(".obsidian/cache.gpx", patterns), true);
});
