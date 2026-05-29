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
const { createSqlTrackRepository } = importTs(
	"../src/infrastructure/storage/repositories/track-repository.ts",
);
const { assertTrackStatus } = importTs(
	"../src/infrastructure/storage/repositories/track-record-row.ts",
);
const { TRACKS_TABLE, TRACK_PLACES_TABLE, NOTE_TRACK_LINKS_TABLE } = importTs(
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

/** Minimal indexed track with JSON columns populated. */
const SAMPLE_TRACK = {
	path: "tracks/ride.gpx",
	mtimeMs: 1_700_000_000_000,
	sha256: "abc123",
	status: "indexed",
	errorMessage: null,
	errorDetails: null,
	titleFromFile: "Morning ride",
	startedAtUtc: "2026-01-15T08:00:00.000Z",
	endedAtUtc: "2026-01-15T09:30:00.000Z",
	startedAtRaw: "2026-01-15T09:00:00+01:00",
	endedAtRaw: null,
	timezoneSource: "explicit",
	timezoneOffsetMin: 60,
	durationSec: 5400,
	distanceM: 42_000,
	elevationGainM: 320,
	elevationLossM: 310,
	avgSpeedMps: 7.8,
	maxSpeedMps: 14.2,
	sportRaw: "cycling",
	sportNormalized: "cycling",
	bbox: { south: 48.1, west: 11.4, north: 48.2, east: 11.6 },
	polylineSimplified: [
		{ lat: 48.15, lon: 11.5 },
		{ lat: 48.16, lon: 11.55 },
	],
	segments: [{ id: "seg-1", name: "Lap 1", pointCount: 1200 }],
	dataFlags: { hasGeometry: true, hasTime: true, hasSport: true },
	hrAvg: 142,
	hrMax: 178,
	powerAvg: 210,
	cadenceAvg: 88,
};

test("track repository: insertDiscovered defaults to pending", async () => {
	const { db } = await openMigratedDatabase();
	const repo = createSqlTrackRepository(createTestStorageAdapter(db));

	await repo.insertDiscovered({
		path: "tracks/new.fit",
		mtimeMs: 100,
		titleFromFile: "New file",
	});

	const row = await repo.findByPath("tracks/new.fit");
	assert.ok(row);
	assert.equal(row.status, "pending");
	assert.equal(row.timezoneSource, "unknown");
	assert.deepEqual(row.dataFlags, {});
	assert.equal(row.titleFromFile, "New file");
	assert.equal(row.sha256, null);

	db.close();
});

test("track repository: upsert and findByPath round-trip JSON fields", async () => {
	const { db } = await openMigratedDatabase();
	const adapter = createTestStorageAdapter(db);
	const repo = createSqlTrackRepository(adapter);

	await repo.upsert(SAMPLE_TRACK);
	assert.deepEqual(await repo.findByPath(SAMPLE_TRACK.path), SAMPLE_TRACK);

	const exported = adapter.exportSnapshot();
	db.close();

	const { db: db2 } = await openMigratedDatabase(exported);
	const repo2 = createSqlTrackRepository(createTestStorageAdapter(db2));
	assert.deepEqual(await repo2.findByPath(SAMPLE_TRACK.path), SAMPLE_TRACK);
	db2.close();
});

test("track repository: upsert updates existing row", async () => {
	const { db } = await openMigratedDatabase();
	const repo = createSqlTrackRepository(createTestStorageAdapter(db));

	await repo.upsert(SAMPLE_TRACK);
	await repo.upsert({
		...SAMPLE_TRACK,
		distanceM: 50_000,
		status: "stale",
	});
	const updated = await repo.findByPath(SAMPLE_TRACK.path);
	assert.equal(updated.distanceM, 50_000);
	assert.equal(updated.status, "stale");

	db.close();
});

test("track repository: deleteByPath removes row and cascades relations", async () => {
	const { db } = await openMigratedDatabase();
	const repo = createSqlTrackRepository(createTestStorageAdapter(db));

	await repo.upsert(SAMPLE_TRACK);
	db.run(
		`INSERT INTO ${TRACK_PLACES_TABLE} (track_path, place_note_path) VALUES (?, ?)`,
		[SAMPLE_TRACK.path, "places/cafe.md"],
	);
	db.run(
		`INSERT INTO ${NOTE_TRACK_LINKS_TABLE} (note_path, track_path, link_text) VALUES (?, ?, ?)`,
		["notes/trip.md", SAMPLE_TRACK.path, "ride"],
	);

	await repo.deleteByPath(SAMPLE_TRACK.path);
	assert.equal(await repo.findByPath(SAMPLE_TRACK.path), null);

	const tp = db.exec(
		`SELECT COUNT(*) FROM ${TRACK_PLACES_TABLE} WHERE track_path = '${SAMPLE_TRACK.path}'`,
	);
	assert.equal(tp[0].values[0][0], 0);

	const links = db.exec(
		`SELECT COUNT(*) FROM ${NOTE_TRACK_LINKS_TABLE} WHERE track_path = '${SAMPLE_TRACK.path}'`,
	);
	assert.equal(links[0].values[0][0], 0);

	db.close();
});

test("track repository: updateStatus sets and clears errors", async () => {
	const { db } = await openMigratedDatabase();
	const repo = createSqlTrackRepository(createTestStorageAdapter(db));

	await repo.insertDiscovered({ path: "tracks/err.gpx", mtimeMs: 1 });

	await repo.updateStatus("tracks/err.gpx", "error", {
		message: "Parse failed",
		details: "line 12",
	});
	let row = await repo.findByPath("tracks/err.gpx");
	assert.equal(row.status, "error");
	assert.equal(row.errorMessage, "Parse failed");
	assert.equal(row.errorDetails, "line 12");

	await repo.updateStatus("tracks/err.gpx", "pending");
	row = await repo.findByPath("tracks/err.gpx");
	assert.equal(row.status, "pending");
	assert.equal(row.errorMessage, null);
	assert.equal(row.errorDetails, null);

	db.close();
});

test("track repository: listPathsByStatus and countByStatus", async () => {
	const { db } = await openMigratedDatabase();
	const repo = createSqlTrackRepository(createTestStorageAdapter(db));

	await repo.insertDiscovered({ path: "tracks/a.gpx", mtimeMs: 1 });
	await repo.insertDiscovered({ path: "tracks/b.gpx", mtimeMs: 2 });
	await repo.updateStatus("tracks/b.gpx", "indexing");

	assert.deepEqual(await repo.listPathsByStatus("pending"), ["tracks/a.gpx"]);
	assert.equal(await repo.countByStatus("pending"), 1);
	assert.equal(await repo.countByStatus("indexing"), 1);

	db.close();
});

test("track repository: list filters by status and errorsOnly", async () => {
	const { db } = await openMigratedDatabase();
	const repo = createSqlTrackRepository(createTestStorageAdapter(db));

	await repo.upsert(SAMPLE_TRACK);
	await repo.insertDiscovered({ path: "tracks/bad.gpx", mtimeMs: 1 });
	await repo.updateStatus("tracks/bad.gpx", "error", { message: "bad" });

	const indexed = await repo.list({ statuses: ["indexed"] });
	assert.equal(indexed.length, 1);
	assert.equal(indexed[0].path, SAMPLE_TRACK.path);

	const errors = await repo.list({ errorsOnly: true });
	assert.equal(errors.length, 1);
	assert.equal(errors[0].path, "tracks/bad.gpx");

	db.close();
});

test("track repository: renamePath updates tracks and FK-shaped tables", async () => {
	const { db } = await openMigratedDatabase();
	const repo = createSqlTrackRepository(createTestStorageAdapter(db));

	await repo.upsert(SAMPLE_TRACK);
	db.run(
		`INSERT INTO ${TRACK_PLACES_TABLE} (track_path, place_note_path) VALUES (?, ?)`,
		[SAMPLE_TRACK.path, "places/cafe.md"],
	);
	db.run(
		`INSERT INTO ${NOTE_TRACK_LINKS_TABLE} (note_path, track_path, link_text) VALUES (?, ?, ?)`,
		["notes/trip.md", SAMPLE_TRACK.path, "ride"],
	);

	await repo.renamePath(SAMPLE_TRACK.path, "tracks/renamed.gpx", 2_000);

	assert.equal(await repo.findByPath(SAMPLE_TRACK.path), null);
	const renamed = await repo.findByPath("tracks/renamed.gpx");
	assert.equal(renamed.mtimeMs, 2_000);

	const tp = db.exec(
		`SELECT track_path FROM ${TRACK_PLACES_TABLE} WHERE place_note_path = 'places/cafe.md'`,
	);
	assert.equal(tp[0].values[0][0], "tracks/renamed.gpx");

	const link = db.exec(
		`SELECT track_path FROM ${NOTE_TRACK_LINKS_TABLE} WHERE note_path = 'notes/trip.md'`,
	);
	assert.equal(link[0].values[0][0], "tracks/renamed.gpx");

	db.close();
});

test("track repository: invalid status rejected before SQLite", () => {
	assert.throws(
		() => assertTrackStatus("not-a-status"),
		/invalid track status/i,
	);
});

test("track repository: DB CHECK rejects invalid status on insert", async () => {
	const { db } = await openMigratedDatabase();
	const bad = {
		...SAMPLE_TRACK,
		path: "tracks/invalid-status.gpx",
		status: "not-a-status",
	};

	assert.throws(() => {
		db.run(
			`INSERT INTO ${TRACKS_TABLE} (path, mtime_ms, status, timezone_source, data_flags_json)
			 VALUES (?, ?, ?, 'unknown', '{}')`,
			[bad.path, bad.mtimeMs, bad.status],
		);
	}, /CHECK constraint failed/i);

	db.close();
});
