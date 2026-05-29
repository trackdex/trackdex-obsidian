import {App, Editor, MarkdownView, Modal, Notice, Plugin} from 'obsidian';
import {preserveSettingsFocus} from "./ui/components/preserve-settings-focus";
import {
	migrateSettings,
	TrackdexSettingTab,
	type TrackdexSettings,
} from "./ui/settings/settings-tab";
import {registerTrackView} from "./ui/views/register-track-view";
import {ENABLE_STORAGE_SPIKE} from "./infrastructure/storage/candidates/spike-config";
import {ENABLE_FIT_PARSER_SPIKE} from "./infrastructure/parsers/candidates/spike-config";

export default class TrackdexPlugin extends Plugin {
	settings: TrackdexSettings;

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
			name: "Open overview",
			callback: () => {
				new TrackdexModal(this.app).open();
			}
		});

		this.addCommand({
			id: "insert-trackdex-tag",
			name: "Insert marker",
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

		if (ENABLE_STORAGE_SPIKE) {
			const {registerStorageSpikeCommand} = await import(
				"./infrastructure/storage/candidates/register-storage-spike-command"
			);
			registerStorageSpikeCommand(this);
		}

		if (ENABLE_FIT_PARSER_SPIKE) {
			const {registerFitParserSpikeCommand} = await import(
				"./infrastructure/parsers/candidates/register-fit-parser-spike-command"
			);
			registerFitParserSpikeCommand(this);
		}
	}

	onunload(): void {
		preserveSettingsFocus(this.app);
		super.onunload();
	}

	async loadSettings() {
		this.settings = migrateSettings(
			await this.loadData() as Partial<TrackdexSettings> | null,
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
