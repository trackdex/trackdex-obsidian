import type { Plugin } from "obsidian";
import type { SqlJsDatabase } from "./sql-js-init";
import { loadSqlJs } from "./sql-js-init";
import {
	ensurePluginDataDir,
	getIndexSqlitePath,
	readPluginBinary,
	writePluginBinary,
} from "./obsidian-binary-io";
import {
	SPIKE_META_KEY,
	SPIKE_META_TABLE,
	type StorageSpikeAdapter,
} from "./storage-spike-types";

export class SqlJsSpikeAdapter implements StorageSpikeAdapter {
	readonly backend = "sql.js + vault adapter";

	private db: SqlJsDatabase | null = null;
	private readonly dbPath: string;

	constructor(private readonly plugin: Plugin) {
		this.dbPath = getIndexSqlitePath(plugin);
	}

	async open(): Promise<void> {
		const SQL = await loadSqlJs();
		await ensurePluginDataDir(this.plugin);
		const existing = await readPluginBinary(this.plugin.app, this.dbPath);
		this.db = existing ? new SQL.Database(existing) : new SQL.Database();
		this.db.run(`
			CREATE TABLE IF NOT EXISTS ${SPIKE_META_TABLE} (
				key TEXT PRIMARY KEY,
				value TEXT NOT NULL
			);
		`);
	}

	async runCrud(markerValue: string): Promise<void> {
		const db = this.requireDb();
		db.run(`DELETE FROM ${SPIKE_META_TABLE} WHERE key = ?`, [SPIKE_META_KEY]);
		db.run(`INSERT INTO ${SPIKE_META_TABLE} (key, value) VALUES (?, ?)`, [
			SPIKE_META_KEY,
			markerValue,
		]);
		const row = db.exec(
			`SELECT value FROM ${SPIKE_META_TABLE} WHERE key = '${SPIKE_META_KEY}'`,
		);
		if (!row[0]?.values[0]?.[0]) {
			throw new Error("sql.js spike: SELECT after INSERT returned no row");
		}
		const read = String(row[0].values[0][0]);
		if (read !== markerValue) {
			throw new Error(`sql.js spike: read mismatch (expected ${markerValue}, got ${read})`);
		}
		db.run(`UPDATE ${SPIKE_META_TABLE} SET value = ? WHERE key = ?`, [
			`${markerValue}-updated`,
			SPIKE_META_KEY,
		]);
		db.run(`DELETE FROM ${SPIKE_META_TABLE} WHERE key = ?`, [SPIKE_META_KEY]);
		db.run(`INSERT INTO ${SPIKE_META_TABLE} (key, value) VALUES (?, ?)`, [
			SPIKE_META_KEY,
			markerValue,
		]);
	}

	async readMarker(): Promise<string | null> {
		const db = this.requireDb();
		const row = db.exec(
			`SELECT value FROM ${SPIKE_META_TABLE} WHERE key = '${SPIKE_META_KEY}'`,
		);
		const value = row[0]?.values[0]?.[0];
		return value == null ? null : String(value);
	}

	async persist(): Promise<void> {
		const db = this.requireDb();
		const bytes = db.export();
		await writePluginBinary(this.plugin.app, this.dbPath, bytes);
	}

	async close(): Promise<void> {
		this.db?.close();
		this.db = null;
	}

	get persistencePath(): string {
		return this.dbPath;
	}

	private requireDb(): SqlJsDatabase {
		if (!this.db) {
			throw new Error("sql.js spike: database not open");
		}
		return this.db;
	}
}
