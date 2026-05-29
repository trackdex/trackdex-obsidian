import type { Plugin } from "obsidian";
import {
	DEFAULT_STORAGE_SPIKE_BACKEND,
	type StorageSpikeBackend,
} from "./spike-config";
import { IndexedDbSpikeAdapter } from "./indexed-db-spike-adapter";
import { SqlJsSpikeAdapter } from "./sql-js-spike-adapter";
import type { StorageSpikeAdapter, StorageSpikeResult } from "./storage-spike-types";

export interface RunStorageSpikeOptions {
	backend?: StorageSpikeBackend;
	/** When true, only read persisted marker (after plugin reload). */
	verifyOnly?: boolean;
}

function createAdapter(plugin: Plugin, backend: StorageSpikeBackend): StorageSpikeAdapter {
	switch (backend) {
		case "indexeddb":
			return new IndexedDbSpikeAdapter(plugin);
		case "sqljs":
		default:
			return new SqlJsSpikeAdapter(plugin);
	}
}

export async function runStorageSpike(
	plugin: Plugin,
	options: RunStorageSpikeOptions = {},
): Promise<StorageSpikeResult> {
	const backend = options.backend ?? DEFAULT_STORAGE_SPIKE_BACKEND;
	const adapter = createAdapter(plugin, backend);
	const persistencePath = adapter.persistencePath;

	try {
		await adapter.open();

		if (options.verifyOnly) {
			const markerValue = await adapter.readMarker();
			const ok = markerValue != null && markerValue.length > 0;
			return {
				backend: adapter.backend,
				mode: "verify",
				ok,
				persistencePath,
				markerValue,
				message: ok
					? `Verify OK: marker=${markerValue}`
					: "Verify FAILED: no persisted marker (run write pass first, then reload plugin)",
			};
		}

		const markerValue = String(Date.now());
		await adapter.runCrud(markerValue);
		await adapter.persist();
		const reread = await adapter.readMarker();
		const ok = reread === markerValue;
		return {
			backend: adapter.backend,
			mode: "write",
			ok,
			persistencePath,
			markerValue: reread,
			message: ok
				? `CRUD OK; persisted marker=${markerValue}. Reload plugin, then run "Verify storage spike".`
				: `CRUD FAILED: expected ${markerValue}, got ${reread ?? "null"}`,
		};
	} finally {
		await adapter.close();
	}
}
