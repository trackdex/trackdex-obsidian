import {
	TRACKDEX_REGISTERED_FILE_EXTENSIONS,
	TRACKDEX_TRACK_VIEW_TYPE,
	TRACKDEX_TRACKS_SIDEBAR_VIEW_TYPE,
} from "../constants";
import {TrackView} from "../ui/views/track-view";
import {TracksSidebarView} from "../ui/views/tracks-sidebar-view";
import type {TrackdexContainer} from "./container";
import type {TrackdexPluginHost} from "./plugin-host";

/**
 * Registers track file view and catalog sidebar with container-backed dependencies.
 * `registerExtensions` opens {@link TRACKDEX_TRACK_VIEW_TYPE} from the file explorer
 * for v1 extensions; compound `.fit.gz` uses registered `gz` plus name-based routing in
 * {@link TrackView} via `getTrackFileExtension`.
 */
export function registerViews(
	plugin: TrackdexPluginHost,
	container: TrackdexContainer,
): void {
	plugin.registerView(
		TRACKDEX_TRACK_VIEW_TYPE,
		(leaf) => new TrackView(leaf, plugin, container.trackQuery),
	);
	plugin.registerExtensions(
		[...TRACKDEX_REGISTERED_FILE_EXTENSIONS],
		TRACKDEX_TRACK_VIEW_TYPE,
	);

	plugin.registerView(
		TRACKDEX_TRACKS_SIDEBAR_VIEW_TYPE,
		(leaf) =>
			new TracksSidebarView(leaf, {
				trackQuery: container.trackQuery,
				indexMeta: container.indexMeta,
				indexing: container.indexing,
			}),
	);
}
