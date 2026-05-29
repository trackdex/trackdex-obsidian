import type { Plugin } from "obsidian";
import type { LoggerPort } from "application/ports/logger-port";
import {
	ensurePluginDataDir,
	getIndexSqlitePath,
	readPluginBinary,
	writePluginBinary,
} from "./candidates/obsidian-binary-io";
import { loadSqlJs, type SqlJsDatabase } from "./candidates/sql-js-init";
import { runMigrations } from "./migrations";

/**
 * Production sql.js facade: open index.sqlite in plugin data dir, run migrations, persist on demand.
 */
export class SqlStorageAdapter {
	private db: SqlJsDatabase | null = null;
	private readonly dbPath: string;

	constructor(private readonly plugin: Plugin) {
		this.dbPath = getIndexSqlitePath(plugin);
	}

	get persistencePath(): string {
		return this.dbPath;
	}

	isOpen(): boolean {
		return this.db != null;
	}

	getDatabase(): SqlJsDatabase {
		if (!this.db) {
			throw new Error("Trackdex storage: database not open");
		}
		return this.db;
	}

	async open(logger: LoggerPort): Promise<void> {
		if (this.db) {
			return;
		}
		const SQL = await loadSqlJs();
		await ensurePluginDataDir(this.plugin);
		const existing = await readPluginBinary(this.plugin.app, this.dbPath);
		this.db = existing ? new SQL.Database(existing) : new SQL.Database();
		runMigrations(this.db, logger);
		await this.persist();
		logger.info("storage: database open", { path: this.dbPath });
	}

	async persist(): Promise<void> {
		const db = this.getDatabase();
		const bytes = db.export();
		await writePluginBinary(this.plugin.app, this.dbPath, bytes);
	}

	async close(): Promise<void> {
		this.db?.close();
		this.db = null;
	}
}
