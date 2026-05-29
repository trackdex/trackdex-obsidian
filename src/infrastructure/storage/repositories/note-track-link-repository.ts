import type { NoteLinkRepository } from "application/ports/repositories";
import type { NotePath, NoteTrackLink } from "domain/links/note-track-link";
import type { TrackPath } from "domain/track/track-record";
import type { SqlValue } from "sql.js";
import type { SqlJsDatabase } from "../candidates/sql-js-init";
import { NOTE_TRACK_LINKS_TABLE } from "../migrations/v1-schema";
import type { SqlStorageAdapter } from "../storage-adapter";

interface NoteTrackLinksTableRow {
	note_path: string;
	track_path: string;
	link_text: string;
}

function rowToNoteTrackLink(row: NoteTrackLinksTableRow): NoteTrackLink {
	return {
		notePath: row.note_path,
		trackPath: row.track_path,
		linkText: row.link_text,
	};
}

function readNoteTrackLinks(
	db: SqlJsDatabase,
	sql: string,
	params: SqlValue[],
): NoteTrackLink[] {
	const stmt = db.prepare(sql);
	const links: NoteTrackLink[] = [];
	try {
		stmt.bind(params);
		while (stmt.step()) {
			links.push(rowToNoteTrackLink(stmt.getAsObject() as unknown as NoteTrackLinksTableRow));
		}
		return links;
	} finally {
		stmt.free();
	}
}

/** Removes all `note_track_links` rows for a track (track delete cascade). */
export function deleteNoteTrackLinksForTrackInDb(db: SqlJsDatabase, trackPath: TrackPath): void {
	db.run(`DELETE FROM ${NOTE_TRACK_LINKS_TABLE} WHERE track_path = ?`, [trackPath]);
}

const UPSERT_NOTE_TRACK_LINK_SQL = `
INSERT INTO ${NOTE_TRACK_LINKS_TABLE} (note_path, track_path, link_text)
VALUES (?, ?, ?)
ON CONFLICT(note_path, track_path, link_text) DO NOTHING
`;

/** SQLite-backed `NoteLinkRepository` (`note_track_links`, §6.1). */
export function createSqlNoteLinkRepository(adapter: SqlStorageAdapter): NoteLinkRepository {
	return {
		upsert: async (link) => {
			const db = adapter.getDatabase();
			db.run(UPSERT_NOTE_TRACK_LINK_SQL, [link.notePath, link.trackPath, link.linkText]);
			await adapter.persist();
		},

		deleteLink: async (notePath, trackPath, linkText) => {
			const db = adapter.getDatabase();
			db.run(
				`DELETE FROM ${NOTE_TRACK_LINKS_TABLE} WHERE note_path = ? AND track_path = ? AND link_text = ?`,
				[notePath, trackPath, linkText],
			);
			await adapter.persist();
		},

		deleteByNotePath: async (notePath: NotePath) => {
			const db = adapter.getDatabase();
			db.run(`DELETE FROM ${NOTE_TRACK_LINKS_TABLE} WHERE note_path = ?`, [notePath]);
			await adapter.persist();
		},

		deleteByTrackPath: async (trackPath: TrackPath) => {
			const db = adapter.getDatabase();
			deleteNoteTrackLinksForTrackInDb(db, trackPath);
			await adapter.persist();
		},

		listByNotePath: async (notePath) => {
			const db = adapter.getDatabase();
			return readNoteTrackLinks(
				db,
				`SELECT note_path, track_path, link_text FROM ${NOTE_TRACK_LINKS_TABLE} WHERE note_path = ? ORDER BY track_path, link_text`,
				[notePath],
			);
		},

		listByTrackPath: async (trackPath) => {
			const db = adapter.getDatabase();
			return readNoteTrackLinks(
				db,
				`SELECT note_path, track_path, link_text FROM ${NOTE_TRACK_LINKS_TABLE} WHERE track_path = ? ORDER BY note_path, link_text`,
				[trackPath],
			);
		},
	};
}
