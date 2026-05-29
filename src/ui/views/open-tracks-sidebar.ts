import type {App, WorkspaceLeaf} from "obsidian";
import {TRACKDEX_TRACKS_SIDEBAR_VIEW_TYPE} from "../../constants";

/** Opens or focuses the track catalog sidebar leaf. */
export async function openTracksSidebar(app: App): Promise<WorkspaceLeaf> {
	const {workspace} = app;
	const existing = workspace.getLeavesOfType(TRACKDEX_TRACKS_SIDEBAR_VIEW_TYPE);
	if (existing.length > 0) {
		const leaf = existing[0]!;
		workspace.revealLeaf(leaf);
		return leaf;
	}

	const rightLeaf = workspace.getRightLeaf(false);
	const leaf = rightLeaf ?? workspace.getLeaf(true);
	await leaf.setViewState({
		type: TRACKDEX_TRACKS_SIDEBAR_VIEW_TYPE,
		active: true,
	});
	workspace.revealLeaf(leaf);
	return leaf;
}
