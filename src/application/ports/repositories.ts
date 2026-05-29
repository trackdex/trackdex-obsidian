import type { NoteTrackLink, NotePath } from "domain/links/note-track-link";
import type { PlaceNotePath, PlaceRecord } from "domain/place/place-record";
import type { TrackPlaceRelation } from "domain/place/track-place-relation";
import type { IndexMeta } from "domain/shared/index-meta";
import type { TrackListQuery } from "domain/track/track-query";
import type {
	NewTrackRecord,
	TrackPath,
	TrackRecord,
} from "domain/track/track-record";
import type { TrackStatus } from "domain/track/track-status";

/**
 * Track index persistence (`tracks`).
 * Full query implementation: milestone 0.2+; signatures stable for adapters.
 */
export interface TrackRepository {
	upsert(record: TrackRecord): Promise<void>;
	insertDiscovered(record: NewTrackRecord): Promise<void>;
	findByPath(path: TrackPath): Promise<TrackRecord | null>;
	deleteByPath(path: TrackPath): Promise<void>;
	updateStatus(
		path: TrackPath,
		status: TrackStatus,
		error?: { message: string; details?: string | null },
	): Promise<void>;
	/** Atomic path update on vault rename when supported by storage. */
	renamePath(oldPath: TrackPath, newPath: TrackPath, mtimeMs: number): Promise<void>;
	list(query?: TrackListQuery): Promise<TrackRecord[]>;
	listPathsByStatus(status: TrackStatus): Promise<TrackPath[]>;
	countByStatus?(status: TrackStatus): Promise<number>;
}

/**
 * Place notes and track↔place relations (`places`, `track_places`).
 */
export interface PlaceRepository {
	upsert(place: PlaceRecord): Promise<void>;
	findByNotePath(notePath: PlaceNotePath): Promise<PlaceRecord | null>;
	deleteByNotePath(notePath: PlaceNotePath): Promise<void>;
	listValid(): Promise<PlaceRecord[]>;
	upsertTrackPlace(relation: TrackPlaceRelation): Promise<void>;
	deleteTrackPlace(trackPath: TrackPath, placeNotePath: PlaceNotePath): Promise<void>;
	deleteTrackPlacesForTrack(trackPath: TrackPath): Promise<void>;
	deleteTrackPlacesForPlace(placeNotePath: PlaceNotePath): Promise<void>;
	listTrackPlacesForTrack(trackPath: TrackPath): Promise<TrackPlaceRelation[]>;
	listTrackPlacesForPlace(placeNotePath: PlaceNotePath): Promise<TrackPlaceRelation[]>;
}

/** Markdown wikilink index (`note_track_links`). */
export interface NoteLinkRepository {
	upsert(link: NoteTrackLink): Promise<void>;
	deleteLink(
		notePath: NotePath,
		trackPath: TrackPath,
		linkText: string,
	): Promise<void>;
	deleteByNotePath(notePath: NotePath): Promise<void>;
	deleteByTrackPath(trackPath: TrackPath): Promise<void>;
	listByNotePath(notePath: NotePath): Promise<NoteTrackLink[]>;
	listByTrackPath(trackPath: TrackPath): Promise<NoteTrackLink[]>;
}

/** Plugin index lifecycle metadata (`index_meta`). */
export interface IndexMetaRepository {
	get(): Promise<IndexMeta>;
	update(partial: Partial<IndexMeta>): Promise<void>;
	/** Atomically sets `firstScanApproved` when false; returns whether this call claimed approval. */
	tryApproveFirstScan(): Promise<boolean>;
}
