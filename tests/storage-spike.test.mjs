import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import initSqlJs from "sql.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const WASM_PATH = join(ROOT, "node_modules/sql.js/dist/sql-wasm.wasm");

const SPIKE_META_TABLE = "_spike_meta";
const SPIKE_META_KEY = "spike";

async function openDatabase(bytes = null) {
	const wasmBinary = new Uint8Array(readFileSync(WASM_PATH));
	const SQL = await initSqlJs({ wasmBinary });
	const db = bytes ? new SQL.Database(bytes) : new SQL.Database();
	db.run(`
		CREATE TABLE IF NOT EXISTS ${SPIKE_META_TABLE} (
			key TEXT PRIMARY KEY,
			value TEXT NOT NULL
		);
	`);
	return { SQL, db };
}

function runCrud(db, markerValue) {
	db.run(`DELETE FROM ${SPIKE_META_TABLE} WHERE key = ?`, [SPIKE_META_KEY]);
	db.run(`INSERT INTO ${SPIKE_META_TABLE} (key, value) VALUES (?, ?)`, [
		SPIKE_META_KEY,
		markerValue,
	]);
	const row = db.exec(
		`SELECT value FROM ${SPIKE_META_TABLE} WHERE key = '${SPIKE_META_KEY}'`,
	);
	assert.equal(String(row[0].values[0][0]), markerValue);
	db.run(`UPDATE ${SPIKE_META_TABLE} SET value = ? WHERE key = ?`, [
		`${markerValue}-updated`,
		SPIKE_META_KEY,
	]);
	db.run(`DELETE FROM ${SPIKE_META_TABLE} WHERE key = ?`, [SPIKE_META_KEY]);
	db.run(`INSERT INTO ${SPIKE_META_TABLE} (key, value) VALUES (?, ?)`, [
		SPIKE_META_KEY,
		markerValue,
	]);
}

test("storage spike: sql.js CRUD in Node", async () => {
	const { db } = await openDatabase();
	const marker = String(Date.now());
	runCrud(db, marker);
	const row = db.exec(
		`SELECT value FROM ${SPIKE_META_TABLE} WHERE key = '${SPIKE_META_KEY}'`,
	);
	assert.equal(String(row[0].values[0][0]), marker);
	db.close();
});

test("storage spike: export/import simulates file persist", async () => {
	const marker = "persist-" + String(Date.now());
	const { db } = await openDatabase();
	runCrud(db, marker);
	const exported = db.export();
	db.close();

	const { db: reopened } = await openDatabase(exported);
	const row = reopened.exec(
		`SELECT value FROM ${SPIKE_META_TABLE} WHERE key = '${SPIKE_META_KEY}'`,
	);
	assert.equal(String(row[0].values[0][0]), marker);
	reopened.close();
});
