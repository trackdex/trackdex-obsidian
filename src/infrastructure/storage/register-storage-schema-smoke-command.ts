import { Notice, type Plugin } from "obsidian";
import type { TrackRepository } from "application/ports/repositories";
import {
	runStorageSchemaSmokeVerify,
	runStorageSchemaSmokeWrite,
} from "./schema-smoke-runner";

export function registerStorageSchemaSmokeCommands(
	plugin: Plugin,
	tracks: TrackRepository,
): void {
	plugin.addCommand({
		id: "storage-schema-smoke",
		name: "Run storage schema smoke test",
		callback: async () => {
			try {
				const result = await runStorageSchemaSmokeWrite(tracks);
				new Notice(
					result.ok
						? `Trackdex schema smoke: ${result.message}`
						: `Trackdex schema smoke FAILED: ${result.message}`,
					result.ok ? 10_000 : 0,
				);
				console.debug("[trackdex schema smoke]", result);
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				console.error("[trackdex schema smoke]", error);
				new Notice(`Trackdex schema smoke error: ${message}`, 0);
			}
		},
	});

	plugin.addCommand({
		id: "storage-schema-verify",
		name: "Verify storage schema smoke (after reload)",
		callback: async () => {
			try {
				const result = await runStorageSchemaSmokeVerify(tracks);
				new Notice(
					result.ok
						? `Trackdex schema verify: ${result.message}`
						: `Trackdex schema verify FAILED: ${result.message}`,
					result.ok ? 10_000 : 0,
				);
				console.debug("[trackdex schema verify]", result);
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				console.error("[trackdex schema verify]", error);
				new Notice(`Trackdex schema verify error: ${message}`, 0);
			}
		},
	});
}
