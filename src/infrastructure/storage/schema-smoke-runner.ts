import type { TrackRepository } from "application/ports/repositories";
import type { TrackRecord } from "domain/track/track-record";

/** Dev smoke row path; safe to delete/replace during manual or automated checks. */
export const SCHEMA_SMOKE_TRACK_PATH = "_trackdex/schema-smoke.gpx";

export interface StorageSchemaSmokeResult {
	ok: boolean;
	marker: string | null;
	message: string;
}

function minimalIndexedRecord(path: string, marker: string, mtimeMs: number): TrackRecord {
	return {
		path,
		mtimeMs,
		sha256: null,
		status: "indexed",
		errorMessage: null,
		errorDetails: null,
		titleFromFile: marker,
		startedAtUtc: null,
		endedAtUtc: null,
		startedAtRaw: null,
		endedAtRaw: null,
		timezoneSource: "unknown",
		timezoneOffsetMin: null,
		durationSec: null,
		distanceM: 42,
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
	};
}

/**
 * Create → read → update → read on the smoke track row; leaves a persisted row for reload verify.
 */
export async function runStorageSchemaSmokeWrite(
	tracks: TrackRepository,
): Promise<StorageSchemaSmokeResult> {
	const marker = `smoke-${String(Date.now())}`;
	const mtimeMs = Date.now();

	await tracks.deleteByPath(SCHEMA_SMOKE_TRACK_PATH);
	await tracks.insertDiscovered({
		path: SCHEMA_SMOKE_TRACK_PATH,
		mtimeMs,
		titleFromFile: marker,
	});

	const created = await tracks.findByPath(SCHEMA_SMOKE_TRACK_PATH);
	if (!created || created.titleFromFile !== marker || created.status !== "pending") {
		return {
			ok: false,
			marker: null,
			message: "Create/read failed after insertDiscovered",
		};
	}

	await tracks.updateStatus(SCHEMA_SMOKE_TRACK_PATH, "indexing");
	await tracks.upsert(minimalIndexedRecord(SCHEMA_SMOKE_TRACK_PATH, marker, mtimeMs));

	const updated = await tracks.findByPath(SCHEMA_SMOKE_TRACK_PATH);
	const ok =
		updated != null &&
		updated.status === "indexed" &&
		updated.titleFromFile === marker &&
		updated.distanceM === 42;

	return {
		ok,
		marker: ok ? marker : null,
		message: ok
			? `CRUD OK; marker=${marker}. Reload plugin, then run "Verify storage schema smoke".`
			: `CRUD FAILED: expected indexed row with marker=${marker}`,
	};
}

/** Read persisted smoke row (after plugin reload). */
export async function runStorageSchemaSmokeVerify(
	tracks: TrackRepository,
	expectedMarker?: string | null,
): Promise<StorageSchemaSmokeResult> {
	const row = await tracks.findByPath(SCHEMA_SMOKE_TRACK_PATH);
	if (!row || row.status !== "indexed") {
		return {
			ok: false,
			marker: row?.titleFromFile ?? null,
			message:
				"Verify FAILED: no indexed smoke row (run write pass first, then reload plugin)",
		};
	}
	const marker = row.titleFromFile;
	const ok =
		marker != null &&
		marker.startsWith("smoke-") &&
		(expectedMarker == null || marker === expectedMarker);

	return {
		ok,
		marker,
		message: ok
			? `Verify OK: marker=${marker}`
			: `Verify FAILED: expected ${expectedMarker ?? "smoke-*"}, got ${marker ?? "null"}`,
	};
}
