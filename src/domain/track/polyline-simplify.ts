import type { Bbox, LatLng } from "domain/shared/geo";
import type { ParsedTrackPoint } from "domain/track/parsed-track";
import { haversineDistanceM } from "domain/track/track-metrics";

/**
 * Perpendicular-distance tolerance for Ramer–Douglas–Peucker simplification
 * (TECHNICAL_DESIGN §7.4 step 5 — simplify polyline for map rendering).
 */
export const POLYLINE_SIMPLIFY_TOLERANCE_M = 10;

/** Map geometry derived from the full parsed point stream for indexing. */
export interface TrackMapGeometry {
	readonly bbox: Bbox | null;
	readonly polylineSimplified: LatLng[] | null;
}

function toLatLng(point: Pick<ParsedTrackPoint, "lat" | "lon">): LatLng {
	return { lat: point.lat, lon: point.lon };
}

/**
 * Axis-aligned bounding box of all track points (south/west/north/east in degrees).
 */
export function computeTrackBbox(
	points: readonly Pick<ParsedTrackPoint, "lat" | "lon">[],
): Bbox | null {
	if (points.length === 0) {
		return null;
	}
	const first = points[0]!;
	let south = first.lat;
	let north = first.lat;
	let west = first.lon;
	let east = first.lon;
	for (const point of points) {
		south = Math.min(south, point.lat);
		north = Math.max(north, point.lat);
		west = Math.min(west, point.lon);
		east = Math.max(east, point.lon);
	}
	return { south, west, north, east };
}

/** Whether a bbox is safe for Leaflet `fitBounds` / map prefilter (v1, no dateline wrap). */
export function isBboxValidForMapFit(bbox: Bbox): boolean {
	const values = [bbox.south, bbox.west, bbox.north, bbox.east];
	if (!values.every((value) => Number.isFinite(value))) {
		return false;
	}
	if (bbox.south < -90 || bbox.north > 90) {
		return false;
	}
	if (bbox.west < -180 || bbox.east > 180) {
		return false;
	}
	if (bbox.south > bbox.north) {
		return false;
	}
	if (bbox.west > bbox.east) {
		return false;
	}
	return true;
}

function perpendicularDistanceM(point: LatLng, lineStart: LatLng, lineEnd: LatLng): number {
	const segmentLengthM = haversineDistanceM(lineStart, lineEnd);
	if (segmentLengthM === 0) {
		return haversineDistanceM(lineStart, point);
	}
	const dStartM = haversineDistanceM(lineStart, point);
	const dEndM = haversineDistanceM(lineEnd, point);
	const semiPerimeterM = (dStartM + dEndM + segmentLengthM) / 2;
	const areaSquared =
		semiPerimeterM *
		(semiPerimeterM - dStartM) *
		(semiPerimeterM - dEndM) *
		(semiPerimeterM - segmentLengthM);
	const areaM = Math.sqrt(Math.max(0, areaSquared));
	return (2 * areaM) / segmentLengthM;
}

function ramerDouglasPeucker(latlngs: readonly LatLng[], toleranceM: number): LatLng[] {
	if (latlngs.length <= 2) {
		return [...latlngs];
	}

	const keep = new Uint8Array(latlngs.length);
	keep[0] = 1;
	keep[latlngs.length - 1] = 1;

	const ranges: Array<[number, number]> = [[0, latlngs.length - 1]];

	while (ranges.length > 0) {
		const range = ranges.pop();
		if (range === undefined) {
			continue;
		}
		const [start, end] = range;
		if (end - start < 2) {
			continue;
		}

		const lineStart = latlngs[start]!;
		const lineEnd = latlngs[end]!;
		let maxDistanceM = -1;
		let farthestIndex = start;

		for (let index = start + 1; index < end; index += 1) {
			const point = latlngs[index]!;
			const distanceM = perpendicularDistanceM(point, lineStart, lineEnd);
			if (distanceM > maxDistanceM) {
				maxDistanceM = distanceM;
				farthestIndex = index;
			}
		}

		if (maxDistanceM > toleranceM) {
			keep[farthestIndex] = 1;
			ranges.push([start, farthestIndex], [farthestIndex, end]);
		}
	}

	const simplified: LatLng[] = [];
	for (let index = 0; index < latlngs.length; index += 1) {
		if (keep[index] === 1) {
			simplified.push(latlngs[index]!);
		}
	}
	return simplified;
}

/**
 * Simplify the full track polyline for map rendering (Ramer–Douglas–Peucker).
 * Endpoints are always kept; returns null when there are no points.
 */
export function simplifyTrackPolyline(
	points: readonly Pick<ParsedTrackPoint, "lat" | "lon">[],
	toleranceM: number = POLYLINE_SIMPLIFY_TOLERANCE_M,
): LatLng[] | null {
	if (points.length === 0) {
		return null;
	}
	if (points.length === 1) {
		return [toLatLng(points[0]!)];
	}
	const latlngs = points.map((point) => toLatLng(point));
	return ramerDouglasPeucker(latlngs, toleranceM);
}

/** Bbox and simplified polyline for catalog persistence (`bbox_json`, `polyline_simplified_json`). */
export function computeTrackMapGeometry(
	points: readonly Pick<ParsedTrackPoint, "lat" | "lon">[],
	toleranceM: number = POLYLINE_SIMPLIFY_TOLERANCE_M,
): TrackMapGeometry {
	return {
		bbox: computeTrackBbox(points),
		polylineSimplified: simplifyTrackPolyline(points, toleranceM),
	};
}

/** Stable JSON for `bbox_json` column (null when bbox absent). */
export function stringifyTrackBboxJson(bbox: Bbox | null): string | null {
	if (bbox === null) {
		return null;
	}
	return JSON.stringify(bbox);
}

/** Stable JSON for `polyline_simplified_json` column (null when polyline absent). */
export function stringifyPolylineSimplifiedJson(polyline: LatLng[] | null): string | null {
	if (polyline === null) {
		return null;
	}
	return JSON.stringify(polyline);
}
