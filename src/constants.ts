export const TRACKDEX_TRACK_VIEW_TYPE = "trackdex-track-view";

export const TRACKDEX_TRACKS_SIDEBAR_VIEW_TYPE = "trackdex-tracks-sidebar";

/** Values for `Plugin.registerExtensions` (no leading dot). */
export const TRACKDEX_TRACK_FILE_EXTENSIONS = [
	"gpx",
	"tcx",
	"fit",
	"fit.gz",
] as const;

/**
 * Raster tiles (Leaflet). Works in Obsidian; vector MapLibre/OpenFreeMap styles do not.
 * OSM tile server — allowed for client apps with attribution (not Wikimedia: 403 outside WM sites).
 */
export const DEFAULT_BASEMAP_TILE_URL =
	"https://tile.openstreetmap.org/{z}/{x}/{y}.png";

export const DEFAULT_BASEMAP_ATTRIBUTION =
	'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
