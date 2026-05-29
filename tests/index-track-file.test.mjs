import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DOMParser } from "@xmldom/xmldom";
import jiti from "jiti";

globalThis.DOMParser = DOMParser;

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FIXTURES = join(ROOT, "tests/fixtures");
const importTs = jiti(import.meta.url, {
	alias: {
		domain: join(ROOT, "src/domain"),
		application: join(ROOT, "src/application"),
	},
});

const { indexTrackFile } = importTs("../src/application/workflows/index-track-file.ts");
const { createDefaultParserRouter } = importTs(
	"../src/infrastructure/parsers/parser-router.ts",
);
const { initialDiscoveredFileStatus } = importTs("../src/domain/track/file-status.ts");

const TRACK_PATH = "tracks/sample-track.gpx";
const BROKEN_PATH = "tracks/malformed-track.gpx";

const clock = {
	nowMs: () => Date.parse("2024-06-01T12:00:00.000Z"),
	nowUtcIso: () => "2024-06-01T12:00:00.000Z",
};

function fixtureBytes(name) {
	return new Uint8Array(readFileSync(join(FIXTURES, name)));
}

function createMemoryTrackRepo() {
	const rows = new Map();
	return {
		upsert: async (record) => {
			rows.set(record.path, { ...record });
		},
		insertDiscovered: async (record) => {
			rows.set(record.path, {
				path: record.path,
				mtimeMs: record.mtimeMs,
				sha256: record.sha256 ?? null,
				status: record.status ?? initialDiscoveredFileStatus(),
				errorMessage: null,
				errorDetails: null,
				titleFromFile: record.titleFromFile ?? null,
				startedAtUtc: null,
				endedAtUtc: null,
				startedAtRaw: null,
				endedAtRaw: null,
				timezoneSource: "unknown",
				timezoneOffsetMin: null,
				durationSec: null,
				distanceM: null,
				elevationGainM: null,
				elevationLossM: null,
				avgSpeedMps: null,
				maxSpeedMps: null,
				sportRaw: null,
				sportNormalized: null,
				bbox: null,
				polylineSimplified: null,
				segments: null,
				dataFlags: {},
				hrAvg: null,
				hrMax: null,
				powerAvg: null,
				cadenceAvg: null,
			});
		},
		findByPath: async (path) => rows.get(path) ?? null,
		deleteByPath: async (path) => {
			rows.delete(path);
		},
		updateStatus: async (path, status, error) => {
			const row = rows.get(path);
			if (!row) {
				return;
			}
			rows.set(path, {
				...row,
				status,
				errorMessage: error?.message ?? null,
				errorDetails: error?.details ?? null,
			});
		},
		renamePath: async () => {},
		list: async () => [...rows.values()],
		listPathsByStatus: async (status) =>
			[...rows.values()].filter((r) => r.status === status).map((r) => r.path),
	};
}

function createFixtureVault(filesByPath) {
	return {
		read: async (path) => filesByPath[path] ?? null,
	};
}

async function runIndex(path, filesByPath, tracks) {
	await tracks.insertDiscovered({ path, mtimeMs: 100 });
	await indexTrackFile(
		{
			tracks,
			trackParser: createDefaultParserRouter(),
			vaultTrackFile: createFixtureVault(filesByPath),
			clock,
		},
		path,
	);
	return tracks.findByPath(path);
}

test("index track file E2E: valid GPX → indexed row with metrics", async () => {
	const tracks = createMemoryTrackRepo();
	const row = await runIndex(TRACK_PATH, {
		[TRACK_PATH]: {
			content: fixtureBytes("sample-track.gpx"),
			extension: "gpx",
			mtimeMs: 200,
		},
	}, tracks);

	assert.ok(row);
	assert.equal(row.status, "indexed");
	assert.equal(row.errorMessage, null);
	assert.equal(row.titleFromFile, "Morning ride");
	assert.equal(row.sportRaw, "cycling");
	assert.equal(row.startedAtUtc, "2024-06-01T08:00:00.000Z");
	assert.equal(row.endedAtUtc, "2024-06-01T08:10:00.000Z");
	assert.equal(row.durationSec, 600);
	assert.ok(row.distanceM > 0);
	assert.ok(row.polylineSimplified?.length > 0);
	assert.ok(row.bbox);
	assert.equal(row.segments?.length, 2);
	assert.equal(row.dataFlags.hasGeometry, true);
});

test("index track file: malformed GPX → error status with message", async () => {
	const tracks = createMemoryTrackRepo();
	const row = await runIndex(BROKEN_PATH, {
		[BROKEN_PATH]: {
			content: fixtureBytes("malformed-track.gpx"),
			extension: "gpx",
			mtimeMs: 300,
		},
	}, tracks);

	assert.ok(row);
	assert.equal(row.status, "error");
	assert.ok(row.errorMessage);
	assert.match(row.errorMessage, /track points/i);
	assert.ok(row.errorDetails);
	assert.match(row.errorDetails, /code=parse_failed/);
});

test("index track file: missing vault file → error status", async () => {
	const tracks = createMemoryTrackRepo();
	const row = await runIndex("tracks/missing.gpx", {}, tracks);

	assert.ok(row);
	assert.equal(row.status, "error");
	assert.match(row.errorMessage, /not found/i);
	assert.match(row.errorDetails, /code=not_found/);
});
