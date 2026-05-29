/**
 * Logical schema v1 DDL (`docs/TECHNICAL_DESIGN.md` §6.1).
 *
 * Migration runner wiring is milestone 0.2-02; this module exports idempotent
 * DDL helpers/constants only.
 *
 * Foreign keys are documented for referential intent. sql.js/SQLite may not
 * enforce FK constraints unless PRAGMA foreign_keys=ON; repositories must
 * uphold delete/update semantics.
 */
import { TIMEZONE_SOURCES } from "domain/track/timezone-source";
import { TRACK_STATUSES } from "domain/track/track-status";
import type { SqlJsDatabase } from "../candidates/sql-js-init";

/** Target schema version after v1 DDL is applied (0.2-02 bumps `schema_version`). */
export const V1_SCHEMA_VERSION = 1;

export const TRACKS_TABLE = "tracks";
export const PLACES_TABLE = "places";
export const TRACK_PLACES_TABLE = "track_places";
export const NOTE_TRACK_LINKS_TABLE = "note_track_links";

/**
 * `index_meta` single-row table is created in v0 bootstrap (`migrations.ts`,
 * `INDEX_META_TABLE`). Required keys per §6.1 map to columns:
 * `schema_version`, `first_scan_approved`, `scan_paused`, `last_full_scan_at_utc`,
 * `last_run_interrupted`. v1 does not alter that table.
 */
export const INDEX_META_V1_COLUMN_KEYS = [
	"schema_version",
	"first_scan_approved",
	"scan_paused",
	"last_full_scan_at_utc",
	"last_run_interrupted",
] as const;

function sqlStringLiteralList(values: readonly string[]): string {
	return values.map((v) => `'${v.replace(/'/g, "''")}'`).join(", ");
}

/** CHECK fragment for `tracks.status` (domain `TRACK_STATUSES`). */
export const TRACKS_STATUS_CHECK_SQL = `status IN (${sqlStringLiteralList(TRACK_STATUSES)})`;

/** CHECK fragment for `tracks.timezone_source` (domain `TIMEZONE_SOURCES`). */
export const TRACKS_TIMEZONE_SOURCE_CHECK_SQL = `timezone_source IN (${sqlStringLiteralList(TIMEZONE_SOURCES)})`;

export const CREATE_TRACKS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS ${TRACKS_TABLE} (
	path TEXT PRIMARY KEY,
	mtime_ms INTEGER NOT NULL,
	sha256 TEXT,
	status TEXT NOT NULL CHECK (${TRACKS_STATUS_CHECK_SQL}),
	error_message TEXT,
	error_details TEXT,
	title_from_file TEXT,
	started_at_utc TEXT,
	ended_at_utc TEXT,
	started_at_raw TEXT,
	ended_at_raw TEXT,
	timezone_source TEXT NOT NULL CHECK (${TRACKS_TIMEZONE_SOURCE_CHECK_SQL}),
	timezone_offset_min INTEGER,
	duration_sec REAL,
	distance_m REAL,
	elevation_gain_m REAL,
	elevation_loss_m REAL,
	avg_speed_mps REAL,
	max_speed_mps REAL,
	sport_raw TEXT,
	sport_normalized TEXT,
	bbox_json TEXT,
	polyline_simplified_json TEXT,
	segments_json TEXT,
	data_flags_json TEXT NOT NULL DEFAULT '{}',
	hr_avg REAL,
	hr_max REAL,
	power_avg REAL,
	cadence_avg REAL
);
`;

const IDX_TRACKS_STATUS = "idx_tracks_status";
const IDX_TRACKS_STARTED_AT_UTC = "idx_tracks_started_at_utc";
const IDX_TRACKS_SPORT_NORMALIZED = "idx_tracks_sport_normalized";

export const CREATE_TRACKS_INDEXES_SQL = [
	`CREATE INDEX IF NOT EXISTS ${IDX_TRACKS_STATUS} ON ${TRACKS_TABLE} (status);`,
	`CREATE INDEX IF NOT EXISTS ${IDX_TRACKS_STARTED_AT_UTC} ON ${TRACKS_TABLE} (started_at_utc);`,
	`CREATE INDEX IF NOT EXISTS ${IDX_TRACKS_SPORT_NORMALIZED} ON ${TRACKS_TABLE} (sport_normalized);`,
] as const;

export const CREATE_PLACES_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS ${PLACES_TABLE} (
	note_path TEXT PRIMARY KEY,
	geometry_kind TEXT NOT NULL,
	geometry_json TEXT NOT NULL,
	bbox_json TEXT,
	is_valid INTEGER NOT NULL,
	error_message TEXT
);
`;

