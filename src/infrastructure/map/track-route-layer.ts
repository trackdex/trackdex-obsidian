import L, {type LatLngExpression} from "leaflet";
import type {TrackBasemap} from "./track-basemap";

const ROUTE_COLOR = "#2563eb";
const ROUTE_WEIGHT = 4;
const ROUTE_OPACITY = 0.9;
const FIT_BOUNDS_PADDING: L.PointExpression = [24, 24];
const FIT_BOUNDS_MAX_ZOOM = 16;

export interface TrackRouteLayer {
	polyline: L.Polyline;
	remove(): void;
}

export function addTrackRouteLayer(
	basemap: TrackBasemap,
	latlngs: LatLngExpression[],
	options?: {fitBounds?: boolean},
): TrackRouteLayer | null {
	if (latlngs.length === 0) {
		return null;
	}

	const polyline = L.polyline(latlngs, {
		color: ROUTE_COLOR,
		weight: ROUTE_WEIGHT,
		opacity: ROUTE_OPACITY,
		className: "trackdex-track-route",
	});
	polyline.addTo(basemap.map);

	if (options?.fitBounds === true && latlngs.length >= 2) {
		const bounds = L.latLngBounds(latlngs);
		basemap.map.fitBounds(bounds, {
			padding: FIT_BOUNDS_PADDING,
			maxZoom: FIT_BOUNDS_MAX_ZOOM,
			animate: false,
		});
	}

	return {
		polyline,
		remove() {
			if (basemap.map.hasLayer(polyline)) {
				basemap.map.removeLayer(polyline);
			}
		},
	};
}
