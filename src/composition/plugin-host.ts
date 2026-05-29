import type { Plugin } from "obsidian";
import type { TrackdexSettings } from "../ui/settings/settings-types";

/** Plugin surface used by composition and UI (avoids importing `main.ts`). */
export interface TrackdexPluginHost extends Plugin {
	settings: TrackdexSettings;
	saveSettings(): Promise<void>;
}
