import {ItemView, WorkspaceLeaf} from "obsidian";
import type {IndexingService} from "../../application/services/indexing-service";
import type {IndexMetaRepository} from "../../application/ports/repositories";
import type {TrackQueryService} from "../../application/services/track-query-service";
import {TRACKDEX_TRACKS_SIDEBAR_VIEW_TYPE} from "../../constants";
import {
	renderFirstScanEmptyState,
	type FirstScanEmptyStateHandle,
} from "../components/empty-state-first-scan";
import {
	renderInterruptedRunBanner,
	type InterruptedRunBannerHandle,
} from "../components/interrupted-run-banner";
import {t} from "../i18n";

export interface TracksSidebarDeps {
	readonly trackQuery: TrackQueryService;
	readonly indexMeta: IndexMetaRepository;
	readonly indexing: IndexingService;
}

export class TracksSidebarView extends ItemView {
	private catalogEmptyEl: HTMLElement | null = null;
	private firstScanState: FirstScanEmptyStateHandle | null = null;
	private interruptedBanner: InterruptedRunBannerHandle | null = null;

	constructor(
		leaf: WorkspaceLeaf,
		private readonly deps: TracksSidebarDeps,
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
		await this.renderBody();
	}

	async onClose(): Promise<void> {
		this.disposeFirstScanState();
		this.disposeInterruptedBanner();
		this.catalogEmptyEl = null;
		this.contentEl.empty();
		await super.onClose();
	}

	private disposeFirstScanState(): void {
		this.firstScanState?.dispose();
		this.firstScanState = null;
	}

	private disposeInterruptedBanner(): void {
		this.interruptedBanner?.dispose();
		this.interruptedBanner = null;
	}

	private async renderBody(): Promise<void> {
		const root = this.contentEl;
		root.empty();
		root.addClass("trackdex-tracks-sidebar");
		this.disposeFirstScanState();
		this.disposeInterruptedBanner();
		this.catalogEmptyEl = null;

		const meta = await this.deps.indexMeta.get();
		if (!meta.firstScanApproved) {
			this.firstScanState = renderFirstScanEmptyState({
				container: root,
				onApprove: () => this.handleApproveFirstScan(),
			});
			return;
		}

		if (
			meta.lastRunInterrupted &&
			!this.deps.indexing.scanProgress.getSnapshot().active
		) {
			this.interruptedBanner = renderInterruptedRunBanner({
				container: root,
				onResume: () => this.handleResumeAfterInterrupt(),
			});
		}

		this.catalogEmptyEl = root.createDiv({
			cls: "trackdex-tracks-sidebar__empty",
			text: t("views.tracksSidebarEmpty"),
		});
		void this.refreshIndexedCount();
	}

	private async handleApproveFirstScan(): Promise<void> {
		await this.deps.indexing.approveFirstScan();
		await this.renderBody();
	}

	private async handleResumeAfterInterrupt(): Promise<void> {
		await this.deps.indexing.resumeAfterInterrupt();
		await this.renderBody();
	}

	private async refreshIndexedCount(): Promise<void> {
		if (!this.catalogEmptyEl) {
			return;
		}
		try {
			const tracks = await this.deps.trackQuery.listTracks();
			if (tracks.length > 0) {
				this.catalogEmptyEl.setText(
					`${t("views.tracksSidebarEmpty")} (${tracks.length})`,
				);
			}
		} catch {
			// Keep default empty copy.
		}
	}
}
