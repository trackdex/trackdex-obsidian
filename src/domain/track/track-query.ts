import type { TrackStatus } from "domain/track/track-status";

export type TrackSortField = "started_at" | "distance" | "duration";

export type SortOrder = "asc" | "desc";

/** Read-model filter for sidebar catalog and track lists (§12.1). */
export interface TrackListQuery {
	readonly statuses?: readonly TrackStatus[];
	readonly sportNormalized?: string;
	/** Restrict to tracks linked to this place note path. */
	readonly placeNotePath?: string;
	readonly startedAfterUtc?: string;
	readonly startedBeforeUtc?: string;
	readonly errorsOnly?: boolean;
	readonly sortBy?: TrackSortField;
	readonly sortOrder?: SortOrder;
	readonly limit?: number;
	readonly offset?: number;
}
