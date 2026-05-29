import type { Plugin } from "obsidian";
import { getPluginDataDir } from "./obsidian-binary-io";
import {
	SPIKE_META_KEY,
	type StorageSpikeAdapter,
} from "./storage-spike-types";

const DB_NAME = "trackdex-storage-spike";
const STORE_NAME = "meta";
const DB_VERSION = 1;

export class IndexedDbSpikeAdapter implements StorageSpikeAdapter {
	readonly backend = "IndexedDB";

	private db: IDBDatabase | null = null;
	private readonly persistenceLabel: string;

	constructor(plugin: Plugin) {
		this.persistenceLabel = `indexeddb://${DB_NAME}/${STORE_NAME} (plugin dir: ${getPluginDataDir(plugin)})`;
	}

	async open(): Promise<void> {
		this.db = await openIndexedDb();
	}

	async runCrud(markerValue: string): Promise<void> {
		const db = this.requireDb();
		await idbRequest(
			db
				.transaction(STORE_NAME, "readwrite")
				.objectStore(STORE_NAME)
				.put({ key: SPIKE_META_KEY, value: markerValue }),
		);
		const stored = await this.readMarker();
		if (stored !== markerValue) {
			throw new Error(`IndexedDB spike: read mismatch (expected ${markerValue}, got ${stored})`);
		}
		await idbRequest(
			db
				.transaction(STORE_NAME, "readwrite")
				.objectStore(STORE_NAME)
				.put({ key: SPIKE_META_KEY, value: `${markerValue}-updated` }),
		);
		await idbRequest(
			db
				.transaction(STORE_NAME, "readwrite")
				.objectStore(STORE_NAME)
				.put({ key: SPIKE_META_KEY, value: markerValue }),
		);
	}

	async readMarker(): Promise<string | null> {
		const db = this.requireDb();
		const request = db
			.transaction(STORE_NAME, "readonly")
			.objectStore(STORE_NAME)
			.get(SPIKE_META_KEY);
		const record = await idbRequest<{ key: string; value: string } | undefined>(
			request as IDBRequest<{ key: string; value: string } | undefined>,
		);
		return record?.value ?? null;
	}

	async persist(): Promise<void> {
		// IndexedDB persists automatically; no file export step.
	}

	async close(): Promise<void> {
		this.db?.close();
		this.db = null;
	}

	get persistencePath(): string {
		return this.persistenceLabel;
	}

	private requireDb(): IDBDatabase {
		if (!this.db) {
			throw new Error("IndexedDB spike: database not open");
		}
		return this.db;
	}
}

function openIndexedDb(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, DB_VERSION);
		request.onerror = () => reject(request.error ?? new Error("IndexedDB open failed"));
		request.onsuccess = () => resolve(request.result);
		request.onupgradeneeded = () => {
			const db = request.result;
			if (!db.objectStoreNames.contains(STORE_NAME)) {
				db.createObjectStore(STORE_NAME, { keyPath: "key" });
			}
		};
	});
}

function idbRequest<T>(request: IDBRequest<T>): Promise<T> {
	return new Promise((resolve, reject) => {
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
	});
}
