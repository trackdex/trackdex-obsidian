/** Desktop track view uses a row split at this width (px); mobile stacks below. */
export const TRACK_VIEW_DESKTOP_MIN_WIDTH_PX = 769;

export const TRACK_VIEW_LAYOUT_CLASSES = {
	root: "trackdex-track-view",
	layout: "trackdex-track-view__layout",
	mapColumn: "trackdex-track-view__map-column",
	statsColumn: "trackdex-track-view__stats-column",
	statsPlaceholder: "trackdex-track-view__stats-placeholder",
	mapWrap: "trackdex-track-stub__map-wrap",
	map: "trackdex-track-stub__map",
	mapError: "trackdex-track-stub__map-error",
} as const;

export interface TrackViewLayoutElements {
	layoutEl: HTMLElement;
	mapColumnEl: HTMLElement;
	statsColumnEl: HTMLElement;
	statsPlaceholderEl: HTMLElement;
	mapWrapEl: HTMLElement;
	mapContainerEl: HTMLElement;
	mapErrorEl: HTMLElement;
}

/** Builds map-left / stats-right DOM shell (stats content filled by the view). */
export function buildTrackViewLayout(
	contentEl: HTMLElement,
): TrackViewLayoutElements {
	const c = TRACK_VIEW_LAYOUT_CLASSES;

	contentEl.empty();
	contentEl.addClass(c.root);

	const layoutEl = contentEl.createDiv({cls: c.layout});

	const mapColumnEl = layoutEl.createDiv({cls: c.mapColumn});
	const mapWrapEl = mapColumnEl.createDiv({cls: c.mapWrap});
	const mapContainerEl = mapWrapEl.createDiv({cls: c.map});
	const mapErrorEl = mapWrapEl.createDiv({cls: c.mapError});
	mapErrorEl.hide();

	const statsColumnEl = layoutEl.createDiv({cls: c.statsColumn});
	const statsPlaceholderEl = statsColumnEl.createDiv({cls: c.statsPlaceholder});

	return {
		layoutEl,
		mapColumnEl,
		statsColumnEl,
		statsPlaceholderEl,
		mapWrapEl,
		mapContainerEl,
		mapErrorEl,
	};
}
