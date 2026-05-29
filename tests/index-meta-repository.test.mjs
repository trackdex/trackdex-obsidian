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
const { V1_SCHEMA_VERSION } = importTs(
	"../src/infrastructure/storage/migrations/v1-schema.ts",
);
const { createSqlIndexMetaRepository } = importTs(
	"../src/infrastructure/storage/repositories/index-meta-repository.ts",
);
const { createNoopLoggerPort } = importTs(
	"../src/infrastructure/logging/noop-logger-port.ts",
);

/** §7.1 lifecycle defaults after v1 migration (schema_version matches migrated DB). */
const MIGRATED_INDEX_META_DEFAULTS = {
	schemaVersion: V1_SCHEMA_VERSION,
	firstScanApproved: false,
	scanPaused: false,
	lastFullScanAtUtc: null,
	lastRunInterrupted: false,
};

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

test("index meta repository: get returns §7.1 defaults after migration", async () => {
	const { db } = await openMigratedDatabase();
	const repo = createSqlIndexMetaRepository(createTestStorageAdapter(db));
	const meta = await repo.get();
	assert.deepEqual(meta, MIGRATED_INDEX_META_DEFAULTS);
	db.close();
});

test("index meta repository: all keys round-trip via update and get", async () => {
	const { db } = await openMigratedDatabase();
	const adapter = createTestStorageAdapter(db);
	const repo = createSqlIndexMetaRepository(adapter);

	const updated = {
		schemaVersion: V1_SCHEMA_VERSION,
		firstScanApproved: true,
		scanPaused: true,
		lastFullScanAtUtc: "2026-05-29T12:00:00.000Z",
		lastRunInterrupted: true,
	};
	await repo.update(updated);
	assert.deepEqual(await repo.get(), updated);

	await repo.update({
		firstScanApproved: false,
		scanPaused: false,
		lastFullScanAtUtc: null,
		lastRunInterrupted: false,
	});
	assert.deepEqual(await repo.get(), {
		schemaVersion: V1_SCHEMA_VERSION,
		firstScanApproved: false,
		scanPaused: false,
		lastFullScanAtUtc: null,
		lastRunInterrupted: false,
	});

	const exported = adapter.exportSnapshot();
	db.close();

	const { db: db2 } = await openMigratedDatabase(exported);
	const repo2 = createSqlIndexMetaRepository(createTestStorageAdapter(db2));
	assert.deepEqual(await repo2.get(), {
		schemaVersion: V1_SCHEMA_VERSION,
		firstScanApproved: false,
		scanPaused: false,
		lastFullScanAtUtc: null,
		lastRunInterrupted: false,
	});
	db2.close();
});

test("index meta repository: partial update preserves other fields", async () => {
	const { db } = await openMigratedDatabase();
	const repo = createSqlIndexMetaRepository(createTestStorageAdapter(db));

	await repo.update({ lastFullScanAtUtc: "2026-01-01T00:00:00.000Z" });
	await repo.update({ lastRunInterrupted: true });

	assert.deepEqual(await repo.get(), {
		...MIGRATED_INDEX_META_DEFAULTS,
		lastFullScanAtUtc: "2026-01-01T00:00:00.000Z",
		lastRunInterrupted: true,
	});

	await repo.update({ scanPaused: true });
	assert.equal((await repo.get()).scanPaused, true);
	assert.equal((await repo.get()).lastFullScanAtUtc, "2026-01-01T00:00:00.000Z");

	db.close();
});

test("index meta repository: tryApproveFirstScan claims approval once", async () => {
	const { db } = await openMigratedDatabase();
	const repo = createSqlIndexMetaRepository(createTestStorageAdapter(db));

	assert.equal(await repo.tryApproveFirstScan(), true);
	assert.equal((await repo.get()).firstScanApproved, true);
	assert.equal(await repo.tryApproveFirstScan(), false);
	assert.equal((await repo.get()).firstScanApproved, true);

	db.close();
});
