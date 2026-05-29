import type { LoggerPort } from "application/ports/logger-port";
import type { SqlJsDatabase } from "./candidates/sql-js-init";

export const SCHEMA_VERSION_TABLE = "schema_version";
export const INDEX_META_TABLE = "index_meta";

/** Latest applied schema version (v0 skeleton; full v1 schema in 0.2). */
export const LATEST_SCHEMA_VERSION = 0;

function readSchemaVersion(db: SqlJsDatabase): number {
	const result = db.exec(`SELECT version FROM ${SCHEMA_VERSION_TABLE} LIMIT 1`);
	const raw = result[0]?.values[0]?.[0];
	if (raw == null) {
		return 0;
	}
	return Number(raw);
}

/** Idempotent v0 bootstrap: version table + single-row index_meta stub. */
function applyMigrationV0(db: SqlJsDatabase): void {
	db.run(`
		CREATE TABLE IF NOT EXISTS ${SCHEMA_VERSION_TABLE} (
			version INTEGER NOT NULL
		);
	`);
	const versionRows = db.exec(`SELECT version FROM ${SCHEMA_VERSION_TABLE} LIMIT 1`);
	if (!versionRows[0]?.values.length) {
		db.run(`INSERT INTO ${SCHEMA_VERSION_TABLE} (version) VALUES (0)`);
	}

	db.run(`
		CREATE TABLE IF NOT EXISTS ${INDEX_META_TABLE} (
			id INTEGER PRIMARY KEY CHECK (id = 1),
			schema_version INTEGER NOT NULL DEFAULT 0,
			first_scan_approved INTEGER NOT NULL DEFAULT 0,
			scan_paused INTEGER NOT NULL DEFAULT 0,
			last_full_scan_at_utc TEXT,
			last_run_interrupted INTEGER NOT NULL DEFAULT 0
		);
	`);
	const metaRows = db.exec(`SELECT id FROM ${INDEX_META_TABLE} WHERE id = 1`);
	if (!metaRows[0]?.values.length) {
		db.run(
			`INSERT INTO ${INDEX_META_TABLE} (
				id, schema_version, first_scan_approved, scan_paused, last_run_interrupted
			) VALUES (1, 0, 0, 0, 0)`,
		);
	}
}

/**
 * Runs pending migrations inside a transaction.
 * At v0 skeleton: ensures bootstrap tables exist; no version bumps yet.
 */
export function runMigrations(db: SqlJsDatabase, logger: LoggerPort): void {
	logger.info("storage: migrations start", { targetVersion: LATEST_SCHEMA_VERSION });
	try {
		db.run("BEGIN");
		applyMigrationV0(db);
		const current = readSchemaVersion(db);
		if (current > LATEST_SCHEMA_VERSION) {
			throw new Error(
				`index.sqlite schema version ${current} is newer than supported ${LATEST_SCHEMA_VERSION}`,
			);
		}
		db.run("COMMIT");
		logger.info("storage: migrations complete", { schemaVersion: current });
	} catch (err: unknown) {
		try {
			db.run("ROLLBACK");
		} catch {
			// ignore rollback failure on broken state
		}
		const message = err instanceof Error ? err.message : String(err);
		logger.error("storage: migrations failed", { error: message });
		throw err;
	}
}
