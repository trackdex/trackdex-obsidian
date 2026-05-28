import initSqlJs, { type Database, type SqlJsStatic } from "sql.js";
import { getSqlWasmBinary } from "trackdex:sql-wasm";

let sqlModulePromise: Promise<SqlJsStatic> | undefined;

export async function loadSqlJs(): Promise<SqlJsStatic> {
	if (!sqlModulePromise) {
		sqlModulePromise = initSqlJs({
			wasmBinary: getSqlWasmBinary(),
		});
	}
	return sqlModulePromise;
}

export type SqlJsDatabase = Database;
