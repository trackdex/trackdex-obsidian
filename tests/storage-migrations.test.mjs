import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import initSqlJs from "sql.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const WASM_PATH = join(ROOT, "node_modules/sql.js/dist/sql-wasm.wasm");

const SCHEMA_VERSION_TABLE = "schema_version";
const INDEX_META_TABLE = "index_meta";

function applyMigrationV0(db) {
	db.run(`
		CREATE TABLE IF NOT EXISTS ${SCHEMA_VERSION_TABLE} (
			version INTEGER NOT NULL
		);
	`);
	const versionRows = db.exec(`SELECT version FROM ${SCHEMA_VERSION_TABLE} LIMIT 1`);
	if (!versionRows[0]?.values.length) {
		db.run(`INSERT INTO ${SCHEMA_VERSION_TABLE} (version) VALUES (0)`);
	}

	db.run(`
		CREATE TABLE IF NOT EXISTS ${INDEX_META_TABLE} (
			id INTEGER PRIMARY KEY CHECK (id = 1),
			schema_version INTEGER NOT NULL DEFAULT 0,
			first_scan_approved INTEGER NOT NULL DEFAULT 0,
			scan_paused INTEGER NOT NULL DEFAULT 0,
			last_full_scan_at_utc TEXT,
			last_run_interrupted INTEGER NOT NULL DEFAULT 0
		);
	`);
	const metaRows = db.exec(`SELECT id FROM ${INDEX_META_TABLE} WHERE id = 1`);
	if (!metaRows[0]?.values.length) {
		db.run(
			`INSERT INTO ${INDEX_META_TABLE} (
				id, schema_version, first_scan_approved, scan_paused, last_run_interrupted
			) VALUES (1, 0, 0, 0, 0)`,
		);
	}
}

async function openDatabase(bytes = null) {
	const wasmBinary = new Uint8Array(readFileSync(WASM_PATH));
	const SQL = await initSqlJs({ wasmBinary });
	return bytes ? new SQL.Database(bytes) : new SQL.Database();
}

test("storage migrations: v0 bootstrap is idempotent", async () => {
	const db = await openDatabase();
	applyMigrationV0(db);
	applyMigrationV0(db);
	const version = db.exec(`SELECT version FROM ${SCHEMA_VERSION_TABLE}`);
	assert.equal(Number(version[0].values[0][0]), 0);
	const meta = db.exec(`SELECT schema_version FROM ${INDEX_META_TABLE} WHERE id = 1`);
	assert.equal(Number(meta[0].values[0][0]), 0);
	db.close();
});

test("storage migrations: export/import preserves schema tables", async () => {
	const db = await openDatabase();
	applyMigrationV0(db);
	const exported = db.export();
	db.close();

	const db2 = await openDatabase(exported);
	applyMigrationV0(db2);
	const version = db2.exec(`SELECT version FROM ${SCHEMA_VERSION_TABLE}`);
	assert.equal(Number(version[0].values[0][0]), 0);
	db2.close();
});
