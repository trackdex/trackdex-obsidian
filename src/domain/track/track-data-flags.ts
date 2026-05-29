/**
 * Extensible presence flags for indexed track fields.
 * Missing fields are not fabricated; UI reads flags explicitly (REQUIREMENTS F-01).
 */
export interface TrackDataFlags {
	readonly hasGeometry?: boolean;
	readonly hasTime?: boolean;
	readonly hasElevation?: boolean;
	readonly hasHr?: boolean;
	readonly hasPower?: boolean;
	readonly hasSport?: boolean;
	readonly hasCadence?: boolean;
	readonly hasFileMetrics?: boolean;
}
