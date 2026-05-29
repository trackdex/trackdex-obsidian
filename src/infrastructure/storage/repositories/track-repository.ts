import type { TrackRepository } from "application/ports/repositories";
import type { TrackListQuery } from "domain/track/track-query";
import type {
	NewTrackRecord,
	TrackPath,
	TrackRecord,
} from "domain/track/track-record";
import type { TrackStatus } from "domain/track/track-status";
import type { SqlValue } from "sql.js";
import type { SqlJsDatabase } from "../candidates/sql-js-init";
import {
	NOTE_TRACK_LINKS_TABLE,
	TRACK_PLACES_TABLE,
	TRACKS_TABLE,
} from "../migrations/v1-schema";
import type { SqlStorageAdapter } from "../storage-adapter";
import {
	assertTrackStatus,
	rowToTrackRecord,
	TRACK_ROW_INSERT_COLUMNS,
	TRACK_ROW_SELECT_SQL,
	trackRecordToRowParams,
	type TracksTableRow,
} from "./track-record-row";

const INSERT_TRACK_SQL = `
INSERT INTO ${TRACKS_TABLE} (${TRACK_ROW_INSERT_COLUMNS.join(", ")})
VALUES (${TRACK_ROW_INSERT_COLUMNS.map(() => "?").join(", ")})
`;

const UPSERT_TRACK_SQL = `
INSERT INTO ${TRACKS_TABLE} (${TRACK_ROW_INSERT_COLUMNS.join(", ")})
VALUES (${TRACK_ROW_INSERT_COLUMNS.map(() => "?").join(", ")})
ON CONFLICT(path) DO UPDATE SET
	mtime_ms = excluded.mtime_ms,
	sha256 = excluded.sha256,
	status = excluded.status,
	error_message = excluded.error_message,
	error_details = excluded.error_details,
	title_from_file = excluded.title_from_file,
	started_at_utc = excluded.started_at_utc,
	ended_at_utc = excluded.ended_at_utc,
	started_at_raw = excluded.started_at_raw,
	ended_at_raw = excluded.ended_at_raw,
	timezone_source = excluded.timezone_source,
	timezone_offset_min = excluded.timezone_offset_min,
	duration_sec = excluded.duration_sec,
	distance_m = excluded.distance_m,
	elevation_gain_m = excluded.elevation_gain_m,
	elevation_loss_m = excluded.elevation_loss_m,
	avg_speed_mps = excluded.avg_speed_mps,
	max_speed_mps = excluded.max_speed_mps,
	sport_raw = excluded.sport_raw,
	sport_normalized = excluded.sport_normalized,
	bbox_json = excluded.bbox_json,
	polyline_simplified_json = excluded.polyline_simplified_json,
	segments_json = excluded.segments_json,
	data_flags_json = excluded.data_flags_json,
	hr_avg = excluded.hr_avg,
	hr_max = excluded.hr_max,
	power_avg = excluded.power_avg,
	cadence_avg = excluded.cadence_avg
`;

function readTrackRow(
	db: SqlJsDatabase,
	sql: string,
	params: SqlValue[],
): TrackRecord | null {
	const stmt = db.prepare(sql);
	try {
		stmt.bind(params);
		if (!stmt.step()) {
			return null;
		}
		return rowToTrackRecord(stmt.getAsObject() as unknown as TracksTableRow);
	} finally {
		stmt.free();
	}
}

function readTrackRows(db: SqlJsDatabase, sql: string, params: SqlValue[]): TrackRecord[] {
	const stmt = db.prepare(sql);
	const rows: TrackRecord[] = [];
	try {
		stmt.bind(params);
		while (stmt.step()) {
			rows.push(rowToTrackRecord(stmt.getAsObject() as unknown as TracksTableRow));
		}
		return rows;
	} finally {
		stmt.free();
	}
}

function discoveredToTrackRecord(record: NewTrackRecord): TrackRecord {
	const status = record.status ?? "pending";
	assertTrackStatus(status);

	return {
		path: record.path,
		mtimeMs: record.mtimeMs,
		sha256: record.sha256 ?? null,
		status,
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
	};
}

function buildListQuery(query?: TrackListQuery): {
	sql: string;
	params: SqlValue[];
} {
	const conditions: string[] = [];
	const params: SqlValue[] = [];
	const useJoin = query?.placeNotePath != null;
	const col = (name: string) => (useJoin ? `t.${name}` : name);

	const selectCols = useJoin
		? TRACK_ROW_INSERT_COLUMNS.map((c) => `t.${c}`).join(", ")
		: TRACK_ROW_INSERT_COLUMNS.join(", ");

	let from = `FROM ${TRACKS_TABLE}`;
	if (useJoin) {
		from = `FROM ${TRACKS_TABLE} t INNER JOIN ${TRACK_PLACES_TABLE} tp ON tp.track_path = t.path`;
		conditions.push("tp.place_note_path = ?");
		params.push(query.placeNotePath);
	}

	if (query?.statuses?.length) {
		for (const status of query.statuses) {
			assertTrackStatus(status);
		}
		const placeholders = query.statuses.map(() => "?").join(", ");
		conditions.push(`${col("status")} IN (${placeholders})`);
		params.push(...query.statuses);
	}

	if (query?.sportNormalized != null) {
		conditions.push(`${col("sport_normalized")} = ?`);
		params.push(query.sportNormalized);
	}

	if (query?.startedAfterUtc != null) {
		conditions.push(`${col("started_at_utc")} >= ?`);
		params.push(query.startedAfterUtc);
	}

	if (query?.startedBeforeUtc != null) {
		conditions.push(`${col("started_at_utc")} <= ?`);
		params.push(query.startedBeforeUtc);
	}

	if (query?.errorsOnly) {
		conditions.push(`${col("status")} = 'error'`);
	}

	const where = conditions.length ? ` WHERE ${conditions.join(" AND ")}` : "";

	let orderBy = "";
	if (query?.sortBy != null) {
		const column =
			query.sortBy === "started_at"
				? "started_at_utc"
				: query.sortBy === "distance"
					? "distance_m"
					: "duration_sec";
		const direction = query.sortOrder === "asc" ? "ASC" : "DESC";
		orderBy = ` ORDER BY ${col(column)} ${direction}`;
	}

	let limitOffset = "";
	if (query?.limit != null) {
		limitOffset += " LIMIT ?";
		params.push(query.limit);
	}
	if (query?.offset != null) {
		limitOffset += " OFFSET ?";
		params.push(query.offset);
	}

	const sql = `SELECT ${selectCols} ${from}${where}${orderBy}${limitOffset}`;
	return { sql, params };
}

