import L, {type Map as LeafletMap, type TileLayer} from "leaflet";
import {
	DEFAULT_BASEMAP_ATTRIBUTION,
	DEFAULT_BASEMAP_TILE_URL,
} from "../../constants";

const DEFAULT_CENTER: L.LatLngExpression = [50, 10];
const DEFAULT_ZOOM = 4;

export interface TrackBasemap {
	map: LeafletMap;
	tileLayer: TileLayer;
}

export interface TrackMapViewState {
	mapCenter: {lat: number; lng: number};
	mapZoom: number;
}

export function normalizeBasemapTileUrl(url: string | undefined): string {
	const trimmed = url?.trim() ?? "";
	if (!trimmed) {
		return DEFAULT_BASEMAP_TILE_URL;
	}
	// MapLibre style URLs from earlier builds cannot be used as raster templates.
	if (trimmed.includes("/styles/") || !trimmed.includes("{z}")) {
		return DEFAULT_BASEMAP_TILE_URL;
	}
	// Wikimedia blocks non-WM referrers (HTTP 403); migrate saved URLs.
	if (trimmed.includes("maps.wikimedia.org")) {
		return DEFAULT_BASEMAP_TILE_URL;
	}
	return trimmed;
}

function disableLeafletEventBubble(...elements: HTMLElement[]): void {
	for (const el of elements) {
		L.DomEvent.disableScrollPropagation(el);
		L.DomEvent.disableClickPropagation(el);
	}
}

export function createTrackBasemap(
	container: HTMLElement,
	tileUrl: string = DEFAULT_BASEMAP_TILE_URL,
	extraScrollTargets: HTMLElement[] = [],
	initialView?: TrackMapViewState,
): TrackBasemap {
	const center: L.LatLngExpression = initialView
		? [initialView.mapCenter.lat, initialView.mapCenter.lng]
		: DEFAULT_CENTER;
	const zoom = initialView?.mapZoom ?? DEFAULT_ZOOM;

	const map = L.map(container, {
		center,
		zoom,
		zoomControl: false,
		attributionControl: false,
		scrollWheelZoom: true,
	});

	disableLeafletEventBubble(container, ...extraScrollTargets);

	const tileLayer = L.tileLayer(normalizeBasemapTileUrl(tileUrl), {
		attribution: DEFAULT_BASEMAP_ATTRIBUTION,
		maxZoom: 19,
		keepBuffer: 4,
	});

	tileLayer.addTo(map);
	L.control.zoom({position: "topright"}).addTo(map);

	return {map, tileLayer};
}

export function destroyTrackBasemap(basemap: TrackBasemap | null): void {
	if (!basemap) {
		return;
	}
	const {map, tileLayer} = basemap;
	try {
		tileLayer.off();
		map.off();
		map.stop();
		map.eachLayer((layer) => {
			map.removeLayer(layer);
		});
		// Do not call map.remove(): it deletes nodes inside the view container and can
		// disrupt Obsidian workspace layout (e.g. closing Settings while a map tab was open).
		const container = map.getContainer() as HTMLElement & {_leaflet_id?: number};
		delete container._leaflet_id;
	} catch {
		// View or plugin may already be tearing down.
	}
}

export function getTrackMapViewState(basemap: TrackBasemap): TrackMapViewState {
	const center = basemap.map.getCenter();
	return {
		mapCenter: {lat: center.lat, lng: center.lng},
		mapZoom: basemap.map.getZoom(),
	};
}

export function resizeTrackBasemap(basemap: TrackBasemap | null): void {
	if (!basemap) {
		return;
	}
	try {
		const mapContainer = basemap.map.getContainer();
		if (!mapContainer.isConnected) {
			return;
		}
		const {width, height} = mapContainer.getBoundingClientRect();
		if (width < 1 || height < 1) {
			return;
		}
		basemap.map.invalidateSize({animate: false});
	} catch {
		// Map may be removed during unload.
	}
}

/**
 * Recalculate map layout. Optionally redraw tiles when the pane was hidden.
 * Avoid redraw during zoom — it aborts in-flight tile loads (stale tiles stay visible).
 */
export function refreshTrackBasemap(
	basemap: TrackBasemap | null,
	options?: {redraw?: boolean},
): void {
	if (!basemap) {
		return;
	}
	resizeTrackBasemap(basemap);
	if (options?.redraw !== true) {
		return;
	}
	try {
		const mapContainer = basemap.map.getContainer();
		if (!mapContainer.isConnected) {
			return;
		}
		const {width, height} = mapContainer.getBoundingClientRect();
		if (width < 1 || height < 1) {
			return;
		}
		basemap.tileLayer.redraw();
	} catch {
		// Map may be removed during unload.
	}
}
