import type { PlaceNotePath } from "domain/place/place-record";
import type { TrackPath } from "domain/track/track-record";

/** Many-to-many track ↔ place association (`track_places`). */
export interface TrackPlaceRelation {
	readonly trackPath: TrackPath;
	readonly placeNotePath: PlaceNotePath;
	readonly lastVisitAtUtc: string | null;
}
