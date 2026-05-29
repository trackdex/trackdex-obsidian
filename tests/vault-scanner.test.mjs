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

const { listTrackFilesFromCandidates } = importTs(
	"../src/infrastructure/obsidian/vault-scanner.ts",
);
const { normalizeVaultRelativePath } = importTs("../src/domain/shared/vault-path.ts");

/** Representative vault tree for discovery tests (§7.2 extensions). */
const FIXTURE_VAULT_FILES = [
	{ path: "tracks/alpha.gpx", name: "alpha.gpx" },
	{ path: "tracks/Beta.TCX", name: "Beta.TCX" },
	{ path: "nested/deep/Gamma.Fit", name: "Gamma.Fit" },
	{ path: "runs/3828427456.fit.gz", name: "3828427456.fit.gz" },
	{ path: "runs/UPPER.FIT.GZ", name: "UPPER.FIT.GZ" },
	{ path: "notes/journal.md", name: "journal.md" },
	{ path: "archive/4074711732.gpx.gz", name: "4074711732.gpx.gz" },
	{ path: ".obsidian/plugins/trackdex/data.json", name: "data.json" },
	{ path: ".obsidian/hidden.gpx", name: "hidden.gpx" },
	{ path: ".trash/deleted.tcx", name: "deleted.tcx" },
];

test("vault scanner: fixture listing finds all v1 track extensions", () => {
	const found = listTrackFilesFromCandidates(FIXTURE_VAULT_FILES);

	assert.deepEqual(
		found.map((f) => f.path),
		[
			"nested/deep/Gamma.Fit",
			"runs/3828427456.fit.gz",
			"runs/UPPER.FIT.GZ",
			"tracks/alpha.gpx",
			"tracks/Beta.TCX",
		],
	);
	assert.deepEqual(
		found.map((f) => f.extension),
		["fit", "fit.gz", "fit.gz", "gpx", "tcx"],
	);
});

test("vault scanner: case variants on extension suffix", () => {
	const found = listTrackFilesFromCandidates([
		{ path: "a.GPX", name: "a.GPX" },
		{ path: "b.TcX", name: "b.TcX" },
		{ path: "c.FiT", name: "c.FiT" },
		{ path: "d.Fit.Gz", name: "d.Fit.Gz" },
	]);

	assert.equal(found.length, 4);
	assert.deepEqual(
		found.map((f) => f.extension),
		["gpx", "tcx", "fit", "fit.gz"],
	);
});

test("vault scanner: default excludes skip .obsidian and .trash tracks", () => {
	const found = listTrackFilesFromCandidates(FIXTURE_VAULT_FILES);

	assert.equal(
		found.some((f) => f.path.startsWith(".obsidian/")),
		false,
	);
	assert.equal(
		found.some((f) => f.path.startsWith(".trash/")),
		false,
	);
});

test("vault scanner: user exclude patterns apply with defaults", () => {
	const found = listTrackFilesFromCandidates(
		[
			...FIXTURE_VAULT_FILES,
			{ path: "archive/retired.gpx", name: "retired.gpx" },
		],
		{ scanExcludePatterns: ["archive/**"] },
	);

	assert.equal(
		found.some((f) => f.path === "archive/retired.gpx"),
		false,
	);
	assert.equal(
		found.some((f) => f.path === "tracks/alpha.gpx"),
		true,
	);
});

test("vault scanner: normalizes vault-relative paths", () => {
	assert.equal(normalizeVaultRelativePath(".\\tracks\\ride.gpx"), "tracks/ride.gpx");
	assert.equal(normalizeVaultRelativePath("./tracks/ride.gpx"), "tracks/ride.gpx");
	assert.equal(normalizeVaultRelativePath("/tracks/ride.gpx"), "tracks/ride.gpx");

	const found = listTrackFilesFromCandidates([
		{ path: ".\\tracks\\mixed.GPX", name: "mixed.GPX" },
	]);
	assert.equal(found.length, 1);
	assert.equal(found[0].path, "tracks/mixed.GPX");
	assert.equal(found[0].extension, "gpx");
});
