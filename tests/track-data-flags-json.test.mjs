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
	},
});

const { runMigrations } = importTs("../src/infrastructure/storage/migrations.ts");
const { createSqlTrackRepository } = importTs(
	"../src/infrastructure/storage/repositories/track-repository.ts",
);
const {
	trackDataFlagsFromJson,
	trackDataFlagsToJson,
} = importTs("../src/infrastructure/storage/repositories/track-data-flags-json.ts");
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
		exportSnapshot: () => null,
	};
}

test("track data flags json: round-trip domain flags", () => {
	const flags = {
		hasGeometry: true,
		hasTime: true,
		hasElevation: false,
		hasHr: true,
	};
	const json = trackDataFlagsToJson(flags);
	assert.equal(json, '{"hasGeometry":true,"hasTime":true,"hasElevation":false,"hasHr":true}');
	assert.deepEqual(trackDataFlagsFromJson(json), flags);
});

test("track data flags json: empty object for missing flags", () => {
	assert.equal(trackDataFlagsToJson(undefined), "{}");
	assert.deepEqual(trackDataFlagsFromJson("{}"), {});
});

test("track data flags json: rejects invalid JSON", () => {
	assert.throws(() => trackDataFlagsFromJson("{"), /invalid data_flags_json JSON/i);
	assert.throws(() => trackDataFlagsFromJson("[]"), /invalid data_flags_json/i);
});

test("track repository: partial indexed track persists visible data flags", async () => {
	const { db } = await openMigratedDatabase();
	const repo = createSqlTrackRepository(createTestStorageAdapter(db));

	const partialTrack = {
		path: "tracks/partial.gpx",
		mtimeMs: 100,
		sha256: null,
		status: "indexed",
		errorMessage: null,
		errorDetails: null,
		titleFromFile: "Partial route",
		startedAtUtc: null,
		endedAtUtc: null,
		startedAtRaw: null,
		endedAtRaw: null,
		timezoneSource: "unknown",
		timezoneOffsetMin: null,
		durationSec: null,
		distanceM: 1200,
		elevationGainM: null,
		elevationLossM: null,
		avgSpeedMps: null,
		maxSpeedMps: null,
		sportRaw: null,
		sportNormalized: null,
		bbox: { south: 48.1, west: 11.4, north: 48.2, east: 11.6 },
		polylineSimplified: null,
		segments: null,
		dataFlags: { hasGeometry: true },
		hrAvg: null,
		hrMax: null,
		powerAvg: null,
		cadenceAvg: null,
	};

	await repo.upsert(partialTrack);
	const row = await repo.findByPath("tracks/partial.gpx");

	assert.ok(row);
	assert.equal(row.status, "indexed");
	assert.deepEqual(row.dataFlags, { hasGeometry: true });
	assert.equal(row.durationSec, null);
	assert.equal(row.distanceM, 1200);

	db.close();
});
