import {registerTrackdexCommands} from "../infrastructure/obsidian/commands-registry";
import {ENABLE_FIT_PARSER_SPIKE} from "../infrastructure/parsers/candidates/spike-config";
import {
	ENABLE_STORAGE_SCHEMA_SMOKE,
	ENABLE_STORAGE_SPIKE,
} from "../infrastructure/storage/candidates/spike-config";
import {t} from "../ui/i18n";
import {TrackdexSettingTab} from "../ui/settings/settings-tab";
import {openTracksSidebar} from "../ui/views/open-tracks-sidebar";
import type {TrackdexContainer} from "./container";
import type {TrackdexPluginHost} from "./plugin-host";
import {registerViews} from "./register-views";

/** Registers views, commands, and optional dev spikes via the plugin host. */
export async function bootstrapTrackdexPlugin(
	plugin: TrackdexPluginHost,
	container: TrackdexContainer,
): Promise<void> {
	registerViews(plugin, container);
	registerTrackdexCommands(plugin);

	plugin.addRibbonIcon("map", "Trackdex", () => {
		void openTracksSidebar(plugin.app);
	});

	const statusBarItemEl = plugin.addStatusBarItem();
	statusBarItemEl.setText("Trackdex");

	plugin.addCommand({
		id: "open-tracks-sidebar",
		name: t("commands.openTracksSidebar"),
		callback: () => {
			void openTracksSidebar(plugin.app);
		},
	});

	plugin.addSettingTab(new TrackdexSettingTab(plugin.app, plugin));

	if (ENABLE_STORAGE_SCHEMA_SMOKE) {
		const {registerStorageSchemaSmokeCommands} = await import(
			"../infrastructure/storage/register-storage-schema-smoke-command"
		);
		registerStorageSchemaSmokeCommands(plugin, container.tracks);
	}

	if (ENABLE_STORAGE_SPIKE || ENABLE_FIT_PARSER_SPIKE) {
		await registerOptionalSpikeCommands(plugin);
	}
}

async function registerOptionalSpikeCommands(plugin: TrackdexPluginHost): Promise<void> {
	if (ENABLE_STORAGE_SPIKE) {
		const {registerStorageSpikeCommand} = await import(
			"../infrastructure/storage/candidates/register-storage-spike-command"
		);
		registerStorageSpikeCommand(plugin);
	}

	if (ENABLE_FIT_PARSER_SPIKE) {
		const {registerFitParserSpikeCommand} = await import(
			"../infrastructure/parsers/candidates/register-fit-parser-spike-command"
		);
		registerFitParserSpikeCommand(plugin);
	}
}
