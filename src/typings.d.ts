declare module "trackdex:sql-wasm" {
	export function getSqlWasmBinary(): Uint8Array;
}

declare module "sql.js" {
	export type SqlValue = string | number | null | Uint8Array;

	export interface QueryExecResult {
		columns: string[];
		values: SqlValue[][];
	}

	export interface Database {
		run(sql: string, params?: SqlValue[]): void;
		exec(sql: string): QueryExecResult[];
		export(): Uint8Array;
		close(): void;
	}

	export interface SqlJsStatic {
		Database: new (data?: Uint8Array) => Database;
	}

	export interface InitSqlJsConfig {
		locateFile?: (file: string) => string;
		wasmBinary?: Uint8Array;
	}

	export default function initSqlJs(
		config?: InitSqlJsConfig,
	): Promise<SqlJsStatic>;
}