function readPathColumn(
	db: SqlJsDatabase,
	sql: string,
	params: SqlValue[],
): TrackPath[] {
	const stmt = db.prepare(sql);
	const paths: TrackPath[] = [];
	try {
		stmt.bind(params);
		while (stmt.step()) {
			paths.push(String(stmt.get()[0]));
		}
		return paths;
	} finally {
		stmt.free();
	}
}

function readCount(db: SqlJsDatabase, sql: string, params: SqlValue[]): number {
	const stmt = db.prepare(sql);
	try {
		stmt.bind(params);
		stmt.step();
		return Number(stmt.get()[0]);
	} finally {
		stmt.free();
	}
}

/**
 * Vault rename policy: one transaction updates `tracks.path` and rewrites
 * `track_path` in `track_places` / `note_track_links` so FK-shaped rows stay
 * aligned. Does not touch place or link rows beyond path columns.
 */
function renameTrackPath(
	db: SqlJsDatabase,
	oldPath: TrackPath,
	newPath: TrackPath,
	mtimeMs: number,
): void {
	db.run("BEGIN");
	try {
		db.run(
			`UPDATE ${TRACKS_TABLE} SET path = ?, mtime_ms = ? WHERE path = ?`,
			[newPath, mtimeMs, oldPath],
		);
		db.run(
			`UPDATE ${TRACK_PLACES_TABLE} SET track_path = ? WHERE track_path = ?`,
			[newPath, oldPath],
		);
		db.run(
			`UPDATE ${NOTE_TRACK_LINKS_TABLE} SET track_path = ? WHERE track_path = ?`,
			[newPath, oldPath],
		);
		db.run("COMMIT");
	} catch (err) {
		db.run("ROLLBACK");
		throw err;
	}
}

/** SQLite-backed `TrackRepository` (`tracks` table, §6.1). */
export function createSqlTrackRepository(adapter: SqlStorageAdapter): TrackRepository {
	return {
		upsert: async (record) => {
			const db = adapter.getDatabase();
			db.run(UPSERT_TRACK_SQL, trackRecordToRowParams(record));
			await adapter.persist();
		},

		insertDiscovered: async (record) => {
			const db = adapter.getDatabase();
			const full = discoveredToTrackRecord(record);
			db.run(INSERT_TRACK_SQL, trackRecordToRowParams(full));
			await adapter.persist();
		},

		findByPath: async (path) => {
			const db = adapter.getDatabase();
			return readTrackRow(
				db,
				`${TRACK_ROW_SELECT_SQL} FROM ${TRACKS_TABLE} WHERE path = ?`,
				[path],
			);
		},

		deleteByPath: async (path) => {
			const db = adapter.getDatabase();
			db.run(`DELETE FROM ${TRACKS_TABLE} WHERE path = ?`, [path]);
			await adapter.persist();
		},

		updateStatus: async (path, status, error) => {
			assertTrackStatus(status);
			const db = adapter.getDatabase();
			if (status === "error") {
				db.run(
					`UPDATE ${TRACKS_TABLE} SET status = ?, error_message = ?, error_details = ? WHERE path = ?`,
					[status, error?.message ?? null, error?.details ?? null, path],
				);
			} else {
				db.run(
					`UPDATE ${TRACKS_TABLE} SET status = ?, error_message = NULL, error_details = NULL WHERE path = ?`,
					[status, path],
				);
			}
			await adapter.persist();
		},

		renamePath: async (oldPath, newPath, mtimeMs) => {
			const db = adapter.getDatabase();
			renameTrackPath(db, oldPath, newPath, mtimeMs);
			await adapter.persist();
		},

		list: async (query) => {
			const db = adapter.getDatabase();
			const { sql, params } = buildListQuery(query);
			return readTrackRows(db, sql, params);
		},

		listPathsByStatus: async (status) => {
			assertTrackStatus(status);
			const db = adapter.getDatabase();
			return readPathColumn(
				db,
				`SELECT path FROM ${TRACKS_TABLE} WHERE status = ? ORDER BY path`,
				[status],
			);
		},

		countByStatus: async (status) => {
			assertTrackStatus(status);
			const db = adapter.getDatabase();
			return readCount(
				db,
				`SELECT COUNT(*) FROM ${TRACKS_TABLE} WHERE status = ?`,
				[status],
			);
		},
	};
}
