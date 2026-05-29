import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import initSqlJs from "sql.js";
import jiti from "jiti";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const WASM_PATH = join(ROOT, "node_modules/sql.js/dist/sql-wasm.wasm");

const importTs = jiti(import.meta.url, {
	alias: {
		domain: join(ROOT, "src/domain"),
		application: join(ROOT, "src/application"),
	},
});

const { runMigrations } = importTs("../src/infrastructure/storage/migrations.ts");
const { createSqlNoteLinkRepository } = importTs(
	"../src/infrastructure/storage/repositories/note-track-link-repository.ts",
);
const { NOTE_TRACK_LINKS_TABLE } = importTs(
	"../src/infrastructure/storage/migrations/v1-schema.ts",
);
const { createNoopLoggerPort } = importTs(
	"../src/infrastructure/logging/noop-logger-port.ts",
);

async function openMigratedDatabase(bytes = null) {
	const wasmBinary = new Uint8Array(readFileSync(WASM_PATH));
	const SQL = await initSqlJs({ wasmBinary });
	const db = bytes ? new SQL.Database(bytes) : new SQL.Database();
	runMigrations(db, createNoopLoggerPort());
	return { SQL, db };
}

function createTestStorageAdapter(db) {
	let snapshot = null;
	return {
		getDatabase: () => db,
		persist: async () => {
			snapshot = db.export();
		},
		exportSnapshot: () => snapshot,
	};
}

const LINK_A = {
	notePath: "notes/trip.md",
	trackPath: "tracks/ride.gpx",
	linkText: "Morning ride",
};

const LINK_B = {
	notePath: "notes/trip.md",
	trackPath: "tracks/other.gpx",
	linkText: "Evening ride",
};

test("note track link repository: upsert and listByNotePath", async () => {
	const { db } = await openMigratedDatabase();
	const adapter = createTestStorageAdapter(db);
	const repo = createSqlNoteLinkRepository(adapter);

	await repo.upsert(LINK_A);
	await repo.upsert(LINK_B);

	const byNote = await repo.listByNotePath(LINK_A.notePath);
	const sortLinks = (a, b) =>
		a.trackPath.localeCompare(b.trackPath) || a.linkText.localeCompare(b.linkText);
	assert.equal(byNote.length, 2);
	assert.deepEqual([...byNote].sort(sortLinks), [LINK_A, LINK_B].sort(sortLinks));

	const exported = adapter.exportSnapshot();
	db.close();

	const { db: db2 } = await openMigratedDatabase(exported);
	const repo2 = createSqlNoteLinkRepository(createTestStorageAdapter(db2));
	assert.deepEqual(await repo2.listByNotePath(LINK_A.notePath), byNote);
	db2.close();
});

test("note track link repository: listByTrackPath", async () => {
	const { db } = await openMigratedDatabase();
	const repo = createSqlNoteLinkRepository(createTestStorageAdapter(db));

	await repo.upsert(LINK_A);
	await repo.upsert({
		...LINK_A,
		notePath: "notes/other.md",
		linkText: "Same track",
	});

	const byTrack = await repo.listByTrackPath(LINK_A.trackPath);
	assert.equal(byTrack.length, 2);

	db.close();
});

test("note track link repository: deleteLink removes one row", async () => {
	const { db } = await openMigratedDatabase();
	const repo = createSqlNoteLinkRepository(createTestStorageAdapter(db));

	await repo.upsert(LINK_A);
	await repo.upsert(LINK_B);

	await repo.deleteLink(LINK_A.notePath, LINK_A.trackPath, LINK_A.linkText);
	assert.equal((await repo.listByNotePath(LINK_A.notePath)).length, 1);

	db.close();
});

test("note track link repository: deleteByNotePath and deleteByTrackPath", async () => {
	const { db } = await openMigratedDatabase();
	const repo = createSqlNoteLinkRepository(createTestStorageAdapter(db));

	await repo.upsert(LINK_A);
	await repo.upsert(LINK_B);

	await repo.deleteByNotePath(LINK_A.notePath);
	assert.equal((await repo.listByNotePath(LINK_A.notePath)).length, 0);

	await repo.upsert(LINK_B);
	assert.equal((await repo.listByTrackPath(LINK_B.trackPath)).length, 1);

	await repo.deleteByTrackPath(LINK_B.trackPath);
	const remaining = db.exec(`SELECT COUNT(*) FROM ${NOTE_TRACK_LINKS_TABLE}`);
	assert.equal(remaining[0].values[0][0], 0);

	db.close();
});
