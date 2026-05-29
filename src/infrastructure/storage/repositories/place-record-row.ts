import type { SqlValue } from "sql.js";
import type { Bbox } from "domain/shared/geo";
import type { GeometryKind, PlaceGeometry } from "domain/place/geometry";
import type { PlaceRecord } from "domain/place/place-record";

const GEOMETRY_KINDS: readonly GeometryKind[] = [
	"point",
	"circle",
	"rectangle",
	"polygon",
];

/** SQLite row shape for `places` (snake_case columns). */
export interface PlacesTableRow {
	note_path: string;
	geometry_kind: string;
	geometry_json: string;
	bbox_json: string | null;
	is_valid: number;
	error_message: string | null;
}

export function assertGeometryKind(kind: string): asserts kind is GeometryKind {
	if (!(GEOMETRY_KINDS as readonly string[]).includes(kind)) {
		throw new Error(`Trackdex storage: invalid geometry_kind "${kind}"`);
	}
}

function parseJsonColumn<T>(raw: string | null, label: string): T | null {
	if (raw == null || raw === "") {
		return null;
	}
	try {
		return JSON.parse(raw) as T;
	} catch {
		throw new Error(`Trackdex storage: invalid ${label} JSON`);
	}
}

function parsePlaceGeometry(raw: string, kind: GeometryKind): PlaceGeometry {
	const geometry = parseJsonColumn<PlaceGeometry>(raw, "geometry_json");
	if (geometry == null || typeof geometry !== "object" || !("kind" in geometry)) {
		throw new Error("Trackdex storage: invalid geometry_json");
	}
	if (geometry.kind !== kind) {
		throw new Error(
			`Trackdex storage: geometry_json kind "${geometry.kind}" does not match geometry_kind "${kind}"`,
		);
	}
	return geometry;
}

export function rowToPlaceRecord(row: PlacesTableRow): PlaceRecord {
	assertGeometryKind(row.geometry_kind);
	return {
		notePath: row.note_path,
		geometryKind: row.geometry_kind,
		geometry: parsePlaceGeometry(row.geometry_json, row.geometry_kind),
		bbox: parseJsonColumn<Bbox>(row.bbox_json, "bbox_json"),
		isValid: row.is_valid !== 0,
		errorMessage: row.error_message,
	};
}

function stringifyJson(value: unknown): string | null {
	if (value == null) {
		return null;
	}
	return JSON.stringify(value);
}

export const PLACE_ROW_COLUMNS = [
	"note_path",
	"geometry_kind",
	"geometry_json",
	"bbox_json",
	"is_valid",
	"error_message",
] as const;

export function placeRecordToRowParams(record: PlaceRecord): SqlValue[] {
	assertGeometryKind(record.geometryKind);
	if (record.geometry.kind !== record.geometryKind) {
		throw new Error(
			`Trackdex storage: geometry.kind "${record.geometry.kind}" does not match geometryKind "${record.geometryKind}"`,
		);
	}
	return [
		record.notePath,
		record.geometryKind,
		JSON.stringify(record.geometry),
		stringifyJson(record.bbox),
		record.isValid ? 1 : 0,
		record.errorMessage,
	];
}

export const PLACE_ROW_SELECT_SQL = `SELECT ${PLACE_ROW_COLUMNS.join(", ")}`;
