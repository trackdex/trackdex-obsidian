import type { TrackPath } from "domain/track/track-record";

/** Vault-relative path to a markdown note. */
export type NotePath = string;

/** Wikilink relation from note to track (`note_track_links`). */
export interface NoteTrackLink {
	readonly notePath: NotePath;
	readonly trackPath: TrackPath;
	readonly linkText: string;
}
