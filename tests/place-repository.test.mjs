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
const { createSqlPlaceRepository } = importTs(
	"../src/infrastructure/storage/repositories/place-repository.ts",
);
const { PLACES_TABLE, TRACK_PLACES_TABLE } = importTs(
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

const SAMPLE_PLACE = {
	notePath: "places/cafe.md",
	geometryKind: "point",
	geometry: { kind: "point", center: { lat: 48.15, lon: 11.5 }, radiusM: 50 },
	bbox: { south: 48.14, west: 11.49, north: 48.16, east: 11.51 },
	isValid: true,
	errorMessage: null,
};

const INVALID_PLACE = {
	notePath: "places/broken.md",
	geometryKind: "polygon",
	geometry: {
		kind: "polygon",
		ring: [
			{ lat: 1, lon: 1 },
			{ lat: 2, lon: 2 },
		],
	},
	bbox: null,
	isValid: false,
	errorMessage: "Self-intersecting ring",
};

test("place repository: upsert and findByNotePath round-trip", async () => {
	const { db } = await openMigratedDatabase();
	const adapter = createTestStorageAdapter(db);
	const repo = createSqlPlaceRepository(adapter);

	await repo.upsert(SAMPLE_PLACE);
	assert.deepEqual(await repo.findByNotePath(SAMPLE_PLACE.notePath), SAMPLE_PLACE);

	const exported = adapter.exportSnapshot();
	db.close();

	const { db: db2 } = await openMigratedDatabase(exported);
	const repo2 = createSqlPlaceRepository(createTestStorageAdapter(db2));
	assert.deepEqual(await repo2.findByNotePath(SAMPLE_PLACE.notePath), SAMPLE_PLACE);
	db2.close();
});

test("place repository: upsert updates existing row", async () => {
	const { db } = await openMigratedDatabase();
	const repo = createSqlPlaceRepository(createTestStorageAdapter(db));

	await repo.upsert(SAMPLE_PLACE);
	await repo.upsert({
		...SAMPLE_PLACE,
		isValid: false,
		errorMessage: "Updated error",
	});
	const updated = await repo.findByNotePath(SAMPLE_PLACE.notePath);
	assert.equal(updated.isValid, false);
	assert.equal(updated.errorMessage, "Updated error");

	db.close();
});

test("place repository: listValid excludes invalid places", async () => {
	const { db } = await openMigratedDatabase();
	const repo = createSqlPlaceRepository(createTestStorageAdapter(db));

	await repo.upsert(SAMPLE_PLACE);
	await repo.upsert(INVALID_PLACE);

	const valid = await repo.listValid();
	assert.equal(valid.length, 1);
	assert.equal(valid[0].notePath, SAMPLE_PLACE.notePath);

	db.close();
});

test("place repository: deleteByNotePath cascades track_places", async () => {
	const { db } = await openMigratedDatabase();
	const repo = createSqlPlaceRepository(createTestStorageAdapter(db));

	await repo.upsert(SAMPLE_PLACE);
	db.run(
		`INSERT INTO ${TRACK_PLACES_TABLE} (track_path, place_note_path) VALUES (?, ?)`,
		["tracks/a.gpx", SAMPLE_PLACE.notePath],
	);

	await repo.deleteByNotePath(SAMPLE_PLACE.notePath);
	assert.equal(await repo.findByNotePath(SAMPLE_PLACE.notePath), null);

	const tp = db.exec(
		`SELECT COUNT(*) FROM ${TRACK_PLACES_TABLE} WHERE place_note_path = '${SAMPLE_PLACE.notePath}'`,
	);
	assert.equal(tp[0].values[0][0], 0);

	const places = db.exec(`SELECT COUNT(*) FROM ${PLACES_TABLE}`);
	assert.equal(places[0].values[0][0], 0);

	db.close();
});
