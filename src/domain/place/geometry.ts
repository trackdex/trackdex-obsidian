import type { LatLng } from "domain/shared/geo";

export type GeometryKind = "point" | "circle" | "rectangle" | "polygon";

export interface PointGeometry {
	readonly kind: "point";
	readonly center: LatLng;
	readonly radiusM: number;
}

export interface CircleGeometry {
	readonly kind: "circle";
	readonly center: LatLng;
	readonly radiusM: number;
}

export interface RectangleGeometry {
	readonly kind: "rectangle";
	readonly south: number;
	readonly west: number;
	readonly north: number;
	readonly east: number;
}

/** Single outer ring only; no holes in v1. */
export interface PolygonGeometry {
	readonly kind: "polygon";
	readonly ring: readonly LatLng[];
}

export type PlaceGeometry =
	| PointGeometry
	| CircleGeometry
	| RectangleGeometry
	| PolygonGeometry;
