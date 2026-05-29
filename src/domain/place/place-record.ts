import type { Bbox } from "domain/shared/geo";
import type { GeometryKind, PlaceGeometry } from "domain/place/geometry";

/** Vault-relative path to a place note (primary key). */
export type PlaceNotePath = string;

/** Persisted place row (`places` table logical model). */
export interface PlaceRecord {
	readonly notePath: PlaceNotePath;
	readonly geometryKind: GeometryKind;
	readonly geometry: PlaceGeometry;
	readonly bbox: Bbox | null;
	readonly isValid: boolean;
	readonly errorMessage: string | null;
}
