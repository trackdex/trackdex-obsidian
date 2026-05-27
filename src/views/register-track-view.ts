import {
	TRACKDEX_GPX_EXTENSIONS,
	TRACKDEX_TRACK_VIEW_TYPE,
} from "../constants";
import {TrackStubView} from "../ui/track-stub-view";
import type MyPlugin from "../main";

export function registerTrackView(plugin: MyPlugin): void {
	plugin.registerView(
		TRACKDEX_TRACK_VIEW_TYPE,
		(leaf) => new TrackStubView(leaf, plugin),
	);
	plugin.registerExtensions(
		[...TRACKDEX_GPX_EXTENSIONS],
		TRACKDEX_TRACK_VIEW_TYPE,
	);
}
