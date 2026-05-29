import type {DotPaths} from "../types";

export const en = {
	commands: {
		scanOrResumeIndexing: "Scan or resume indexing",
		reindexPlaces: "Reindex places",
		makeCurrentNotePlace: "Make current note a place",
		editCurrentPlaceGeometry: "Edit current place geometry",
		pauseIndexing: "Pause indexing",
		resetRebuildIndex: "Reset and rebuild index",
		openTracksSidebar: "Open track catalog",
	},
	settings: {
		comingSoon: "Trackdex settings will be available in a later milestone.",
	},
	common: {
		notImplementedYet: "Not implemented yet",
	},
	views: {
		tracksSidebarTitle: "Track catalog",
		tracksSidebarEmpty: "Track catalog is coming soon. Run indexing in a later milestone.",
		trackStatsPlaceholder:
			"Stats panel (milestone 0.5). Indexed tracks: {count}.",
		trackMobileTabsHint: "On mobile, map and stats will use tabs.",
		trackPreviewComingSoon: "Map preview for this format is coming soon.",
	},
} as const;

/** Same nested keys as `en`; values are localized display strings. */
export type MessagesSchema = {
	[K in keyof typeof en]: {
		[P in keyof (typeof en)[K]]: string;
	};
};

export type TranslationKey = DotPaths<typeof en>;
