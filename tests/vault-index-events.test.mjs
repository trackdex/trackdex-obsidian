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
	resolveVaultTrackRenameEvents,
	shouldDispatchVaultTrackEvents,
	vaultPathBasename,
} = importTs("../src/infrastructure/obsidian/vault-index-events.ts");
const { isVaultTrackFileCandidate } = importTs(
	"../src/infrastructure/obsidian/vault-scanner.ts",
);

test("vault index events: scan paused blocks dispatch", () => {
	assert.equal(shouldDispatchVaultTrackEvents(false), true);
	assert.equal(shouldDispatchVaultTrackEvents(true), false);
});

test("vault index events: extension and exclude filter", () => {
	assert.equal(
		isVaultTrackFileCandidate({ path: "tracks/a.gpx", name: "a.gpx" }),
		true,
	);
	assert.equal(
		isVaultTrackFileCandidate({ path: "notes/journal.md", name: "journal.md" }),
		false,
	);
	assert.equal(
		isVaultTrackFileCandidate(
			{ path: ".obsidian/hidden.gpx", name: "hidden.gpx" },
		),
		false,
	);
	assert.equal(
		isVaultTrackFileCandidate(
			{ path: "archive/retired.gpx", name: "retired.gpx" },
			{ scanExcludePatterns: ["archive/**"] },
		),
		false,
	);
});

test("vault index events: rename track to track updates path", () => {
	const events = resolveVaultTrackRenameEvents({
		oldPath: "tracks/alpha.gpx",
		newPath: "tracks/beta.gpx",
		newName: "beta.gpx",
		mtimeMs: 42,
	});

	assert.deepEqual(events, [
		{
			kind: "renamed",
			oldPath: "tracks/alpha.gpx",
			newPath: "tracks/beta.gpx",
			mtimeMs: 42,
		},
	]);
});

test("vault index events: rename track to non-track deletes old path", () => {
	const events = resolveVaultTrackRenameEvents({
		oldPath: "tracks/alpha.gpx",
		newPath: "notes/alpha.md",
		newName: "alpha.md",
		mtimeMs: 1,
	});

	assert.deepEqual(events, [{ kind: "deleted", path: "tracks/alpha.gpx" }]);
});

test("vault index events: rename non-track to track creates pending path", () => {
	const events = resolveVaultTrackRenameEvents({
		oldPath: "notes/draft.md",
		newPath: "tracks/new.gpx",
		newName: "new.gpx",
		mtimeMs: 99,
	});

	assert.deepEqual(events, [
		{ kind: "created", path: "tracks/new.gpx", mtimeMs: 99 },
	]);
});

test("vault index events: rename unrelated paths emits nothing", () => {
	const events = resolveVaultTrackRenameEvents({
		oldPath: "notes/a.md",
		newPath: "notes/b.md",
		newName: "b.md",
		mtimeMs: 0,
	});

	assert.deepEqual(events, []);
});

test("vault index events: basename for old path on delete/rename", () => {
	assert.equal(vaultPathBasename("tracks/nested/ride.GPX"), "ride.GPX");
	assert.equal(vaultPathBasename(".\\tracks\\a.tcx"), "a.tcx");
});