const IDX_PLACES_IS_VALID = "idx_places_is_valid";

export const CREATE_PLACES_INDEXES_SQL = [
	`CREATE INDEX IF NOT EXISTS ${IDX_PLACES_IS_VALID} ON ${PLACES_TABLE} (is_valid);`,
] as const;

/**
 * `track_path` → `tracks.path`; `place_note_path` → `places.note_path`.
 * Orphan rows are invalid per logical model; cleanup is repository responsibility.
 */
export const CREATE_TRACK_PLACES_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS ${TRACK_PLACES_TABLE} (
	track_path TEXT NOT NULL,
	place_note_path TEXT NOT NULL,
	last_visit_at_utc TEXT,
	PRIMARY KEY (track_path, place_note_path)
);
`;

const IDX_TRACK_PLACES_PLACE_VISIT = "idx_track_places_place_visit";

export const CREATE_TRACK_PLACES_INDEXES_SQL = [
	`CREATE INDEX IF NOT EXISTS ${IDX_TRACK_PLACES_PLACE_VISIT} ON ${TRACK_PLACES_TABLE} (place_note_path, last_visit_at_utc);`,
] as const;

/** `track_path` → `tracks.path`. `note_path` is any vault markdown note path. */
export const CREATE_NOTE_TRACK_LINKS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS ${NOTE_TRACK_LINKS_TABLE} (
	note_path TEXT NOT NULL,
	track_path TEXT NOT NULL,
	link_text TEXT NOT NULL,
	PRIMARY KEY (note_path, track_path, link_text)
);
`;

const IDX_NOTE_TRACK_LINKS_TRACK = "idx_note_track_links_track";
const IDX_NOTE_TRACK_LINKS_NOTE = "idx_note_track_links_note";

export const CREATE_NOTE_TRACK_LINKS_INDEXES_SQL = [
	`CREATE INDEX IF NOT EXISTS ${IDX_NOTE_TRACK_LINKS_TRACK} ON ${NOTE_TRACK_LINKS_TABLE} (track_path);`,
	`CREATE INDEX IF NOT EXISTS ${IDX_NOTE_TRACK_LINKS_NOTE} ON ${NOTE_TRACK_LINKS_TABLE} (note_path);`,
] as const;

/** §6.1 query indexes: name, table, column order for migration tests. */
export const V1_QUERY_INDEX_SPECS = [
	{ name: IDX_TRACKS_STATUS, table: TRACKS_TABLE, columns: ["status"] },
	{ name: IDX_TRACKS_STARTED_AT_UTC, table: TRACKS_TABLE, columns: ["started_at_utc"] },
	{ name: IDX_TRACKS_SPORT_NORMALIZED, table: TRACKS_TABLE, columns: ["sport_normalized"] },
	{ name: IDX_PLACES_IS_VALID, table: PLACES_TABLE, columns: ["is_valid"] },
	{
		name: IDX_TRACK_PLACES_PLACE_VISIT,
		table: TRACK_PLACES_TABLE,
		columns: ["place_note_path", "last_visit_at_utc"],
	},
	{ name: IDX_NOTE_TRACK_LINKS_TRACK, table: NOTE_TRACK_LINKS_TABLE, columns: ["track_path"] },
	{ name: IDX_NOTE_TRACK_LINKS_NOTE, table: NOTE_TRACK_LINKS_TABLE, columns: ["note_path"] },
] as const;

export const V1_INDEX_NAMES = V1_QUERY_INDEX_SPECS.map((spec) => spec.name);

/** All v1 table/index DDL statements in apply order. */
export const V1_DDL_STATEMENTS: readonly string[] = [
	CREATE_TRACKS_TABLE_SQL,
	...CREATE_TRACKS_INDEXES_SQL,
	CREATE_PLACES_TABLE_SQL,
	...CREATE_PLACES_INDEXES_SQL,
	CREATE_TRACK_PLACES_TABLE_SQL,
	...CREATE_TRACK_PLACES_INDEXES_SQL,
	CREATE_NOTE_TRACK_LINKS_TABLE_SQL,
	...CREATE_NOTE_TRACK_LINKS_INDEXES_SQL,
];

/**
 * Idempotent v1 schema bootstrap: tables and indexes from §6.1.
 * Does not bump `schema_version` (0.2-02).
 */
export function applyV1SchemaDdl(db: SqlJsDatabase): void {
	for (const sql of V1_DDL_STATEMENTS) {
		db.run(sql);
	}
}
