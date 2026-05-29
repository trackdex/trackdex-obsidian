import type {
	IndexMetaRepository,
	NoteLinkRepository,
	PlaceRepository,
	TrackRepository,
} from "application/ports/repositories";
import type { NotePath } from "domain/links/note-track-link";
import type { PlaceNotePath } from "domain/place/place-record";
import { DEFAULT_INDEX_META } from "domain/shared/index-meta";
import type { TrackListQuery } from "domain/track/track-query";
import type { NewTrackRecord, TrackPath } from "domain/track/track-record";
import type { TrackStatus } from "domain/track/track-status";

/** In-memory no-op track repository until full sql.js CRUD (0.2). */
export function createNoopTrackRepository(): TrackRepository {
	return {
		upsert: async () => {},
		insertDiscovered: async (_record: NewTrackRecord) => {},
		findByPath: async () => null,
		deleteByPath: async () => {},
		updateStatus: async () => {},
		renamePath: async () => {},
		list: async (_query?: TrackListQuery) => [],
		listPathsByStatus: async (_status: TrackStatus) => [],
	};
}

export function createNoopPlaceRepository(): PlaceRepository {
	return {
		upsert: async () => {},
		findByNotePath: async () => null,
		deleteByNotePath: async () => {},
		listValid: async () => [],
		upsertTrackPlace: async () => {},
		deleteTrackPlace: async () => {},
		deleteTrackPlacesForTrack: async () => {},
		deleteTrackPlacesForPlace: async () => {},
		listTrackPlacesForTrack: async (_trackPath: TrackPath) => [],
		listTrackPlacesForPlace: async (_placeNotePath: PlaceNotePath) => [],
	};
}

export function createNoopNoteLinkRepository(): NoteLinkRepository {
	return {
		upsert: async () => {},
		deleteLink: async () => {},
		deleteByNotePath: async () => {},
		deleteByTrackPath: async () => {},
		listByNotePath: async (_notePath: NotePath) => [],
		listByTrackPath: async (_trackPath: TrackPath) => [],
	};
}

export function createNoopIndexMetaRepository(): IndexMetaRepository {
	let meta = DEFAULT_INDEX_META;
	return {
		get: async () => meta,
		update: async (partial) => {
			meta = { ...meta, ...partial };
		},
		tryApproveFirstScan: async () => {
			if (meta.firstScanApproved) {
				return false;
			}
			meta = { ...meta, firstScanApproved: true };
			return true;
		},
	};
}
