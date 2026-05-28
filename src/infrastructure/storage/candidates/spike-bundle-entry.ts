/**
 * Entry used by scripts/measure-bundle.mjs to estimate sql.js bundle weight.
 * Not loaded by the Obsidian plugin at runtime.
 */
import initSqlJs from "sql.js";
import { getSqlWasmBinary } from "trackdex:sql-wasm";

export async function measureSpikeBundleEntry(): Promise<void> {
	await initSqlJs({ wasmBinary: getSqlWasmBinary() });
}

void measureSpikeBundleEntry();
