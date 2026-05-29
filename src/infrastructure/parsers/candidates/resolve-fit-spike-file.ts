import { isFitTrackFileName } from "domain/track/track-file-name";
import { FuzzySuggestModal, type App, TFile } from "obsidian";

function listFitFilesInVault(app: App): TFile[] {
	return app.vault
		.getFiles()
		.filter((file) => isFitTrackFileName(file.name));
}

class FitSpikeFileSuggestModal extends FuzzySuggestModal<TFile> {
	constructor(
		app: App,
		private readonly files: readonly TFile[],
		private readonly onPick: (file: TFile) => void,
	) {
		super(app);
	}

	getItems(): TFile[] {
		return [...this.files];
	}

	getItemText(file: TFile): string {
		return file.path;
	}

	onChooseItem(file: TFile): void {
		this.onPick(file);
	}
}

function pickFitFileInteractively(
	app: App,
	files: readonly TFile[],
): Promise<TFile> {
	if (files.length === 1) {
		return Promise.resolve(files[0]!);
	}
	return new Promise((resolve, reject) => {
		let chosen = false;
		const modal = new FitSpikeFileSuggestModal(app, files, (file) => {
			chosen = true;
			resolve(file);
		});
		modal.onClose = () => {
			if (!chosen) {
				reject(new Error("FIT file selection cancelled."));
			}
		};
		modal.open();
	});
}

/** Active FIT editor, sole vault FIT file, or fuzzy picker when several exist. */
export async function resolveFitFileForSpike(app: App): Promise<TFile> {
	const active = app.workspace.getActiveFile();
	if (active && isFitTrackFileName(active.name)) {
		return active;
	}

	const candidates = listFitFilesInVault(app);
	if (candidates.length === 0) {
		throw new Error(
			"No .fit or .fit.gz files in vault. Add a track file under tracks/, or open one first.",
		);
	}

	return pickFitFileInteractively(app, candidates);
}
