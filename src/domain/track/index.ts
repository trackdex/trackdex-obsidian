export type {
	ParsedTrack,
	ParsedTrackPoint,
	TrackFileExtension,
} from "domain/track/parsed-track";
export { TRACK_FILE_EXTENSIONS } from "domain/track/parsed-track";
export {
	isFitTrackFileName,
	matchTrackFileExtensionFromName,
} from "domain/track/track-file-name";
export { normalizeTrackFileExtension } from "domain/track/track-file-extension";
export type { TrackDataFlags } from "domain/track/track-data-flags";
export type { NewTrackRecord, TrackPath, TrackRecord } from "domain/track/track-record";
export type { TrackSegment } from "domain/track/track-segment";
export type { TrackStatus } from "domain/track/track-status";
export { TRACK_STATUSES } from "domain/track/track-status";
export type {
	FileLifecycleEffect,
	FileStatus,
	FileStatusSignal,
	FileStatusTransition,
	VaultModifyInput,
	VaultModifyResolution,
	VaultRenameInput,
} from "domain/track/file-status";
export {
	FILE_STATUS_TRANSITIONS,
	canTransitionFileStatus,
	initialDiscoveredFileStatus,
	resolveVaultFileCreated,
	resolveVaultFileDeleted,
	resolveVaultFileModified,
	resolveVaultFileRenamed,
	transitionFileStatus,
} from "domain/track/file-status";
export type {
	SortOrder,
	TrackListQuery,
	TrackSortField,
} from "domain/track/track-query";
export type { TimezoneSource } from "domain/track/timezone-source";
export { TIMEZONE_SOURCES } from "domain/track/timezone-source";
export type {
	NormalizedTimestamp,
	NormalizedTrackTimes,
	TimeNormalizationContext,
} from "domain/track/time-normalization";
export {
	normalizeTimestamp,
	normalizeTrackTimes,
} from "domain/track/time-normalization";
export type { ComputedTrackMetrics } from "domain/track/track-metrics";
export {
	ELEVATION_GAIN_LOSS_THRESHOLD_M,
	computeTrackMetrics,
	haversineDistanceM,
} from "domain/track/track-metrics";
