/**
 * Integration smoke for v1 schema (0.2-11): migration startup, track CRUD, reload via export/import.
 */
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

const { runMigrations, SCHEMA_VERSION_TABLE, LATEST_SCHEMA_VERSION } = importTs(
	"../src/infrastructure/storage/migrations.ts",
);
const { V1_SCHEMA_VERSION, TRACKS_TABLE } = importTs(
	"../src/infrastructure/storage/migrations/v1-schema.ts",
);
const { createSqlTrackRepository } = importTs(
	"../src/infrastructure/storage/repositories/track-repository.ts",
);
const {
	SCHEMA_SMOKE_TRACK_PATH,
	runStorageSchemaSmokeWrite,
	runStorageSchemaSmokeVerify,
} = importTs("../src/infrastructure/storage/schema-smoke-runner.ts");
const { createNoopLoggerPort } = importTs(
	"../src/infrastructure/logging/noop-logger-port.ts",
);

async function openDatabase(bytes = null) {
	const wasmBinary = new Uint8Array(readFileSync(WASM_PATH));
	const SQL = await initSqlJs({ wasmBinary });
	return { SQL, db: bytes ? new SQL.Database(bytes) : new SQL.Database() };
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

function readSchemaVersion(db) {
	const version = db.exec(`SELECT version FROM ${SCHEMA_VERSION_TABLE} LIMIT 1`);
	return Number(version[0].values[0][0]);
}

function hasTable(db, name) {
	const result = db.exec(
		`SELECT name FROM sqlite_master WHERE type = 'table' AND name = '${name}'`,
	);
	return (result[0]?.values.length ?? 0) > 0;
}

test("storage schema smoke: fresh install applies v1 migration", async () => {
	const { db } = await openDatabase();
	const logger = createNoopLoggerPort();
	runMigrations(db, logger);
	assert.equal(readSchemaVersion(db), V1_SCHEMA_VERSION);
	assert.equal(LATEST_SCHEMA_VERSION, V1_SCHEMA_VERSION);
	assert.ok(hasTable(db, TRACKS_TABLE));
	db.close();
});

test("storage schema smoke: track CRUD via repository", async () => {
	const { db } = await openDatabase();
	runMigrations(db, createNoopLoggerPort());
	const tracks = createSqlTrackRepository(createTestStorageAdapter(db));

	const write = await runStorageSchemaSmokeWrite(tracks);
	assert.equal(write.ok, true, write.message);

	const verify = await runStorageSchemaSmokeVerify(tracks, write.marker);
	assert.equal(verify.ok, true, verify.message);

	await tracks.deleteByPath(SCHEMA_SMOKE_TRACK_PATH);
	assert.equal(await tracks.findByPath(SCHEMA_SMOKE_TRACK_PATH), null);

	db.close();
});

test("storage schema smoke: reload reopens DB and preserves smoke row", async () => {
	const { db } = await openDatabase();
	runMigrations(db, createNoopLoggerPort());
	const adapter = createTestStorageAdapter(db);
	const tracks = createSqlTrackRepository(adapter);

	const write = await runStorageSchemaSmokeWrite(tracks);
	assert.equal(write.ok, true);

	const exported = adapter.exportSnapshot();
	assert.ok(exported);
	db.close();

	const { db: db2 } = await openDatabase(exported);
	runMigrations(db2, createNoopLoggerPort());
	const tracks2 = createSqlTrackRepository(createTestStorageAdapter(db2));
	const verify = await runStorageSchemaSmokeVerify(tracks2, write.marker);
	assert.equal(verify.ok, true, verify.message);
	db2.close();
});
