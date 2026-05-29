import type { IndexResetPort } from "application/ports/index-reset-port";
import {
	NOTE_TRACK_LINKS_TABLE,
	PLACES_TABLE,
	TRACK_PLACES_TABLE,
	TRACKS_TABLE,
} from "./migrations/v1-schema";
import type { SqlStorageAdapter } from "./storage-adapter";

const CLEAR_INDEX_TABLES_SQL = [
	`DELETE FROM ${NOTE_TRACK_LINKS_TABLE}`,
	`DELETE FROM ${TRACK_PLACES_TABLE}`,
	`DELETE FROM ${TRACKS_TABLE}`,
	`DELETE FROM ${PLACES_TABLE}`,
] as const;

/** SQLite-backed {@link IndexResetPort} (index.sqlite content tables only). */
export function createSqlIndexResetPort(adapter: SqlStorageAdapter): IndexResetPort {
	return {
		clearIndexTables: async () => {
			const db = adapter.getDatabase();
			db.run("BEGIN");
			try {
				for (const sql of CLEAR_INDEX_TABLES_SQL) {
					db.run(sql);
				}
				db.run("COMMIT");
			} catch (err: unknown) {
				try {
					db.run("ROLLBACK");
				} catch {
					// ignore rollback failure
				}
				throw err;
			}
			await adapter.persist();
		},
	};
}
