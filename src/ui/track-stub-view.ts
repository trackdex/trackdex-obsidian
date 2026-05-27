import {debounce, Notice, TextFileView, type TFile, WorkspaceLeaf} from "obsidian";
import {DEFAULT_BASEMAP_TILE_URL, TRACKDEX_TRACK_VIEW_TYPE} from "../constants";
import {
	createTrackBasemap,
	destroyTrackBasemap,
	refreshTrackBasemap,
	resizeTrackBasemap,
	type TrackBasemap,
} from "../map/track-basemap";
import type MyPlugin from "../main";
import {preserveSettingsFocus} from "../utils/preserve-settings-focus";

export class TrackStubView extends TextFileView {
	private basemap: TrackBasemap | null = null;
	private mapContainerEl: HTMLElement | null = null;
	private mapWrapEl: HTMLElement | null = null;
	private mapErrorEl: HTMLElement | null = null;
	private mapInitGeneration = 0;
	private tileErrorCount = 0;
	private tileErrorNoticeShown = false;
	private isClosing = false;
	private closing: Promise<void> | null = null;
	private mapVisibilityObserver: IntersectionObserver | null = null;
	private mapWasVisible = false;
	private headerEl: HTMLElement | null = null;
	private pathEl: HTMLElement | null = null;
	private readonly onWindowResize = debounce(
		() => {
			if (this.isClosing || !this.basemap) {
				return;
			}
			resizeTrackBasemap(this.basemap);
		},
		150,
		true,
	);
	private mapRefreshRedraw = false;
	private readonly onMapRefresh = debounce(
		() => {
			if (this.isClosing || !this.basemap) {
				return;
			}
			refreshTrackBasemap(this.basemap, {redraw: this.mapRefreshRedraw});
		},
		150,
		true,
	);

	private scheduleMapRefresh(redraw = false): void {
		this.mapRefreshRedraw = redraw;
		this.onMapRefresh();
	}

	constructor(
		leaf: WorkspaceLeaf,
		private readonly plugin: MyPlugin,
	) {
		super(leaf);
	}

	getViewType(): string {
		return TRACKDEX_TRACK_VIEW_TYPE;
	}

	getDisplayText(): string {
		return this.file?.basename ?? "Track";
	}

	getViewData(): string {
		return this.data;
	}

	setViewData(data: string, _clear: boolean): void {
		this.data = data;
		if (this.basemap && this.mapContainerEl?.isConnected) {
			this.updateTrackLabels();
			return;
		}
		this.renderView();
	}

	clear(): void {
		this.isClosing = true;
		this.onWindowResize.cancel();
		this.onMapRefresh.cancel();
		this.teardownMap();
		this.containerEl.empty();
	}

	async onOpen(): Promise<void> {
		this.isClosing = false;
		this.closing = null;
		this.registerDomEvent(window, "resize", this.onWindowResize);
		this.registerEvent(
			this.app.workspace.on("resize", () => {
				if (this.leaf === this.app.workspace.activeLeaf) {
					this.scheduleMapRefresh(false);
				}
			}),
		);
		this.registerEvent(
			this.app.workspace.on("layout-change", () => {
				this.scheduleMapRefresh(false);
			}),
		);
		this.registerEvent(
			this.app.workspace.on("active-leaf-change", (leaf) => {
				if (leaf === this.leaf) {
					void this.leaf.loadIfDeferred().then(() => {
						this.scheduleMapRefresh(true);
					});
				}
			}),
		);
	}

	async onClose(): Promise<void> {
		if (this.closing) {
			return this.closing;
		}
		this.closing = this.closeView();
		return this.closing;
	}

	private async closeView(): Promise<void> {
		preserveSettingsFocus(this.app, this.leaf);
		this.isClosing = true;
		this.onWindowResize.cancel();
		this.onMapRefresh.cancel();
		this.teardownMap();
		await super.onClose();
	}

	async onUnloadFile(_file: TFile): Promise<void> {
		this.isClosing = true;
		this.onWindowResize.cancel();
		this.onMapRefresh.cancel();
		this.teardownMap();
	}

	async save(_clear?: boolean): Promise<void> {
		// Read-only GPX preview; never write file contents back.
	}

