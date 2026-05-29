import type { LoggerPort } from "application/ports/logger-port";
import type { SqlJsDatabase } from "./candidates/sql-js-init";
import {
	INDEX_META_TABLE,
	SCHEMA_VERSION_TABLE,
} from "./migrations/constants";
import { applyMigrationV1 } from "./migrations/v1";
import { V1_SCHEMA_VERSION } from "./migrations/v1-schema";

export { INDEX_META_TABLE, SCHEMA_VERSION_TABLE } from "./migrations/constants";

/** Latest applied schema version. */
export const LATEST_SCHEMA_VERSION = V1_SCHEMA_VERSION;

function readSchemaVersion(db: SqlJsDatabase): number {
	const result = db.exec(`SELECT version FROM ${SCHEMA_VERSION_TABLE} LIMIT 1`);
	const raw = result[0]?.values[0]?.[0];
	if (raw == null) {
		return 0;
	}
	return Number(raw);
}

/** Idempotent v0 bootstrap: version table + single-row index_meta stub. */
export function applyMigrationV0(db: SqlJsDatabase): void {
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
 * v0 bootstrap is always applied; v1 runs when stored version is below 1.
 */
export function runMigrations(db: SqlJsDatabase, logger: LoggerPort): void {
	logger.info("storage: migrations start", { targetVersion: LATEST_SCHEMA_VERSION });
	try {
		db.run("BEGIN");
		applyMigrationV0(db);
		let current = readSchemaVersion(db);
		if (current > LATEST_SCHEMA_VERSION) {
			throw new Error(
				`index.sqlite schema version ${current} is newer than supported ${LATEST_SCHEMA_VERSION}`,
			);
		}
		if (current < V1_SCHEMA_VERSION) {
			logger.info("storage: migration v1 start");
			applyMigrationV1(db);
			current = readSchemaVersion(db);
			logger.info("storage: migration v1 end", { schemaVersion: current });
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
