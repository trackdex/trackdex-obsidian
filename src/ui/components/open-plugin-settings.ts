import type {App} from "obsidian";

interface ObsidianSettingApi {
	open(): Promise<void>;
	openTabById(id: string): void;
}

/** Opens this plugin's tab in Obsidian settings (runtime API is not in public types). */
export async function openPluginSettings(
	app: App,
	pluginId: string,
): Promise<void> {
	const setting = (app as App & {setting?: ObsidianSettingApi}).setting;
	if (!setting) {
		return;
	}
	await setting.open();
	setting.openTabById(pluginId);
}
