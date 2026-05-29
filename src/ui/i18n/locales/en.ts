import type {DotPaths} from "../types";

export const en = {
	commands: {
		scanOrResumeIndexing: "Scan or resume indexing",
		reindexPlaces: "Reindex places",
		makeCurrentNotePlace: "Make current note a place",
		editCurrentPlaceGeometry: "Edit current place geometry",
		pauseIndexing: "Pause indexing",
		resetRebuildIndex: "Reset and rebuild index",
		openOverview: "Open overview",
		insertMarker: "Insert marker",
		scanTracksFolder: "Scan tracks folder",
	},
	settings: {
		tracksFolderName: "Tracks folder",
		tracksFolderDesc: "Folder with GPX files inside your vault",
		basemapTileUrlName: "Basemap tile URL",
		basemapTileUrlDesc:
			"Raster tile template with {z}, {x}, {y} (default: OpenStreetMap). " +
			"MapLibre/OpenFreeMap style URLs are not supported in Obsidian.",
	},
	common: {
		notImplementedYet: "Not implemented yet",
	},
} as const;

/** Same nested keys as `en`; values are localized display strings. */
export type MessagesSchema = {
	[K in keyof typeof en]: {
		[P in keyof (typeof en)[K]]: string;
	};
};

export type TranslationKey = DotPaths<typeof en>;
