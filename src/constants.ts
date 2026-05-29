export const TRACKDEX_TRACK_VIEW_TYPE = "trackdex-track-view";

export const TRACKDEX_TRACKS_SIDEBAR_VIEW_TYPE = "trackdex-tracks-sidebar";

/**
 * Values for `Plugin.registerExtensions` (no leading dot).
 * Obsidian uses only the last path segment as `TFile.extension`, so `.fit.gz` /
 * `.gpx.gz` require registering `gz` and resolving the full suffix from the file name.
 */
export const TRACKDEX_REGISTERED_FILE_EXTENSIONS = [
	"gpx",
	"tcx",
	"fit",
	"gz",
] as const;

/** @deprecated Use {@link TRACKDEX_REGISTERED_FILE_EXTENSIONS} at registration sites. */
export const TRACKDEX_TRACK_FILE_EXTENSIONS =
	TRACKDEX_REGISTERED_FILE_EXTENSIONS;

/**
 * Raster tiles (Leaflet). Works in Obsidian; vector MapLibre/OpenFreeMap styles do not.
 * OSM tile server — allowed for client apps with attribution (not Wikimedia: 403 outside WM sites).
 */
export const DEFAULT_BASEMAP_TILE_URL =
	"https://tile.openstreetmap.org/{z}/{x}/{y}.png";

export const DEFAULT_BASEMAP_ATTRIBUTION =
	'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
