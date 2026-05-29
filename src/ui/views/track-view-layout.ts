/** Desktop track view uses a row split at this width (px); mobile stacks below. */
export const TRACK_VIEW_DESKTOP_MIN_WIDTH_PX = 769;

export type MobileTab = "map" | "stats";

export const TRACK_VIEW_LAYOUT_CLASSES = {
	root: "trackdex-track-view",
	mobileTabs: "trackdex-track-view__mobile-tabs",
	mobileTab: "trackdex-track-view__mobile-tab",
	mobileTabActive: "trackdex-track-view__mobile-tab--active",
	layout: "trackdex-track-view__layout",
	layoutTabMap: "trackdex-track-view__layout--tab-map",
	layoutTabStats: "trackdex-track-view__layout--tab-stats",
	mapColumn: "trackdex-track-view__map-column",
	statsColumn: "trackdex-track-view__stats-column",
	statsPanelHost: "trackdex-track-view__stats-panel-host",
	mapWrap: "trackdex-track-stub__map-wrap",
	map: "trackdex-track-stub__map",
	mapError: "trackdex-track-stub__map-error",
	mapOfflineNotice: "trackdex-track-stub__map-offline-notice",
	mapAttribution: "trackdex-track-stub__attribution-host",
} as const;

export interface TrackViewLayoutElements {
	mobileTabsEl: HTMLElement;
	mapTabButton: HTMLButtonElement;
	statsTabButton: HTMLButtonElement;
	layoutEl: HTMLElement;
	mapColumnEl: HTMLElement;
	statsColumnEl: HTMLElement;
	statsPanelHostEl: HTMLElement;
	mapWrapEl: HTMLElement;
	mapContainerEl: HTMLElement;
	mapErrorEl: HTMLElement;
	mapOfflineNoticeEl: HTMLElement;
	mapAttributionHostEl: HTMLElement;
}

export interface TrackViewLayoutTabLabels {
	map: string;
	stats: string;
}

/** Builds map-left / stats-right DOM shell (stats content filled by the view). */
export function buildTrackViewLayout(
	contentEl: HTMLElement,
	activeMobileTab: MobileTab,
	tabLabels: TrackViewLayoutTabLabels,
): TrackViewLayoutElements {
	const c = TRACK_VIEW_LAYOUT_CLASSES;

	contentEl.empty();
	contentEl.addClass(c.root);

	const mobileTabsEl = contentEl.createDiv({
		cls: c.mobileTabs,
		attr: {role: "tablist"},
	});

	const mapTabButton = mobileTabsEl.createEl("button", {
		cls: c.mobileTab,
		type: "button",
		text: tabLabels.map,
	});
	mapTabButton.setAttribute("role", "tab");

	const statsTabButton = mobileTabsEl.createEl("button", {
		cls: c.mobileTab,
		type: "button",
		text: tabLabels.stats,
	});
	statsTabButton.setAttribute("role", "tab");

	const layoutEl = contentEl.createDiv({
		cls: `${c.layout} ${activeMobileTab === "map" ? c.layoutTabMap : c.layoutTabStats}`,
	});

	const mapColumnEl = layoutEl.createDiv({cls: c.mapColumn});
	const mapWrapEl = mapColumnEl.createDiv({cls: c.mapWrap});
	const mapContainerEl = mapWrapEl.createDiv({cls: c.map});
	const mapOfflineNoticeEl = mapWrapEl.createDiv({cls: c.mapOfflineNotice});
	mapOfflineNoticeEl.hide();
	const mapErrorEl = mapWrapEl.createDiv({cls: c.mapError});
	mapErrorEl.hide();
	const mapAttributionHostEl = mapColumnEl.createDiv({cls: c.mapAttribution});

	const statsColumnEl = layoutEl.createDiv({cls: c.statsColumn});
	const statsPanelHostEl = statsColumnEl.createDiv({cls: c.statsPanelHost});

	return {
		mobileTabsEl,
		mapTabButton,
		statsTabButton,
		layoutEl,
		mapColumnEl,
		statsColumnEl,
		statsPanelHostEl,
		mapWrapEl,
		mapContainerEl,
		mapErrorEl,
		mapOfflineNoticeEl,
		mapAttributionHostEl,
	};
}
