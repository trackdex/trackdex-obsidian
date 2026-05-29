import {ItemView, WorkspaceLeaf} from "obsidian";
import type {TrackQueryService} from "../../application/services/track-query-service";
import {TRACKDEX_TRACKS_SIDEBAR_VIEW_TYPE} from "../../constants";
import {t} from "../i18n";

export class TracksSidebarView extends ItemView {
	private emptyStateEl: HTMLElement | null = null;

	constructor(
		leaf: WorkspaceLeaf,
		private readonly trackQuery: TrackQueryService,
	) {
		super(leaf);
	}

	getViewType(): string {
		return TRACKDEX_TRACKS_SIDEBAR_VIEW_TYPE;
	}

	getDisplayText(): string {
		return t("views.tracksSidebarTitle");
	}

	getIcon(): string {
		return "map";
	}

	async onOpen(): Promise<void> {
		const root = this.contentEl;
		root.empty();
		root.addClass("trackdex-tracks-sidebar");

		this.emptyStateEl = root.createDiv({
			cls: "trackdex-tracks-sidebar__empty",
			text: t("views.tracksSidebarEmpty"),
		});

		void this.refreshIndexedCount();
	}

	async onClose(): Promise<void> {
		this.emptyStateEl = null;
		this.contentEl.empty();
		await super.onClose();
	}

	private async refreshIndexedCount(): Promise<void> {
		if (!this.emptyStateEl) {
			return;
		}
		try {
			const tracks = await this.trackQuery.listTracks();
			if (tracks.length > 0) {
				this.emptyStateEl.setText(
					`${t("views.tracksSidebarEmpty")} (${tracks.length})`,
				);
			}
		} catch {
			// Keep default empty copy.
		}
	}
}
