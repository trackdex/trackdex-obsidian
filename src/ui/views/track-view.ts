import {debounce, TextFileView, type TFile, WorkspaceLeaf} from "obsidian";
import {DEFAULT_BASEMAP_TILE_URL, TRACKDEX_TRACK_VIEW_TYPE} from "../../constants";
import {
	createTrackBasemap,
	destroyTrackBasemap,
	getTrackMapViewState,
	refreshTrackBasemap,
	resizeTrackBasemap,
	type TrackBasemap,
	type TrackMapViewState,
} from "../../infrastructure/map/track-basemap";
import {
	addTrackRouteLayer,
	createTrackTileStatusMonitor,
	domainLatLngToLeaflet,
	type TrackRouteLayer,
	type TrackTileStatusMonitor,
} from "../../infrastructure/map";
import type {TrackQueryService} from "../../application/services/track-query-service";
import {parseGpxTrackPoints} from "../../infrastructure/parsers/gpx-parser";
import type {TrackdexPluginHost} from "../../composition/plugin-host";
import {t} from "../i18n";
import {getTrackFileExtension} from "./track-file-extension";
import {
	buildTrackViewLayout,
	TRACK_VIEW_LAYOUT_CLASSES,
	type MobileTab,
} from "./track-view-layout";
import {
	refreshViewNavButtons,
	syncViewHeaderTitle,
} from "../components/file-view-nav";
import {preserveSettingsFocus} from "../components/preserve-settings-focus";
import {
	renderTrackStatsPanel,
	type TrackStatsPanelHandle,
} from "../components/track-stats-panel";

