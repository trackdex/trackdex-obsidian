import { Notice, type Plugin } from "obsidian";
import { runStorageSpike } from "./storage-spike-runner";

export function registerStorageSpikeCommand(plugin: Plugin): void {
	plugin.addCommand({
		id: "storage-spike-smoke",
		name: "Run storage spike smoke test",
		callback: async () => {
			try {
				const result = await runStorageSpike(plugin, { backend: "sqljs" });
				new Notice(
					result.ok
						? `Trackdex storage spike: ${result.message}`
						: `Trackdex storage spike FAILED: ${result.message}`,
					result.ok ? 8000 : 0,
				);
				console.debug("[trackdex storage spike]", result);
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				console.error("[trackdex storage spike]", error);
				new Notice(`Trackdex storage spike error: ${message}`, 0);
			}
		},
	});

	plugin.addCommand({
		id: "storage-spike-verify",
		name: "Verify storage spike (after reload)",
		callback: async () => {
			try {
				const result = await runStorageSpike(plugin, {
					backend: "sqljs",
					verifyOnly: true,
				});
				new Notice(
					result.ok
						? `Trackdex storage verify: ${result.message}`
						: `Trackdex storage verify FAILED: ${result.message}`,
					result.ok ? 8000 : 0,
				);
				console.debug("[trackdex storage spike verify]", result);
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				console.error("[trackdex storage spike verify]", error);
				new Notice(`Trackdex storage verify error: ${message}`, 0);
			}
		},
	});

	plugin.addCommand({
		id: "storage-spike-indexeddb",
		name: "Run storage spike (IndexedDB fallback)",
		callback: async () => {
			try {
				const result = await runStorageSpike(plugin, { backend: "indexeddb" });
				new Notice(
					result.ok
						? `Trackdex IndexedDB spike: ${result.message}`
						: `Trackdex IndexedDB spike FAILED: ${result.message}`,
					result.ok ? 8000 : 0,
				);
				console.debug("[trackdex indexeddb spike]", result);
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				console.error("[trackdex indexeddb spike]", error);
				new Notice(`Trackdex IndexedDB spike error: ${message}`, 0);
			}
		},
	});
}
