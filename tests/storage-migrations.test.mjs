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
const {
	runMigrations,
	applyMigrationV0,
	SCHEMA_VERSION_TABLE,
	INDEX_META_TABLE,
	LATEST_SCHEMA_VERSION,
} = importTs("../src/infrastructure/storage/migrations.ts");
const { applyMigrationV1 } = importTs(
	"../src/infrastructure/storage/migrations/v1.ts",
);
const {
	V1_SCHEMA_VERSION,
	V1_QUERY_INDEX_SPECS,
	applyV1SchemaDdl,
} = importTs("../src/infrastructure/storage/migrations/v1-schema.ts");
const TRACKS_TABLE = "tracks";
const PLACES_TABLE = "places";
const TRACK_PLACES_TABLE = "track_places";
const NOTE_TRACK_LINKS_TABLE = "note_track_links";
const { createNoopLoggerPort } = importTs(
	"../src/infrastructure/logging/noop-logger-port.ts",
);

async function openDatabase(bytes = null) {
	const wasmBinary = new Uint8Array(readFileSync(WASM_PATH));
	const SQL = await initSqlJs({ wasmBinary });
	const db = bytes ? new SQL.Database(bytes) : new SQL.Database();
	return { SQL, db };
}

function readVersion(db) {
	const version = db.exec(`SELECT version FROM ${SCHEMA_VERSION_TABLE}`);
	return Number(version[0].values[0][0]);
}

function readIndexMetaSchemaVersion(db) {
	const meta = db.exec(
		`SELECT schema_version FROM ${INDEX_META_TABLE} WHERE id = 1`,
	);
	return Number(meta[0].values[0][0]);
}

function hasTable(db, name) {
	const result = db.exec(
		`SELECT name FROM sqlite_master WHERE type = 'table' AND name = '${name}'`,
	);
	return (result[0]?.values.length ?? 0) > 0;
}

function hasIndex(db, name) {
	const result = db.exec(
		`SELECT name FROM sqlite_master WHERE type = 'index' AND name = '${name}'`,
	);
	return (result[0]?.values.length ?? 0) > 0;
}

function indexTable(db, name) {
	const result = db.exec(
		`SELECT tbl_name FROM sqlite_master WHERE type = 'index' AND name = '${name}'`,
	);
	return result[0]?.values[0]?.[0] ?? null;
}

function indexColumns(db, name) {
	const info = db.exec(`PRAGMA index_info('${name}')`);
	return (info[0]?.values ?? []).map((row) => row[2]);
}

function assertV1QueryIndexes(db) {
	for (const spec of V1_QUERY_INDEX_SPECS) {
		assert.ok(hasIndex(db, spec.name), `missing index ${spec.name}`);
		assert.equal(indexTable(db, spec.name), spec.table);
		assert.deepEqual(indexColumns(db, spec.name), spec.columns);
	}
}

test("storage migrations: fresh DB applies v1 once", async () => {
	const { db } = await openDatabase();
	const logger = createNoopLoggerPort();
	runMigrations(db, logger);
	assert.equal(readVersion(db), V1_SCHEMA_VERSION);
	assert.equal(readIndexMetaSchemaVersion(db), V1_SCHEMA_VERSION);
	assert.equal(LATEST_SCHEMA_VERSION, V1_SCHEMA_VERSION);
	assert.ok(hasTable(db, TRACKS_TABLE));
	assert.ok(hasTable(db, PLACES_TABLE));
	assert.ok(hasTable(db, TRACK_PLACES_TABLE));
	assert.ok(hasTable(db, NOTE_TRACK_LINKS_TABLE));
	assertV1QueryIndexes(db);
	db.close();
});

test("storage migrations: §6.1 query indexes are idempotent", async () => {
	const { db } = await openDatabase();
	const logger = createNoopLoggerPort();
	runMigrations(db, logger);
	assertV1QueryIndexes(db);
	applyV1SchemaDdl(db);
	assertV1QueryIndexes(db);
	runMigrations(db, logger);
	assertV1QueryIndexes(db);
	db.close();
});

test("storage migrations: repeat onload is no-op", async () => {
	const { db } = await openDatabase();
	const logger = createNoopLoggerPort();
	runMigrations(db, logger);
	runMigrations(db, logger);
	assert.equal(readVersion(db), V1_SCHEMA_VERSION);
	assert.equal(readIndexMetaSchemaVersion(db), V1_SCHEMA_VERSION);
	assertV1QueryIndexes(db);
	db.close();
});

test("storage migrations: export/import preserves v1 schema", async () => {
	const { db } = await openDatabase();
	const logger = createNoopLoggerPort();
	runMigrations(db, logger);
	const exported = db.export();
	db.close();

	const { db: db2 } = await openDatabase(exported);
	runMigrations(db2, logger);
	assert.equal(readVersion(db2), V1_SCHEMA_VERSION);
	assert.ok(hasTable(db2, TRACKS_TABLE));
	assertV1QueryIndexes(db2);
	db2.close();
});

test("storage migrations: rejects newer schema than supported", async () => {
	const { db } = await openDatabase();
	db.run(`
		CREATE TABLE ${SCHEMA_VERSION_TABLE} (
			version INTEGER NOT NULL
		);
	`);
	db.run(`INSERT INTO ${SCHEMA_VERSION_TABLE} (version) VALUES (99)`);
	const logger = createNoopLoggerPort();
	assert.throws(
		() => runMigrations(db, logger),
		/newer than supported/,
	);
	db.close();
});

test("storage migrations: v1 failure inside transaction rolls back", async () => {
	const { db } = await openDatabase();
	const logger = createNoopLoggerPort();
	applyMigrationV0(db);
	db.run(`UPDATE ${INDEX_META_TABLE} SET first_scan_approved = 1 WHERE id = 1`);
	assert.equal(readVersion(db), 0);
	assert.ok(!hasTable(db, TRACKS_TABLE));

	db.run("BEGIN");
	try {
		applyMigrationV1(db);
		throw new Error("simulated migration failure");
	} catch {
		db.run("ROLLBACK");
	}

	assert.equal(readVersion(db), 0);
	assert.equal(readIndexMetaSchemaVersion(db), 0);
	assert.ok(!hasTable(db, TRACKS_TABLE));
	const meta = db.exec(
		`SELECT first_scan_approved FROM ${INDEX_META_TABLE} WHERE id = 1`,
	);
	assert.equal(Number(meta[0].values[0][0]), 1);

	runMigrations(db, logger);
	assert.equal(readVersion(db), V1_SCHEMA_VERSION);
	assert.ok(hasTable(db, TRACKS_TABLE));
	assertV1QueryIndexes(db);
	db.close();
});
