import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
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
const { V1_SCHEMA_VERSION, V1_QUERY_INDEX_SPECS } = importTs(
	"../src/infrastructure/storage/migrations/v1-schema.ts",
);
const {
	TRACKS_TABLE,
	PLACES_TABLE,
	TRACK_PLACES_TABLE,
	NOTE_TRACK_LINKS_TABLE,
} = importTs("../src/infrastructure/storage/migrations/v1-schema.ts");
const { createSqlIndexResetPort } = importTs(
	"../src/infrastructure/storage/index-reset.ts",
);
const { createSqlIndexMetaRepository } = importTs(
	"../src/infrastructure/storage/repositories/index-meta-repository.ts",
);
const { createSqlTrackRepository } = importTs(
	"../src/infrastructure/storage/repositories/track-repository.ts",
);
const { createSqlPlaceRepository } = importTs(
	"../src/infrastructure/storage/repositories/place-repository.ts",
);
const { createSqlNoteLinkRepository } = importTs(
	"../src/infrastructure/storage/repositories/note-track-link-repository.ts",
);
const { resetIndex } = importTs("../src/application/workflows/reset-index.ts");
const { createNoopLoggerPort } = importTs(
	"../src/infrastructure/logging/noop-logger-port.ts",
);

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

function tableRowCount(db, table) {
	const result = db.exec(`SELECT COUNT(*) FROM ${table}`);
	return Number(result[0]?.values[0]?.[0] ?? 0);
}

function hasIndex(db, name) {
	const result = db.exec(
		`SELECT name FROM sqlite_master WHERE type = 'index' AND name = '${name}'`,
	);
	return (result[0]?.values.length ?? 0) > 0;
}

function hasTable(db, name) {
	const result = db.exec(
		`SELECT name FROM sqlite_master WHERE type = 'table' AND name = '${name}'`,
	);
	return (result[0]?.values.length ?? 0) > 0;
}

async function seedIndexedDatabase(db) {
	const adapter = createTestStorageAdapter(db);
	const tracks = createSqlTrackRepository(adapter);
	const places = createSqlPlaceRepository(adapter);
	const noteLinks = createSqlNoteLinkRepository(adapter);
	const indexMeta = createSqlIndexMetaRepository(adapter);

	await tracks.insertDiscovered({
		path: "tracks/ride.gpx",
		mtimeMs: 1_700_000_000_000,
		titleFromFile: "Ride",
	});
	await places.upsert({
		notePath: "places/cafe.md",
		geometryKind: "point",
		geometry: { kind: "point", center: { lat: 48.15, lon: 11.5 }, radiusM: 50 },
		bbox: { south: 48.14, west: 11.49, north: 48.16, east: 11.51 },
		isValid: true,
		errorMessage: null,
	});
	await places.upsertTrackPlace({
		trackPath: "tracks/ride.gpx",
		placeNotePath: "places/cafe.md",
		lastVisitAtUtc: "2026-01-15T08:00:00.000Z",
	});
	await noteLinks.upsert({
		notePath: "notes/trip.md",
		trackPath: "tracks/ride.gpx",
		linkText: "Morning ride",
	});
	await indexMeta.update({
		firstScanApproved: true,
		scanPaused: true,
		lastFullScanAtUtc: "2026-05-01T00:00:00.000Z",
		lastRunInterrupted: true,
	});

	return { adapter, indexMeta };
}

test("reset index: clears tables and resets §7.1 meta, keeps schema_version", async () => {
	const { db } = await openMigratedDatabase();
	const { adapter, indexMeta } = await seedIndexedDatabase(db);

	assert.ok(tableRowCount(db, TRACKS_TABLE) > 0);
	assert.ok(tableRowCount(db, PLACES_TABLE) > 0);
	assert.ok(tableRowCount(db, TRACK_PLACES_TABLE) > 0);
	assert.ok(tableRowCount(db, NOTE_TRACK_LINKS_TABLE) > 0);

	await resetIndex({
		indexReset: createSqlIndexResetPort(adapter),
		indexMeta,
	});

	assert.equal(tableRowCount(db, TRACKS_TABLE), 0);
	assert.equal(tableRowCount(db, PLACES_TABLE), 0);
	assert.equal(tableRowCount(db, TRACK_PLACES_TABLE), 0);
	assert.equal(tableRowCount(db, NOTE_TRACK_LINKS_TABLE), 0);
	assert.deepEqual(await indexMeta.get(), MIGRATED_INDEX_META_DEFAULTS);
	db.close();
});

test("reset index: schema and §6.1 indexes remain after reset", async () => {
	const { db } = await openMigratedDatabase();
	const { adapter, indexMeta } = await seedIndexedDatabase(db);

	await resetIndex({
		indexReset: createSqlIndexResetPort(adapter),
		indexMeta,
	});

	for (const table of [
		TRACKS_TABLE,
		PLACES_TABLE,
		TRACK_PLACES_TABLE,
		NOTE_TRACK_LINKS_TABLE,
	]) {
		assert.ok(hasTable(db, table), `missing table ${table}`);
	}
	for (const spec of V1_QUERY_INDEX_SPECS) {
		assert.ok(hasIndex(db, spec.name), `missing index ${spec.name}`);
	}

	db.close();
});

test("reset index: vault track file mtime unchanged (no vault ports in workflow)", async () => {
	const vaultDir = mkdtempSync(join(tmpdir(), "trackdex-reset-vault-"));
	const trackPath = join(vaultDir, "ride.gpx");
	writeFileSync(trackPath, "<gpx/>");
	const mtimeBefore = statSync(trackPath).mtimeMs;

	const { db } = await openMigratedDatabase();
	const { adapter, indexMeta } = await seedIndexedDatabase(db);
	await resetIndex({
		indexReset: createSqlIndexResetPort(adapter),
		indexMeta,
	});

	assert.equal(statSync(trackPath).mtimeMs, mtimeBefore);
	db.close();
});
