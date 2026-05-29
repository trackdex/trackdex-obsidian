import type {Bbox, LatLng} from "domain/shared/geo";
import {isBboxValidForMapFit} from "domain/track/polyline-simplify";
import type {LatLngExpression, LatLngBoundsExpression} from "leaflet";

/** Convert domain WGS-84 points to Leaflet `[lat, lng]` tuples. */
export function domainLatLngToLeaflet(
	points: readonly LatLng[],
): LatLngExpression[] {
	return points.map((point) => [point.lat, point.lon]);
}

/** Convert a domain bbox to Leaflet bounds when safe for map fit. */
export function domainBboxToLeafletBounds(
	bbox: Bbox | null | undefined,
): LatLngBoundsExpression | null {
	if (!bbox || !isBboxValidForMapFit(bbox)) {
		return null;
	}
	return [
		[bbox.south, bbox.west],
		[bbox.north, bbox.east],
	];
}
