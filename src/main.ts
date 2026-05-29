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
		this.container = await createTrackdexContainer(this);
		await bootstrapTrackdexPlugin(this, this.container);
	}

	onunload(): void {
		preserveSettingsFocus(this.app);
		const container = this.container;
		this.container = null;
		void container?.shutdown();
		super.onunload();
	}

	async loadSettings(): Promise<void> {
		const raw = (await this.loadData()) as Record<string, unknown> | null;
		const {settings, strippedLegacy} = migrateSettings(raw);
		this.settings = settings;
		if (strippedLegacy) {
			await this.saveSettings();
		}
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}
}
