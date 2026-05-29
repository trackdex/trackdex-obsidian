/** WGS-84 coordinate in degrees. */
export interface LatLng {
	readonly lat: number;
	readonly lon: number;
}

/** Axis-aligned bounding box: south/west/north/east in degrees. */
export interface Bbox {
	readonly south: number;
	readonly west: number;
	readonly north: number;
	readonly east: number;
}
