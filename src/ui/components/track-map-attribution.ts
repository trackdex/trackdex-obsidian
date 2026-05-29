import {t} from "../i18n";

const ATTRIBUTION_ROOT_CLASS = "trackdex-track-stub__attribution";
const ATTRIBUTION_TILES_CLASS = "trackdex-track-stub__attribution-tiles";
const ATTRIBUTION_LEGAL_CLASS = "trackdex-track-stub__attribution-legal";

function appendHtmlFragment(container: HTMLElement, html: string): void {
	const doc = new DOMParser().parseFromString(html, "text/html");
	for (const node of Array.from(doc.body.childNodes)) {
		container.appendChild(node);
	}
}

export interface TrackMapAttributionState {
	readonly showTileAttribution: boolean;
}

export interface TrackMapAttributionHandle {
	sync(state: TrackMapAttributionState): void;
	dispose(): void;
}

export interface RenderTrackMapAttributionOptions {
	readonly container: HTMLElement;
	readonly tileAttributionHtml: string;
	readonly onOpenSettings: () => void;
	readonly bindClick: (
		el: HTMLElement,
		handler: (ev: MouseEvent) => void,
	) => void;
}

export function renderTrackMapAttribution(
	options: RenderTrackMapAttributionOptions,
): TrackMapAttributionHandle {
	const {container, tileAttributionHtml, onOpenSettings, bindClick} = options;

	container.empty();
	container.addClass(ATTRIBUTION_ROOT_CLASS);

	const tilesEl = container.createDiv({cls: ATTRIBUTION_TILES_CLASS});
	appendHtmlFragment(tilesEl, tileAttributionHtml);

	const legalEl = container.createDiv({cls: ATTRIBUTION_LEGAL_CLASS});
	legalEl.createSpan({text: t("views.trackMapAttributionLegalBeforeLink")});
	const settingsLink = legalEl.createEl("a", {
		href: "#",
		text: t("views.trackMapAttributionLegalLink"),
	});
	legalEl.createSpan({text: t("views.trackMapAttributionLegalAfterLink")});

	bindClick(settingsLink, (ev) => {
		ev.preventDefault();
		onOpenSettings();
	});

	const sync = (state: TrackMapAttributionState): void => {
		tilesEl.toggleAttribute("hidden", !state.showTileAttribution);
	};

	return {
		sync,
		dispose() {
			container.empty();
			container.removeClass(ATTRIBUTION_ROOT_CLASS);
		},
	};
}
