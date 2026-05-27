export const TRACKDEX_TRACK_VIEW_TYPE = "trackdex-track-view";

export const TRACKDEX_GPX_EXTENSIONS = ["gpx"] as const;

/**
 * Raster tiles (Leaflet). Works in Obsidian; vector MapLibre/OpenFreeMap styles do not.
 * Wikimedia OSM — no API key; per-user requests from the app.
 */
export const DEFAULT_BASEMAP_TILE_URL =
	"https://maps.wikimedia.org/osm-intl/{z}/{x}/{y}.png";

export const DEFAULT_BASEMAP_ATTRIBUTION =
	'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> ' +
	'contributors &copy; <a href="https://wikimediafoundation.org/wiki/Maps_Terms_of_Use">Wikimedia</a>';
