/**
 * Clears plugin index table rows only (no vault file I/O).
 * Lifecycle field reset is orchestrated by {@link resetIndex}.
 */
export interface IndexResetPort {
	/** Removes all rows from `tracks`, `places`, `track_places`, and `note_track_links`. */
	clearIndexTables(): Promise<void>;
}
