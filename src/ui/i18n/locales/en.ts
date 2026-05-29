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
	interruptedRun: {
		message:
			"Indexing did not finish last time. Some tracks may be missing or out of date.",
		resumeCta: "Check and continue",
		resuming: "Checking…",
	},
	firstScan: {
		title: "Index track files in this vault",
		body:
			"Trackdex will scan your vault for GPX, TCX, and FIT files. Files are read only; your notes and track files are not modified.",
		formats: "Supported: .gpx, .tcx, .fit, and .fit.gz (case-insensitive).",
		approveCta: "Start indexing",
		approving: "Starting…",
	},
	views: {
		tracksSidebarTitle: "Track catalog",
		tracksSidebarEmpty: "No indexed tracks yet. Indexing progress will appear here.",
		trackStatsTitle: "Track stats",
		trackStatsNotIndexed: "This file is not in the index yet.",
		trackStatsPending: "Waiting to be indexed.",
		trackStatsIndexing: "Indexing in progress…",
		trackStatsStale: "Index is out of date. Metrics may not match the file.",
		trackStatsIndexError: "Indexing failed for this file.",
		trackStatsLoadError: "Could not load indexed stats.",
		trackStatsDate: "Date",
		trackStatsDuration: "Duration",
		trackStatsDistance: "Distance",
		trackStatsElevationGain: "Elevation gain",
		trackStatsElevationLoss: "Elevation loss",
		trackStatsAvgSpeed: "Avg speed",
		trackStatsMaxSpeed: "Max speed",
		trackStatsHrAvg: "Avg heart rate",
		trackStatsHrMax: "Max heart rate",
		trackStatsPowerAvg: "Avg power",
		trackStatsCadenceAvg: "Avg cadence",
		trackStatsSport: "Sport",
		trackStatsStatusPending: "Pending",
		trackStatsStatusIndexing: "Indexing",
		trackStatsStatusIndexed: "Indexed",
		trackStatsStatusStale: "Stale",
		trackStatsStatusError: "Error",
		trackMobileTabMap: "Map",
		trackMobileTabStats: "Stats",
		trackPreviewComingSoon: "Map preview for this format is coming soon.",
		trackMapTilesOffline:
			"Map tiles unavailable. Showing route geometry only.",
		trackMapNoGeometry: "No route geometry available for this track.",
	},
} as const;

/** Same nested keys as `en`; values are localized display strings. */
export type MessagesSchema = {
	[K in keyof typeof en]: {
		[P in keyof (typeof en)[K]]: string;
	};
};

export type TranslationKey = DotPaths<typeof en>;
