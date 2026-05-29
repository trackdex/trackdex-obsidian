/** Track file indexing lifecycle status (F-01g). */
export type TrackStatus =
	| "pending"
	| "indexing"
	| "indexed"
	| "stale"
	| "error";

export const TRACK_STATUSES: readonly TrackStatus[] = [
	"pending",
	"indexing",
	"indexed",
	"stale",
	"error",
] as const;
