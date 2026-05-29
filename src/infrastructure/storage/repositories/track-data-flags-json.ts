import type { TrackDataFlags } from "domain/track/track-data-flags";

function parseJsonObject(raw: string, label: string): TrackDataFlags {
	if (raw === "") {
		return {};
	}
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		throw new Error(`Trackdex storage: invalid ${label} JSON`);
	}
	if (parsed == null || typeof parsed !== "object" || Array.isArray(parsed)) {
		throw new Error(`Trackdex storage: invalid ${label}`);
	}
	return parsed as TrackDataFlags;
}

/** Map domain {@link TrackDataFlags} to the `data_flags_json` column value. */
export function trackDataFlagsToJson(flags: TrackDataFlags | undefined): string {
	return JSON.stringify(flags ?? {});
}

/** Parse `data_flags_json` column into domain {@link TrackDataFlags}. */
export function trackDataFlagsFromJson(raw: string): TrackDataFlags {
	return parseJsonObject(raw, "data_flags_json");
}
