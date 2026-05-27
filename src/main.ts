import {App, Editor, MarkdownView, Modal, Notice, Plugin} from 'obsidian';
import {DEFAULT_SETTINGS, migrateSettings, MyPluginSettings, TrackdexSettingTab} from "./settings";
import {preserveSettingsFocus} from "./utils/preserve-settings-focus";
import {registerTrackView} from "./views/register-track-view";

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;

	async onload() {
		await this.loadSettings();

		registerTrackView(this);

		this.addRibbonIcon("map", "Trackdex", () => {
			new Notice("Trackdex: open track catalog (coming soon)");
		});

		const statusBarItemEl = this.addStatusBarItem();
		statusBarItemEl.setText("Trackdex: ready");

		this.addCommand({
			id: "open-trackdex-overview",
			name: "Open Trackdex overview",
			callback: () => {
				new TrackdexModal(this.app).open();
			}
		});

		this.addCommand({
			id: "insert-trackdex-tag",
			name: "Insert Trackdex marker",
			editorCallback: (editor: Editor, _view: MarkdownView) => {
				editor.replaceSelection("#trackdex");
			}
		});

		this.addCommand({
			id: "scan-tracks-folder",
			name: "Scan tracks folder",
			checkCallback: (checking: boolean) => {
				const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (markdownView) {
					if (!checking) {
						new Notice(`Trackdex scan is not implemented yet. Folder: ${this.settings.tracksFolder}`);
					}

					return true;
				}
				return false;
			}
		});

		this.addSettingTab(new TrackdexSettingTab(this.app, this));
	}

	onunload(): void {
		preserveSettingsFocus(this.app);
		super.onunload();
	}

	async loadSettings() {
		this.settings = migrateSettings(
			await this.loadData() as Partial<MyPluginSettings> | null,
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class TrackdexModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		let {contentEl} = this;
		contentEl.setText("Trackdex helps you catalog GPX tracks in your vault.");
	}

	onClose() {
		const {contentEl} = this;
		contentEl.empty();
	}
}