	private renderView(): void {
		if (this.isClosing) {
			return;
		}
		this.teardownMap();

		const el = this.containerEl;
		el.empty();
		el.addClass("trackdex-track-stub");
		this.headerEl = el.createEl("h2", {text: this.file?.name ?? "GPX track"});
		if (this.file?.path) {
			this.pathEl = el.createEl("p", {
				cls: "trackdex-track-stub__path",
				text: this.file.path,
			});
		} else {
			this.pathEl = null;
		}

		const mapWrap = el.createDiv({cls: "trackdex-track-stub__map-wrap"});
		this.mapWrapEl = mapWrap;
		this.mapContainerEl = mapWrap.createDiv({cls: "trackdex-track-stub__map"});
		this.mapErrorEl = mapWrap.createDiv({
			cls: "trackdex-track-stub__map-error",
		});
		this.mapErrorEl.hide();

		const generation = ++this.mapInitGeneration;
		const tileUrl = this.getBasemapTileUrl();

		requestAnimationFrame(() => {
			if (
				this.isClosing ||
				generation !== this.mapInitGeneration ||
				!this.mapContainerEl?.isConnected
			) {
				return;
			}
			this.initMap(tileUrl);
		});
	}

	private getBasemapTileUrl(): string {
		try {
			return this.plugin.settings.basemapTileUrl;
		} catch {
			return DEFAULT_BASEMAP_TILE_URL;
		}
	}

	private initMap(tileUrl: string): void {
		if (this.isClosing || !this.mapContainerEl?.isConnected) {
			return;
		}
		const mapContainer = this.mapContainerEl;
		const mapWrap = this.mapWrapEl;
		if (!mapContainer) {
			return;
		}
		try {
			const scrollTargets = mapWrap ? [mapWrap] : [];
			this.basemap = createTrackBasemap(
				mapContainer,
				tileUrl,
				scrollTargets,
			);
			this.basemap.tileLayer.on("tileerror", () => {
				if (this.isClosing || !this.basemap) {
					return;
				}
				this.tileErrorCount++;
				if (!this.tileErrorNoticeShown && this.tileErrorCount >= 5) {
					this.tileErrorNoticeShown = true;
					new Notice(
						"Some map tiles failed to load. Check your network or basemap URL in Trackdex settings.",
					);
				}
			});
			this.basemap.map.whenReady(() => {
				if (this.isClosing || !this.basemap) {
					return;
				}
				this.mapErrorEl?.hide();
				this.scheduleMapResize();
				this.scheduleMapRefresh(false);
			});
			this.attachMapVisibilityObserver(mapContainer);
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Map failed to initialize.";
			this.showMapError(message);
		}
	}

	private scheduleMapResize(): void {
		const basemap = this.basemap;
		if (!basemap) {
			return;
		}
		requestAnimationFrame(() => {
			if (this.isClosing || this.basemap !== basemap) {
				return;
			}
			resizeTrackBasemap(basemap);
		});
	}

	private showMapError(message: string): void {
		if (!this.mapErrorEl) {
			return;
		}
		this.mapErrorEl.setText(message);
		this.mapErrorEl.addClass("trackdex-track-stub__map-error--blocking");
		this.mapErrorEl.show();
	}

	private updateTrackLabels(): void {
		if (this.headerEl) {
			this.headerEl.setText(this.file?.name ?? "GPX track");
		}
		if (this.pathEl) {
			if (this.file?.path) {
				this.pathEl.setText(this.file.path);
				this.pathEl.show();
			} else {
				this.pathEl.hide();
			}
		}
	}

	private attachMapVisibilityObserver(mapContainer: HTMLElement): void {
		this.detachMapVisibilityObserver();
		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					const visible =
						entry.isIntersecting && entry.intersectionRatio > 0;
					if (visible && !this.mapWasVisible) {
						this.scheduleMapRefresh(true);
					}
					this.mapWasVisible = visible;
					break;
				}
			},
			{threshold: [0, 0.01]},
		);
		observer.observe(mapContainer);
		this.mapVisibilityObserver = observer;
	}

	private detachMapVisibilityObserver(): void {
		this.mapVisibilityObserver?.disconnect();
		this.mapVisibilityObserver = null;
	}

	private teardownMap(): void {
		this.mapInitGeneration++;
		this.tileErrorCount = 0;
		this.tileErrorNoticeShown = false;
		this.onMapRefresh.cancel();
		this.detachMapVisibilityObserver();
		this.mapWasVisible = false;
		const basemap = this.basemap;
		this.basemap = null;
		destroyTrackBasemap(basemap);
		this.mapContainerEl = null;
		this.mapWrapEl = null;
		this.mapErrorEl = null;
		this.headerEl = null;
		this.pathEl = null;
	}
}

