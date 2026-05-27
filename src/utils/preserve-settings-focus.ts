import type {App, WorkspaceLeaf} from "obsidian";
import {TRACKDEX_TRACK_VIEW_TYPE} from "../constants";

/** When Settings is open, avoid closing it by moving workspace focus off the track leaf. */
export function preserveSettingsFocus(
	app: App,
	excludeLeaf?: WorkspaceLeaf,
): WorkspaceLeaf | null {
	if (!document.querySelector(".vertical-tab-content")) {
		return null;
	}

	let fallback: WorkspaceLeaf | null = null;
	app.workspace.iterateAllLeaves((leaf) => {
		if (leaf === excludeLeaf) {
			return;
		}
		if (leaf.view.getViewType() === TRACKDEX_TRACK_VIEW_TYPE) {
			return;
		}
		if (!fallback) {
			fallback = leaf;
		}
	});

	if (fallback) {
		app.workspace.setActiveLeaf(fallback, {focus: false});
	}

	return fallback;
}
