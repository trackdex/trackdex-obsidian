import {DEFAULT_SETTINGS, type TrackdexSettings} from "./settings-types";

const LEGACY_SETTING_KEYS = [
	"tracksFolder",
	"basemapTileUrl",
	"basemapStyleUrl",
] as const;

export type MigrateSettingsResult = {
	settings: TrackdexSettings;
	strippedLegacy: boolean;
};

function readScanExcludePatterns(
	raw: Record<string, unknown> | null,
): string[] {
	if (raw == null || !Array.isArray(raw.scanExcludePatterns)) {
		return [...DEFAULT_SETTINGS.scanExcludePatterns];
	}
	return raw.scanExcludePatterns.filter(
		(entry): entry is string => typeof entry === "string",
	);
}

/** Strips prototype keys from saved JSON; preserves known v1 settings fields. */
export function migrateSettings(
	raw: Record<string, unknown> | null,
): MigrateSettingsResult {
	const strippedLegacy =
		raw != null &&
		LEGACY_SETTING_KEYS.some((key) =>
			Object.prototype.hasOwnProperty.call(raw, key),
		);
	return {
		settings: {
			...DEFAULT_SETTINGS,
			scanExcludePatterns: readScanExcludePatterns(raw),
		},
		strippedLegacy,
	};
}
