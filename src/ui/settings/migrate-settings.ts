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

/** Strips prototype keys from saved JSON; returns empty v1 settings. */
export function migrateSettings(
	raw: Record<string, unknown> | null,
): MigrateSettingsResult {
	const strippedLegacy =
		raw != null &&
		LEGACY_SETTING_KEYS.some((key) =>
			Object.prototype.hasOwnProperty.call(raw, key),
		);
	return {
		settings: Object.assign({}, DEFAULT_SETTINGS),
		strippedLegacy,
	};
}
