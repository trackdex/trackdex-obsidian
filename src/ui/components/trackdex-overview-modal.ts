import {App, Modal} from "obsidian";

export class TrackdexOverviewModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen(): void {
		const {contentEl} = this;
		contentEl.setText("Trackdex helps you catalog GPX tracks in your vault.");
	}

	onClose(): void {
		const {contentEl} = this;
		contentEl.empty();
	}
}
