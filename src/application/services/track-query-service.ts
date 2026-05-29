import type { TrackRepository } from "application/ports/repositories";
import type { TrackListQuery } from "domain/track/track-query";
import type { TrackPath, TrackRecord } from "domain/track/track-record";

export interface TrackQueryService {
	listTracks(query?: TrackListQuery): Promise<TrackRecord[]>;
	findTrackByPath(path: TrackPath): Promise<TrackRecord | null>;
}

export function createTrackQueryService(tracks: TrackRepository): TrackQueryService {
	return {
		listTracks: (query) => tracks.list(query),
		findTrackByPath: (path) => tracks.findByPath(path),
	};
}
