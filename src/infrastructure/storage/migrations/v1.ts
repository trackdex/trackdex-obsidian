import type { SqlJsDatabase } from "../candidates/sql-js-init";
import {
	INDEX_META_TABLE,
	SCHEMA_VERSION_TABLE,
} from "./constants";
import { applyV1SchemaDdl, V1_SCHEMA_VERSION } from "./v1-schema";

/**
 * Applies logical schema v1 (§6.1 DDL) and bumps `schema_version` in both
 * `schema_version` and `index_meta`. Caller must run inside a transaction.
 */
export function applyMigrationV1(db: SqlJsDatabase): void {
	applyV1SchemaDdl(db);
	db.run(`UPDATE ${SCHEMA_VERSION_TABLE} SET version = ?`, [V1_SCHEMA_VERSION]);
	db.run(`UPDATE ${INDEX_META_TABLE} SET schema_version = ? WHERE id = 1`, [
		V1_SCHEMA_VERSION,
	]);
}
