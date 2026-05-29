import {App, PluginSettingTab, Setting} from "obsidian";
import {DEFAULT_BASEMAP_TILE_URL} from "../../constants";
import {normalizeBasemapTileUrl} from "../../infrastructure/map/track-basemap";
import type {TrackdexPluginHost} from "../../composition/plugin-host";

export interface TrackdexSettings {
	tracksFolder: string;
	/** Legacy key; migrated to basemapTileUrl on load. */
	basemapStyleUrl?: string;
	basemapTileUrl: string;
}

export const DEFAULT_SETTINGS: TrackdexSettings = {
	tracksFolder: "tracks",
	basemapTileUrl: DEFAULT_BASEMAP_TILE_URL,
};

export function migrateSettings(
	raw: Partial<TrackdexSettings> | null,
): TrackdexSettings {
	const merged = Object.assign({}, DEFAULT_SETTINGS, raw);
	merged.basemapTileUrl = normalizeBasemapTileUrl(
		raw?.basemapTileUrl ?? raw?.basemapStyleUrl,
	);
	return merged;
}

export class TrackdexSettingTab extends PluginSettingTab {
	plugin: TrackdexPluginHost;

	constructor(app: App, plugin: TrackdexPluginHost) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName("Tracks folder")
			.setDesc("Folder with GPX files inside your vault")
			.addText(text => text
				.setPlaceholder(DEFAULT_SETTINGS.tracksFolder)
				.setValue(this.plugin.settings.tracksFolder)
				.onChange(async (value) => {
					this.plugin.settings.tracksFolder = value.trim() || "tracks";
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName("Basemap tile URL")
			.setDesc(
				"Raster tile template with {z}, {x}, {y} (default: OpenStreetMap). " +
				"MapLibre/OpenFreeMap style URLs are not supported in Obsidian.",
			)
			.addText(text => text
				.setPlaceholder(DEFAULT_BASEMAP_TILE_URL)
				.setValue(this.plugin.settings.basemapTileUrl)
				.onChange(async (value) => {
					this.plugin.settings.basemapTileUrl =
						normalizeBasemapTileUrl(value);
					await this.plugin.saveSettings();
				}));
	}
}
