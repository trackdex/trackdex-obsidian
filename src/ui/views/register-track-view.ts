import {
	TRACKDEX_GPX_EXTENSIONS,
	TRACKDEX_TRACK_VIEW_TYPE,
} from "../../constants";
import type {TrackdexPluginHost} from "../../composition/plugin-host";
import {TrackStubView} from "./track-stub-view";

export function registerTrackView(plugin: TrackdexPluginHost): void {
	plugin.registerView(
		TRACKDEX_TRACK_VIEW_TYPE,
		(leaf) => new TrackStubView(leaf, plugin),
	);
	plugin.registerExtensions(
		[...TRACKDEX_GPX_EXTENSIONS],
		TRACKDEX_TRACK_VIEW_TYPE,
	);
}
