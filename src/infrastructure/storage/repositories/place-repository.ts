import type { PlaceRepository } from "application/ports/repositories";
import type { PlaceNotePath, PlaceRecord } from "domain/place/place-record";
import type { SqlValue } from "sql.js";
import type { SqlJsDatabase } from "../candidates/sql-js-init";
import { PLACES_TABLE } from "../migrations/v1-schema";
import type { SqlStorageAdapter } from "../storage-adapter";
import {
	PLACE_ROW_COLUMNS,
	PLACE_ROW_SELECT_SQL,
	placeRecordToRowParams,
	rowToPlaceRecord,
	type PlacesTableRow,
} from "./place-record-row";
import {
	createSqlTrackPlaceRepository,
	deleteTrackPlacesForPlaceInDb,
} from "./track-place-repository";

const UPSERT_PLACE_SQL = `
INSERT INTO ${PLACES_TABLE} (${PLACE_ROW_COLUMNS.join(", ")})
VALUES (${PLACE_ROW_COLUMNS.map(() => "?").join(", ")})
ON CONFLICT(note_path) DO UPDATE SET
	geometry_kind = excluded.geometry_kind,
	geometry_json = excluded.geometry_json,
	bbox_json = excluded.bbox_json,
	is_valid = excluded.is_valid,
	error_message = excluded.error_message
`;

function readPlaceRow(
	db: SqlJsDatabase,
	sql: string,
	params: SqlValue[],
): PlaceRecord | null {
	const stmt = db.prepare(sql);
	try {
		stmt.bind(params);
		if (!stmt.step()) {
			return null;
		}
		return rowToPlaceRecord(stmt.getAsObject() as unknown as PlacesTableRow);
	} finally {
		stmt.free();
	}
}

function readPlaceRows(db: SqlJsDatabase, sql: string, params: SqlValue[]): PlaceRecord[] {
	const stmt = db.prepare(sql);
	const rows: PlaceRecord[] = [];
	try {
		stmt.bind(params);
		while (stmt.step()) {
			rows.push(rowToPlaceRecord(stmt.getAsObject() as unknown as PlacesTableRow));
		}
		return rows;
	} finally {
		stmt.free();
	}
}

/** SQLite-backed `PlaceRepository` (`places` + `track_places`, §6.1). */
export function createSqlPlaceRepository(adapter: SqlStorageAdapter): PlaceRepository {
	const trackPlaces = createSqlTrackPlaceRepository(adapter);

	return {
		upsert: async (place) => {
			const db = adapter.getDatabase();
			db.run(UPSERT_PLACE_SQL, placeRecordToRowParams(place));
			await adapter.persist();
		},

		findByNotePath: async (notePath) => {
			const db = adapter.getDatabase();
			return readPlaceRow(
				db,
				`${PLACE_ROW_SELECT_SQL} FROM ${PLACES_TABLE} WHERE note_path = ?`,
				[notePath],
			);
		},

		deleteByNotePath: async (notePath: PlaceNotePath) => {
			const db = adapter.getDatabase();
			deleteTrackPlacesForPlaceInDb(db, notePath);
			db.run(`DELETE FROM ${PLACES_TABLE} WHERE note_path = ?`, [notePath]);
			await adapter.persist();
		},

		listValid: async () => {
			const db = adapter.getDatabase();
			return readPlaceRows(
				db,
				`${PLACE_ROW_SELECT_SQL} FROM ${PLACES_TABLE} WHERE is_valid = 1 ORDER BY note_path`,
				[],
			);
		},

		...trackPlaces,
	};
}
