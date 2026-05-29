import {MarkdownView, Notice} from "obsidian";
import type {TrackdexPluginHost} from "../../composition/plugin-host";
import {t} from "../../ui/i18n";

/** Stable v1 command IDs from TECHNICAL_DESIGN §12.2 — do not rename after release. */
export const TRACKDEX_COMMAND_IDS = {
	scanOrResumeIndexing: "scan-or-resume-indexing",
	reindexPlaces: "reindex-places",
	makeCurrentNotePlace: "make-current-note-place",
	editCurrentPlaceGeometry: "edit-current-place-geometry",
	pauseIndexing: "pause-indexing",
	resetRebuildIndex: "reset-rebuild-index",
} as const;

function showNotImplementedNotice(): void {
	new Notice(`Trackdex: ${t("common.notImplementedYet")}`);
}

function runWhenActiveMarkdownNote(
	plugin: TrackdexPluginHost,
	checking: boolean,
	run: () => void,
): boolean {
	const markdownView = plugin.app.workspace.getActiveViewOfType(MarkdownView);
	if (!markdownView) {
		return false;
	}
	if (!checking) {
		run();
	}
	return true;
}

/** Registers v1 shell commands (localized names, stable IDs, stub callbacks). */
export function registerTrackdexCommands(plugin: TrackdexPluginHost): void {
	plugin.addCommand({
		id: TRACKDEX_COMMAND_IDS.scanOrResumeIndexing,
		name: t("commands.scanOrResumeIndexing"),
		callback: showNotImplementedNotice,
	});

	plugin.addCommand({
		id: TRACKDEX_COMMAND_IDS.reindexPlaces,
		name: t("commands.reindexPlaces"),
		callback: showNotImplementedNotice,
	});

	plugin.addCommand({
		id: TRACKDEX_COMMAND_IDS.makeCurrentNotePlace,
		name: t("commands.makeCurrentNotePlace"),
		checkCallback: (checking) =>
			runWhenActiveMarkdownNote(plugin, checking, showNotImplementedNotice),
	});

	plugin.addCommand({
		id: TRACKDEX_COMMAND_IDS.editCurrentPlaceGeometry,
		name: t("commands.editCurrentPlaceGeometry"),
		checkCallback: (checking) =>
			runWhenActiveMarkdownNote(plugin, checking, showNotImplementedNotice),
	});

	plugin.addCommand({
		id: TRACKDEX_COMMAND_IDS.pauseIndexing,
		name: t("commands.pauseIndexing"),
		callback: showNotImplementedNotice,
	});

	plugin.addCommand({
		id: TRACKDEX_COMMAND_IDS.resetRebuildIndex,
		name: t("commands.resetRebuildIndex"),
		callback: showNotImplementedNotice,
	});
}
