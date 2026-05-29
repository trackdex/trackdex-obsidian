import type { IndexMetaRepository } from "application/ports/repositories";
import type { IndexMeta } from "domain/shared/index-meta";
import { INDEX_META_TABLE } from "../migrations";
import type { SqlStorageAdapter } from "../storage-adapter";

function rowToIndexMeta(row: {
	schema_version: number;
	first_scan_approved: number;
	scan_paused: number;
	last_full_scan_at_utc: string | null;
	last_run_interrupted: number;
}): IndexMeta {
	return {
		schemaVersion: row.schema_version,
		firstScanApproved: row.first_scan_approved !== 0,
		scanPaused: row.scan_paused !== 0,
		lastFullScanAtUtc: row.last_full_scan_at_utc,
		lastRunInterrupted: row.last_run_interrupted !== 0,
	};
}

function readIndexMetaRow(db: ReturnType<SqlStorageAdapter["getDatabase"]>): IndexMeta {
	const result = db.exec(
		`SELECT schema_version, first_scan_approved, scan_paused, last_full_scan_at_utc, last_run_interrupted
		 FROM ${INDEX_META_TABLE} WHERE id = 1`,
	);
	const values = result[0]?.values[0];
	if (!values) {
		throw new Error("Trackdex storage: index_meta row missing after migration");
	}
	return rowToIndexMeta({
		schema_version: Number(values[0]),
		first_scan_approved: Number(values[1]),
		scan_paused: Number(values[2]),
		last_full_scan_at_utc:
			values[3] == null ? null : String(values[3]),
		last_run_interrupted: Number(values[4]),
	});
}

/** SQLite-backed index_meta repository (skeleton schema from migration v0). */
export function createSqlIndexMetaRepository(
	adapter: SqlStorageAdapter,
): IndexMetaRepository {
	return {
		get: async () => readIndexMetaRow(adapter.getDatabase()),

		update: async (partial) => {
			const db = adapter.getDatabase();
			const current = readIndexMetaRow(db);
			const next = { ...current, ...partial };
			db.run(
				`UPDATE ${INDEX_META_TABLE} SET
					schema_version = ?,
					first_scan_approved = ?,
					scan_paused = ?,
					last_full_scan_at_utc = ?,
					last_run_interrupted = ?
				 WHERE id = 1`,
				[
					next.schemaVersion,
					next.firstScanApproved ? 1 : 0,
					next.scanPaused ? 1 : 0,
					next.lastFullScanAtUtc,
					next.lastRunInterrupted ? 1 : 0,
				],
			);
			await adapter.persist();
		},
	};
}
