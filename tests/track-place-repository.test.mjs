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
const { createSqlTrackPlaceRepository } = importTs(
	"../src/infrastructure/storage/repositories/track-place-repository.ts",
);
const { TRACK_PLACES_TABLE } = importTs(
	"../src/infrastructure/storage/migrations/v1-schema.ts",
);
const { createNoopLoggerPort } = importTs(
	"../src/infrastructure/logging/noop-logger-port.ts",
);

async function openMigratedDatabase() {
	const wasmBinary = new Uint8Array(readFileSync(WASM_PATH));
	const SQL = await initSqlJs({ wasmBinary });
	const db = new SQL.Database();
	runMigrations(db, createNoopLoggerPort());
	return { db };
}

function createTestStorageAdapter(db) {
	return {
		getDatabase: () => db,
		persist: async () => {},
	};
}

const REL_A = {
	trackPath: "tracks/ride.gpx",
	placeNotePath: "places/cafe.md",
	lastVisitAtUtc: "2026-01-15T10:00:00.000Z",
};

const REL_B = {
	trackPath: "tracks/ride.gpx",
	placeNotePath: "places/park.md",
	lastVisitAtUtc: null,
};

test("track place repository: upsert and list by track", async () => {
	const { db } = await openMigratedDatabase();
	const repo = createSqlTrackPlaceRepository(createTestStorageAdapter(db));

	await repo.upsertTrackPlace(REL_A);
	await repo.upsertTrackPlace(REL_B);

	const forTrack = await repo.listTrackPlacesForTrack(REL_A.trackPath);
	assert.equal(forTrack.length, 2);
	assert.deepEqual(forTrack[0], REL_A);
	assert.deepEqual(forTrack[1], REL_B);

	db.close();
});

test("track place repository: upsert updates last_visit_at_utc", async () => {
	const { db } = await openMigratedDatabase();
	const repo = createSqlTrackPlaceRepository(createTestStorageAdapter(db));

	await repo.upsertTrackPlace(REL_A);
	await repo.upsertTrackPlace({
		...REL_A,
		lastVisitAtUtc: "2026-02-01T12:00:00.000Z",
	});

	const [row] = await repo.listTrackPlacesForTrack(REL_A.trackPath);
	assert.equal(row.lastVisitAtUtc, "2026-02-01T12:00:00.000Z");

	db.close();
});

test("track place repository: list by place and delete single relation", async () => {
	const { db } = await openMigratedDatabase();
	const repo = createSqlTrackPlaceRepository(createTestStorageAdapter(db));

	await repo.upsertTrackPlace(REL_A);
	await repo.upsertTrackPlace({
		...REL_A,
		trackPath: "tracks/other.gpx",
	});

	const forPlace = await repo.listTrackPlacesForPlace(REL_A.placeNotePath);
	assert.equal(forPlace.length, 2);

	await repo.deleteTrackPlace(REL_A.trackPath, REL_A.placeNotePath);
	assert.equal((await repo.listTrackPlacesForPlace(REL_A.placeNotePath)).length, 1);

	db.close();
});

test("track place repository: deleteTrackPlacesForTrack and deleteTrackPlacesForPlace", async () => {
	const { db } = await openMigratedDatabase();
	const repo = createSqlTrackPlaceRepository(createTestStorageAdapter(db));

	await repo.upsertTrackPlace(REL_A);
	await repo.upsertTrackPlace(REL_B);

	await repo.deleteTrackPlacesForTrack(REL_A.trackPath);
	assert.equal((await repo.listTrackPlacesForTrack(REL_A.trackPath)).length, 0);

	await repo.upsertTrackPlace(REL_A);
	await repo.deleteTrackPlacesForPlace(REL_A.placeNotePath);
	const remaining = db.exec(`SELECT COUNT(*) FROM ${TRACK_PLACES_TABLE}`);
	assert.equal(remaining[0].values[0][0], 0);

	db.close();
});
