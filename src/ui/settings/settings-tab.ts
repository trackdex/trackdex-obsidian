import {App, PluginSettingTab} from "obsidian";
import type {TrackdexPluginHost} from "../../composition/plugin-host";
import {t} from "../i18n";

export type {TrackdexSettings} from "./settings-types";
export {DEFAULT_SETTINGS} from "./settings-types";
export type {MigrateSettingsResult} from "./migrate-settings";
export {migrateSettings} from "./migrate-settings";

export class TrackdexSettingTab extends PluginSettingTab {
	plugin: TrackdexPluginHost;

	constructor(app: App, plugin: TrackdexPluginHost) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;
		containerEl.empty();
		containerEl.createEl("p", {text: t("settings.comingSoon")});

		const legalSection = containerEl.createDiv({cls: "trackdex-settings__legal"});
		legalSection.createEl("h3", {text: t("settings.legalTitle")});
		legalSection.createEl("p", {text: t("settings.legalTileNetwork")});
		legalSection.createEl("p", {text: t("settings.legalOfflineFirst")});
		legalSection.createEl("p", {text: t("settings.legalLogsLocal")});
	}
}
