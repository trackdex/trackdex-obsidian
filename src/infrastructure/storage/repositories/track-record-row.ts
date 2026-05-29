import type { SqlValue } from "sql.js";
import type { Bbox, LatLng } from "domain/shared/geo";
import type { TrackRecord } from "domain/track/track-record";
import type { TrackSegment } from "domain/track/track-segment";
import { TRACK_STATUSES, type TrackStatus } from "domain/track/track-status";
import {
	TIMEZONE_SOURCES,
	type TimezoneSource,
} from "domain/track/timezone-source";
import {
	trackDataFlagsFromJson,
	trackDataFlagsToJson,
} from "./track-data-flags-json";

/** SQLite row shape for `tracks` (snake_case columns). */
export interface TracksTableRow {
	path: string;
	mtime_ms: number;
	sha256: string | null;
	status: string;
	error_message: string | null;
	error_details: string | null;
	title_from_file: string | null;
	started_at_utc: string | null;
	ended_at_utc: string | null;
	started_at_raw: string | null;
	ended_at_raw: string | null;
	timezone_source: string;
	timezone_offset_min: number | null;
	duration_sec: number | null;
	distance_m: number | null;
	elevation_gain_m: number | null;
	elevation_loss_m: number | null;
	avg_speed_mps: number | null;
	max_speed_mps: number | null;
	sport_raw: string | null;
	sport_normalized: string | null;
	bbox_json: string | null;
	polyline_simplified_json: string | null;
	segments_json: string | null;
	data_flags_json: string;
	hr_avg: number | null;
	hr_max: number | null;
	power_avg: number | null;
	cadence_avg: number | null;
}

export function assertTrackStatus(status: string): asserts status is TrackStatus {
	if (!(TRACK_STATUSES as readonly string[]).includes(status)) {
		throw new Error(`Trackdex storage: invalid track status "${status}"`);
	}
}

function assertTimezoneSource(source: string): asserts source is TimezoneSource {
	if (!(TIMEZONE_SOURCES as readonly string[]).includes(source)) {
		throw new Error(`Trackdex storage: invalid timezone_source "${source}"`);
	}
}

function parseJsonColumn<T>(
	raw: string | null,
	label: string,
): T | null {
	if (raw == null || raw === "") {
		return null;
	}
	try {
		return JSON.parse(raw) as T;
	} catch {
		throw new Error(`Trackdex storage: invalid ${label} JSON`);
	}
}

function parseDataFlags(raw: string) {
	return trackDataFlagsFromJson(raw);
}

export function rowToTrackRecord(row: TracksTableRow): TrackRecord {
	assertTrackStatus(row.status);
	assertTimezoneSource(row.timezone_source);

	return {
		path: row.path,
		mtimeMs: Number(row.mtime_ms),
		sha256: row.sha256,
		status: row.status,
		errorMessage: row.error_message,
		errorDetails: row.error_details,
		titleFromFile: row.title_from_file,
		startedAtUtc: row.started_at_utc,
		endedAtUtc: row.ended_at_utc,
		startedAtRaw: row.started_at_raw,
		endedAtRaw: row.ended_at_raw,
		timezoneSource: row.timezone_source,
		timezoneOffsetMin:
			row.timezone_offset_min == null ? null : Number(row.timezone_offset_min),
		durationSec: row.duration_sec == null ? null : Number(row.duration_sec),
		distanceM: row.distance_m == null ? null : Number(row.distance_m),
		elevationGainM:
			row.elevation_gain_m == null ? null : Number(row.elevation_gain_m),
		elevationLossM:
			row.elevation_loss_m == null ? null : Number(row.elevation_loss_m),
		avgSpeedMps: row.avg_speed_mps == null ? null : Number(row.avg_speed_mps),
		maxSpeedMps: row.max_speed_mps == null ? null : Number(row.max_speed_mps),
		sportRaw: row.sport_raw,
		sportNormalized: row.sport_normalized,
		bbox: parseJsonColumn<Bbox>(row.bbox_json, "bbox_json"),
		polylineSimplified: parseJsonColumn<LatLng[]>(
			row.polyline_simplified_json,
			"polyline_simplified_json",
		),
		segments: parseJsonColumn<TrackSegment[]>(row.segments_json, "segments_json"),
		dataFlags: parseDataFlags(row.data_flags_json),
		hrAvg: row.hr_avg == null ? null : Number(row.hr_avg),
		hrMax: row.hr_max == null ? null : Number(row.hr_max),
		powerAvg: row.power_avg == null ? null : Number(row.power_avg),
		cadenceAvg: row.cadence_avg == null ? null : Number(row.cadence_avg),
	};
}

function stringifyJson(value: unknown): string | null {
	if (value == null) {
		return null;
	}
	return JSON.stringify(value);
}

/** Bind parameters for full `tracks` row insert/upsert (column order). */
export function trackRecordToRowParams(record: TrackRecord): SqlValue[] {
	assertTrackStatus(record.status);
	assertTimezoneSource(record.timezoneSource);

	return [
		record.path,
		record.mtimeMs,
		record.sha256,
		record.status,
		record.errorMessage,
		record.errorDetails,
		record.titleFromFile,
		record.startedAtUtc,
		record.endedAtUtc,
		record.startedAtRaw,
		record.endedAtRaw,
		record.timezoneSource,
		record.timezoneOffsetMin,
		record.durationSec,
		record.distanceM,
		record.elevationGainM,
		record.elevationLossM,
		record.avgSpeedMps,
		record.maxSpeedMps,
		record.sportRaw,
		record.sportNormalized,
		stringifyJson(record.bbox),
		stringifyJson(record.polylineSimplified),
		stringifyJson(record.segments),
		trackDataFlagsToJson(record.dataFlags),
		record.hrAvg,
		record.hrMax,
		record.powerAvg,
		record.cadenceAvg,
	];
}

export const TRACK_ROW_INSERT_COLUMNS = [
	"path",
	"mtime_ms",
	"sha256",
	"status",
	"error_message",
	"error_details",
	"title_from_file",
	"started_at_utc",
	"ended_at_utc",
	"started_at_raw",
	"ended_at_raw",
	"timezone_source",
	"timezone_offset_min",
	"duration_sec",
	"distance_m",
	"elevation_gain_m",
	"elevation_loss_m",
	"avg_speed_mps",
	"max_speed_mps",
	"sport_raw",
	"sport_normalized",
	"bbox_json",
	"polyline_simplified_json",
	"segments_json",
	"data_flags_json",
	"hr_avg",
	"hr_max",
	"power_avg",
	"cadence_avg",
] as const;

export const TRACK_ROW_SELECT_SQL = `SELECT ${TRACK_ROW_INSERT_COLUMNS.join(", ")}`;