export class TrackView extends TextFileView {
	private basemap: TrackBasemap | null = null;
	private routeLayer: TrackRouteLayer | null = null;
	private layoutEl: HTMLElement | null = null;
	private mobileTabsEl: HTMLElement | null = null;
	private mapTabButton: HTMLButtonElement | null = null;
	private statsTabButton: HTMLButtonElement | null = null;
	private activeMobileTab: MobileTab = "map";
	private statsColumnEl: HTMLElement | null = null;
	private statsPanelHostEl: HTMLElement | null = null;
	private statsPanel: TrackStatsPanelHandle | null = null;
	private mapColumnEl: HTMLElement | null = null;
	private mapContainerEl: HTMLElement | null = null;
	private mapWrapEl: HTMLElement | null = null;
	private mapErrorEl: HTMLElement | null = null;
	private mapOfflineNoticeEl: HTMLElement | null = null;
	private tileStatusMonitor: TrackTileStatusMonitor | null = null;
	private mapInitGeneration = 0;
	private isClosing = false;
	private closing: Promise<void> | null = null;
	private mapVisibilityObserver: IntersectionObserver | null = null;
	private mapWasVisible = false;
	private pendingMapView: TrackMapViewState | null = null;
	private renderedFilePath: string | null = null;
	private restoredMapViewFromHistory = false;
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
		private readonly plugin: TrackdexPluginHost,
		private readonly trackQuery: TrackQueryService,
	) {
		super(leaf);
		this.navigation = true;
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

	setViewData(data: string, clear: boolean): void {
		this.data = data;
		if (clear) {
			this.clear();
		}
		const filePath = this.file?.path ?? null;
		const isSameFileRender =
			filePath !== null &&
			filePath === this.renderedFilePath &&
			this.basemap &&
			this.mapContainerEl?.isConnected;
		if (!clear && isSameFileRender) {
			return;
		}
		this.isClosing = false;
		this.renderView();
	}

	clear(): void {
		this.onWindowResize.cancel();
		this.onMapRefresh.cancel();
		this.teardownMap();
		this.renderedFilePath = null;
		this.pendingMapView = null;
		this.restoredMapViewFromHistory = false;
		this.layoutEl = null;
		this.mobileTabsEl = null;
		this.mapTabButton = null;
		this.statsTabButton = null;
		this.mapColumnEl = null;
		this.statsColumnEl = null;
		this.statsPanelHostEl = null;
		this.disposeStatsPanel();
		this.contentEl.empty();
	}

	async onOpen(): Promise<void> {
		await super.onOpen();
		syncViewHeaderTitle(this);
		refreshViewNavButtons(this);

		this.isClosing = false;
		this.closing = null;
		this.registerDomEvent(window, "resize", this.onWindowResize);
		this.registerEvent(
			this.app.workspace.on("resize", () => {
				if (this.app.workspace.getActiveViewOfType(TrackView) === this) {
					this.scheduleMapRefresh(false);
				}
			}),
		);
		this.registerEvent(
			this.app.workspace.on("layout-change", () => {
				this.scheduleMapRefresh(false);
				refreshViewNavButtons(this);
			}),
		);
		this.registerEvent(
			this.app.workspace.on("active-leaf-change", (leaf) => {
				if (leaf === this.leaf) {
					void this.leaf.loadIfDeferred().then(() => {
						this.scheduleMapRefresh(true);
						refreshViewNavButtons(this);
					});
				}
			}),
		);
		this.registerEvent(
			this.app.workspace.on("file-open", () => {
				refreshViewNavButtons(this);
			}),
		);
		this.refreshStatsPanel();
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
		this.contentEl.empty();
		await super.onClose();
	}

	async onLoadFile(file: TFile): Promise<void> {
		await super.onLoadFile(file);
		syncViewHeaderTitle(this);
		refreshViewNavButtons(this);
	}

	async onUnloadFile(_file: TFile): Promise<void> {
		this.onWindowResize.cancel();
		this.onMapRefresh.cancel();
		this.teardownMap();
		this.renderedFilePath = null;
	}

	async save(_clear?: boolean): Promise<void> {
		// Read-only GPX preview; never write file contents back.
	}

	getEphemeralState(): Record<string, unknown> {
		const state = super.getEphemeralState();
		const mapView = this.getCurrentMapViewState(state);
		if (mapView) {
			state.mapCenter = mapView.mapCenter;
			state.mapZoom = mapView.mapZoom;
		}
		return state;
	}

	setEphemeralState(state: unknown): void {
		super.setEphemeralState(state);
		const mapState = this.readMapViewState(state);
		this.pendingMapView = mapState;
		this.restoredMapViewFromHistory = mapState !== null;
		if (this.basemap && mapState) {
			this.applyMapViewState(mapState);
		}
	}

	private getCurrentMapViewState(
		fallbackState?: unknown,
	): TrackMapViewState | null {
		if (this.basemap) {
			return getTrackMapViewState(this.basemap);
		}
		if (this.pendingMapView) {
			return this.pendingMapView;
		}
		if (fallbackState !== undefined) {
			return this.readMapViewState(fallbackState);
		}
		return null;
	}

	private readMapViewState(state: unknown): TrackMapViewState | null {
		if (!state || typeof state !== "object") {
			return null;
		}
		const record = state as Record<string, unknown>;
		const center = record.mapCenter;
		const zoom = record.mapZoom;
		if (
			!center ||
			typeof center !== "object" ||
			typeof (center as {lat?: unknown}).lat !== "number" ||
			typeof (center as {lng?: unknown}).lng !== "number" ||
			typeof zoom !== "number"
		) {
			return null;
		}
		return {
			mapCenter: {
				lat: (center as {lat: number}).lat,
				lng: (center as {lng: number}).lng,
			},
			mapZoom: zoom,
		};
	}

	private applyMapViewState(state: TrackMapViewState): void {
		if (!this.basemap) {
			return;
		}
		this.basemap.map.setView(
			[state.mapCenter.lat, state.mapCenter.lng],
			state.mapZoom,
			{animate: false},
		);
	}

	private syncPendingMapViewForFile(): void {
		const filePath = this.file?.path ?? null;
		if (filePath === null || filePath === this.renderedFilePath) {
			return;
		}
		if (!this.restoredMapViewFromHistory) {
			this.pendingMapView = null;
		}
		this.restoredMapViewFromHistory = false;
	}

	private renderView(): void {
		if (this.isClosing) {
			return;
		}
		this.syncPendingMapViewForFile();
		this.teardownMap();

		this.renderedFilePath = this.file?.path ?? null;

		const built = buildTrackViewLayout(this.contentEl, this.activeMobileTab, {
			map: t("views.trackMobileTabMap"),
			stats: t("views.trackMobileTabStats"),
		});
		this.mobileTabsEl = built.mobileTabsEl;
		this.mapTabButton = built.mapTabButton;
		this.statsTabButton = built.statsTabButton;
		this.layoutEl = built.layoutEl;
		this.mapColumnEl = built.mapColumnEl;
		this.statsColumnEl = built.statsColumnEl;
		this.statsPanelHostEl = built.statsPanelHostEl;
		this.mapWrapEl = built.mapWrapEl;
		this.mapContainerEl = built.mapContainerEl;
		this.mapErrorEl = built.mapErrorEl;
		this.mapOfflineNoticeEl = built.mapOfflineNoticeEl;

		this.registerDomEvent(this.mapTabButton, "click", () =>
			this.setMobileTab("map"),
		);
		this.registerDomEvent(this.statsTabButton, "click", () =>
			this.setMobileTab("stats"),
		);
		this.syncMobileTabUi();
		this.refreshStatsPanel();

		const trackExt = this.file ? getTrackFileExtension(this.file) : null;
		if (trackExt !== "gpx") {
			this.showMapError(t("views.trackPreviewComingSoon"), true);
			return;
		}

		const generation = ++this.mapInitGeneration;
		const tileUrl = DEFAULT_BASEMAP_TILE_URL;

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

	private setMobileTab(tab: MobileTab): void {
		if (this.activeMobileTab === tab) {
			return;
		}
		this.activeMobileTab = tab;
		this.syncMobileTabUi();
		if (tab === "map" && this.basemap) {
			this.scheduleMapResize();
			this.scheduleMapRefresh(true);
		}
	}

	private syncMobileTabUi(): void {
		const tab = this.activeMobileTab;
		const c = TRACK_VIEW_LAYOUT_CLASSES;
		this.layoutEl?.toggleClass(c.layoutTabMap, tab === "map");
		this.layoutEl?.toggleClass(c.layoutTabStats, tab === "stats");
		this.mapTabButton?.toggleClass(c.mobileTabActive, tab === "map");
		this.mapTabButton?.setAttribute(
			"aria-selected",
			tab === "map" ? "true" : "false",
		);
		this.statsTabButton?.toggleClass(c.mobileTabActive, tab === "stats");
		this.statsTabButton?.setAttribute(
			"aria-selected",
			tab === "stats" ? "true" : "false",
		);
	}

	private disposeStatsPanel(): void {
		this.statsPanel?.dispose();
		this.statsPanel = null;
	}

	private refreshStatsPanel(): void {
		if (!this.statsPanelHostEl || this.isClosing) {
			return;
		}
		this.disposeStatsPanel();
		this.statsPanel = renderTrackStatsPanel({
			container: this.statsPanelHostEl,
			trackQuery: this.trackQuery,
			filePath: this.file?.path ?? null,
		});
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
				this.pendingMapView ?? undefined,
			);
			this.tileStatusMonitor = createTrackTileStatusMonitor(this.basemap);
			this.register(() => {
				this.tileStatusMonitor?.destroy();
				this.tileStatusMonitor = null;
			});
			this.tileStatusMonitor.onChange((unavailable) => {
				this.syncMapOfflineNotice(unavailable);
			});
			this.syncMapOfflineNotice(this.tileStatusMonitor.tilesUnavailable);
			this.basemap.map.whenReady(() => {
				if (this.isClosing || !this.basemap) {
					return;
				}
				this.mapErrorEl?.hide();
				this.renderTrackRoute();
				this.scheduleMapResize();
				this.scheduleMapRefresh(false);
				refreshViewNavButtons(this);
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

	private showMapError(message: string, blocking = true): void {
		if (!this.mapErrorEl) {
			return;
		}
		this.mapErrorEl.setText(message);
		this.mapErrorEl.toggleClass(
			"trackdex-track-stub__map-error--blocking",
			blocking,
		);
		this.mapErrorEl.show();
	}

	private syncMapOfflineNotice(unavailable: boolean): void {
		if (!this.mapOfflineNoticeEl || this.isClosing) {
			return;
		}
		if (unavailable) {
			this.mapOfflineNoticeEl.setText(t("views.trackMapTilesOffline"));
			this.mapOfflineNoticeEl.show();
			return;
		}
		this.mapOfflineNoticeEl.hide();
	}

	private renderTrackRoute(): void {
		void this.loadAndRenderTrackRoute();
	}

	private async loadAndRenderTrackRoute(): Promise<void> {
		this.clearRouteLayer();
		if (
			!this.basemap ||
			!this.file ||
			getTrackFileExtension(this.file) !== "gpx"
		) {
			return;
		}

		const fitBounds = this.pendingMapView === null;
		const filePath = this.file.path;
		const generation = this.mapInitGeneration;

		try {
			const indexed = await this.trackQuery.findTrackByPath(filePath);
			if (
				this.isClosing ||
				generation !== this.mapInitGeneration ||
				!this.basemap ||
				this.file?.path !== filePath
			) {
				return;
			}

			if (
				indexed?.polylineSimplified &&
				indexed.polylineSimplified.length > 0
			) {
				const latlngs = domainLatLngToLeaflet(indexed.polylineSimplified);
				this.routeLayer = addTrackRouteLayer(this.basemap, latlngs, {
					fitBounds,
					bbox: indexed.bbox,
				});
				return;
			}
		} catch (error) {
			console.warn("Trackdex index lookup:", error);
		}

		if (
			this.isClosing ||
			generation !== this.mapInitGeneration ||
			!this.basemap ||
			this.file?.path !== filePath
		) {
			return;
		}

		const parsed = parseGpxTrackPoints(this.data);
		if (parsed.ok) {
			this.routeLayer = addTrackRouteLayer(this.basemap, parsed.points, {
				fitBounds,
			});
			return;
		}

		console.warn("Trackdex GPX parse:", parsed.message);
		this.showMapError(t("views.trackMapNoGeometry"), false);
	}

	private clearRouteLayer(): void {
		this.routeLayer?.remove();
		this.routeLayer = null;
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
		this.tileStatusMonitor?.destroy();
		this.tileStatusMonitor = null;
		this.onMapRefresh.cancel();
		this.detachMapVisibilityObserver();
		this.mapWasVisible = false;
		this.clearRouteLayer();
		const basemap = this.basemap;
		this.basemap = null;
		destroyTrackBasemap(basemap);
		this.mapContainerEl = null;
		this.mapWrapEl = null;
		this.mapErrorEl = null;
		this.mapOfflineNoticeEl = null;
		this.layoutEl = null;
		this.mobileTabsEl = null;
		this.mapTabButton = null;
		this.statsTabButton = null;
		this.mapColumnEl = null;
		this.statsColumnEl = null;
		this.statsPanelHostEl = null;
		this.disposeStatsPanel();
	}
}
