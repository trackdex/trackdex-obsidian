import {Editor, MarkdownView, Notice} from "obsidian";
import {registerTrackdexCommands} from "../infrastructure/obsidian/commands-registry";
import {TrackdexOverviewModal} from "../ui/components/trackdex-overview-modal";
import {t} from "../ui/i18n";
import {TrackdexSettingTab} from "../ui/settings/settings-tab";
import {registerTrackView} from "../ui/views/register-track-view";
import type {TrackdexContainer} from "./container";
import type {TrackdexPluginHost} from "./plugin-host";

/** Registers views, commands, and optional dev spikes via the plugin host. */
export async function bootstrapTrackdexPlugin(
	plugin: TrackdexPluginHost,
	_container: TrackdexContainer,
): Promise<void> {
	registerTrackView(plugin);
	registerTrackdexCommands(plugin);

	plugin.addRibbonIcon("map", "Trackdex", () => {
		new Notice("Trackdex: open track catalog (coming soon)");
	});

	const statusBarItemEl = plugin.addStatusBarItem();
	statusBarItemEl.setText("Trackdex: ready");

	plugin.addCommand({
		id: "open-trackdex-overview",
		name: t("commands.openOverview"),
		callback: () => {
			new TrackdexOverviewModal(plugin.app).open();
		},
	});

	plugin.addCommand({
		id: "insert-trackdex-tag",
		name: t("commands.insertMarker"),
		editorCallback: (editor: Editor, _view: MarkdownView) => {
			editor.replaceSelection("#trackdex");
		},
	});

	plugin.addCommand({
		id: "scan-tracks-folder",
		name: t("commands.scanTracksFolder"),
		checkCallback: (checking: boolean) => {
			const markdownView = plugin.app.workspace.getActiveViewOfType(MarkdownView);
			if (markdownView) {
				if (!checking) {
					new Notice(
						`Trackdex scan is not implemented yet. Folder: ${plugin.settings.tracksFolder}`,
					);
				}
				return true;
			}
			return false;
		},
	});

	plugin.addSettingTab(new TrackdexSettingTab(plugin.app, plugin));

	await registerOptionalSpikeCommands(plugin);
}

async function registerOptionalSpikeCommands(plugin: TrackdexPluginHost): Promise<void> {
	const {ENABLE_STORAGE_SPIKE} = await import(
		"../infrastructure/storage/candidates/spike-config"
	);
	if (ENABLE_STORAGE_SPIKE) {
		const {registerStorageSpikeCommand} = await import(
			"../infrastructure/storage/candidates/register-storage-spike-command"
		);
		registerStorageSpikeCommand(plugin);
	}

	const {ENABLE_FIT_PARSER_SPIKE} = await import(
		"../infrastructure/parsers/candidates/spike-config"
	);
	if (ENABLE_FIT_PARSER_SPIKE) {
		const {registerFitParserSpikeCommand} = await import(
			"../infrastructure/parsers/candidates/register-fit-parser-spike-command"
		);
		registerFitParserSpikeCommand(plugin);
	}
}
