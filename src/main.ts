import {Plugin} from "obsidian";
import {
	bootstrapTrackdexPlugin,
	createTrackdexContainer,
	type TrackdexContainer,
	type TrackdexPluginHost,
} from "./composition";
import {preserveSettingsFocus} from "./ui/components/preserve-settings-focus";
import {
	migrateSettings,
	type TrackdexSettings,
} from "./ui/settings/settings-tab";

export default class TrackdexPlugin extends Plugin implements TrackdexPluginHost {
	settings!: TrackdexSettings;
	private container: TrackdexContainer | null = null;

	async onload(): Promise<void> {
		await this.loadSettings();
		this.container = createTrackdexContainer(this);
		await bootstrapTrackdexPlugin(this, this.container);
	}

	onunload(): void {
		preserveSettingsFocus(this.app);
		this.container?.dispose();
		this.container = null;
		super.onunload();
	}

	async loadSettings(): Promise<void> {
		this.settings = migrateSettings(
			(await this.loadData()) as Partial<TrackdexSettings> | null,
		);
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}
}
