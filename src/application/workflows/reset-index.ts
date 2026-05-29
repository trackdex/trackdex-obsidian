import type { IndexResetPort } from "application/ports/index-reset-port";
import type { IndexMetaRepository } from "application/ports/repositories";

/**
 * Reset index workflow (0.2-08): clear service index data without touching vault files.
 *
 * **Deleted (index.sqlite only)**
 * - All rows in `tracks`, `places`, `track_places`, `note_track_links`.
 * - `index_meta` lifecycle fields reset to §7.1 defaults:
 *   `first_scan_approved`, `scan_paused`, `last_full_scan_at_utc`, `last_run_interrupted`.
 *
 * **Preserved**
 * - Vault track and note files (no file read/write/delete; not in workflow deps).
 * - `index_meta.schema_version` and `schema_version` table (migrations / DDL unchanged).
 * - SQLite schema: tables, indexes, and single `index_meta` row.
 */
export interface ResetIndexDeps {
	readonly indexReset: IndexResetPort;
	readonly indexMeta: IndexMetaRepository;
}

/** Clears index tables and resets lifecycle meta; keeps `schema_version` intact. */
export async function resetIndex(deps: ResetIndexDeps): Promise<void> {
	const { schemaVersion } = await deps.indexMeta.get();
	await deps.indexReset.clearIndexTables();
	await deps.indexMeta.update({
		schemaVersion,
		firstScanApproved: false,
		scanPaused: false,
		lastFullScanAtUtc: null,
		lastRunInterrupted: false,
	});
}
