import type { Plugin } from "obsidian";
import {
	runFitParserSpike,
	showFitSpikeNotice,
} from "./fit-spike-runner";

export function registerFitParserSpikeCommand(plugin: Plugin): void {
	plugin.addCommand({
		id: "fit-spike-smoke",
		name: "Run FIT parser spike (FIT-file-parser)",
		callback: async () => {
			try {
				const result = await runFitParserSpike(plugin, {
					backend: "fit-file-parser",
				});
				showFitSpikeNotice(result);
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				console.error("[trackdex fit spike]", error);
				showFitSpikeNotice({
					backend: "fit-file-parser",
					sourceLabel: "",
					ok: false,
					message,
				});
			}
		},
	});

	plugin.addCommand({
		id: "fit-spike-garmin-sdk",
		name: "Run FIT parser spike (garmin sdk, reference)",
		callback: async () => {
			try {
				const result = await runFitParserSpike(plugin, {
					backend: "garmin-sdk",
				});
				showFitSpikeNotice(result);
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				console.error("[trackdex garmin fit spike]", error);
				showFitSpikeNotice({
					backend: "garmin-sdk",
					sourceLabel: "",
					ok: false,
					message,
				});
			}
		},
	});
}
