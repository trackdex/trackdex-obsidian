import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import initSqlJs from "sql.js";
import jiti from "jiti";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const WASM_PATH = join(ROOT, "node_modules/sql.js/dist/sql-wasm.wasm");

const importTs = jiti(import.meta.url);
const {
	runMigrations,
	SCHEMA_VERSION_TABLE,
	INDEX_META_TABLE,
} = importTs("../src/infrastructure/storage/migrations.ts");
const { createNoopLoggerPort } = importTs(
	"../src/infrastructure/logging/noop-logger-port.ts",
);

async function openDatabase(bytes = null) {
	const wasmBinary = new Uint8Array(readFileSync(WASM_PATH));
	const SQL = await initSqlJs({ wasmBinary });
	const db = bytes ? new SQL.Database(bytes) : new SQL.Database();
	return { SQL, db };
}

test("storage migrations: v0 bootstrap is idempotent", async () => {
	const { db } = await openDatabase();
	const logger = createNoopLoggerPort();
	runMigrations(db, logger);
	runMigrations(db, logger);
	const version = db.exec(`SELECT version FROM ${SCHEMA_VERSION_TABLE}`);
	assert.equal(Number(version[0].values[0][0]), 0);
	const meta = db.exec(
		`SELECT schema_version FROM ${INDEX_META_TABLE} WHERE id = 1`,
	);
	assert.equal(Number(meta[0].values[0][0]), 0);
	db.close();
});

test("storage migrations: export/import preserves schema tables", async () => {
	const { db } = await openDatabase();
	const logger = createNoopLoggerPort();
	runMigrations(db, logger);
	const exported = db.export();
	db.close();

	const { db: db2 } = await openDatabase(exported);
	runMigrations(db2, logger);
	const version = db2.exec(`SELECT version FROM ${SCHEMA_VERSION_TABLE}`);
	assert.equal(Number(version[0].values[0][0]), 0);
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
