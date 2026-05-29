import type { PlaceNotePath } from "domain/place/place-record";
import type { TrackPlaceRelation } from "domain/place/track-place-relation";
import type { TrackPath } from "domain/track/track-record";
import type { SqlValue } from "sql.js";
import type { SqlJsDatabase } from "../candidates/sql-js-init";
import { TRACK_PLACES_TABLE } from "../migrations/v1-schema";
import type { SqlStorageAdapter } from "../storage-adapter";

export interface TrackPlacesTableRow {
	track_path: string;
	place_note_path: string;
	last_visit_at_utc: string | null;
}

function rowToTrackPlaceRelation(row: TrackPlacesTableRow): TrackPlaceRelation {
	return {
		trackPath: row.track_path,
		placeNotePath: row.place_note_path,
		lastVisitAtUtc: row.last_visit_at_utc,
	};
}

function readTrackPlaceRows(
	db: SqlJsDatabase,
	sql: string,
	params: SqlValue[],
): TrackPlaceRelation[] {
	const stmt = db.prepare(sql);
	const rows: TrackPlaceRelation[] = [];
	try {
		stmt.bind(params);
		while (stmt.step()) {
			rows.push(rowToTrackPlaceRelation(stmt.getAsObject() as unknown as TrackPlacesTableRow));
		}
		return rows;
	} finally {
		stmt.free();
	}
}

/** Removes all `track_places` rows for a track (track delete cascade). */
export function deleteTrackPlacesForTrackInDb(db: SqlJsDatabase, trackPath: TrackPath): void {
	db.run(`DELETE FROM ${TRACK_PLACES_TABLE} WHERE track_path = ?`, [trackPath]);
}

/** Removes all `track_places` rows for a place (place delete cascade). */
export function deleteTrackPlacesForPlaceInDb(
	db: SqlJsDatabase,
	placeNotePath: PlaceNotePath,
): void {
	db.run(`DELETE FROM ${TRACK_PLACES_TABLE} WHERE place_note_path = ?`, [placeNotePath]);
}

const UPSERT_TRACK_PLACE_SQL = `
INSERT INTO ${TRACK_PLACES_TABLE} (track_path, place_note_path, last_visit_at_utc)
VALUES (?, ?, ?)
ON CONFLICT(track_path, place_note_path) DO UPDATE SET
	last_visit_at_utc = excluded.last_visit_at_utc
`;

/** SQLite-backed `track_places` persistence (§6.1). */
export function createSqlTrackPlaceRepository(adapter: SqlStorageAdapter) {
	return {
		upsertTrackPlace: async (relation: TrackPlaceRelation) => {
			const db = adapter.getDatabase();
			db.run(UPSERT_TRACK_PLACE_SQL, [
				relation.trackPath,
				relation.placeNotePath,
				relation.lastVisitAtUtc,
			]);
			await adapter.persist();
		},

		deleteTrackPlace: async (trackPath: TrackPath, placeNotePath: PlaceNotePath) => {
			const db = adapter.getDatabase();
			db.run(
				`DELETE FROM ${TRACK_PLACES_TABLE} WHERE track_path = ? AND place_note_path = ?`,
				[trackPath, placeNotePath],
			);
			await adapter.persist();
		},

		deleteTrackPlacesForTrack: async (trackPath: TrackPath) => {
			const db = adapter.getDatabase();
			deleteTrackPlacesForTrackInDb(db, trackPath);
			await adapter.persist();
		},

		deleteTrackPlacesForPlace: async (placeNotePath: PlaceNotePath) => {
			const db = adapter.getDatabase();
			deleteTrackPlacesForPlaceInDb(db, placeNotePath);
			await adapter.persist();
		},

		listTrackPlacesForTrack: async (trackPath: TrackPath) => {
			const db = adapter.getDatabase();
			return readTrackPlaceRows(
				db,
				`SELECT track_path, place_note_path, last_visit_at_utc FROM ${TRACK_PLACES_TABLE} WHERE track_path = ? ORDER BY place_note_path`,
				[trackPath],
			);
		},

		listTrackPlacesForPlace: async (placeNotePath: PlaceNotePath) => {
			const db = adapter.getDatabase();
			return readTrackPlaceRows(
				db,
				`SELECT track_path, place_note_path, last_visit_at_utc FROM ${TRACK_PLACES_TABLE} WHERE place_note_path = ? ORDER BY track_path`,
				[placeNotePath],
			);
		},
	};
}
