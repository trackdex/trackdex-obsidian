import {debounce, TextFileView, type TFile, WorkspaceLeaf} from "obsidian";
import {DEFAULT_BASEMAP_TILE_URL, TRACKDEX_TRACK_VIEW_TYPE} from "../constants";
import {
	createTrackBasemap,
	destroyTrackBasemap,
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
	private isClosing = false;
	private closing: Promise<void> | null = null;
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
		this.renderView();
	}

	clear(): void {
		this.isClosing = true;
		this.onWindowResize.cancel();
		this.teardownMap();
		this.containerEl.empty();
	}

	async onOpen(): Promise<void> {
		this.isClosing = false;
		this.closing = null;
		this.registerDomEvent(window, "resize", this.onWindowResize);
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
		this.teardownMap();
		await super.onClose();
	}

	async onUnloadFile(_file: TFile): Promise<void> {
		this.isClosing = true;
		this.onWindowResize.cancel();
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
		el.createEl("h2", {text: this.file?.name ?? "GPX track"});
		if (this.file?.path) {
			el.createEl("p", {
				cls: "trackdex-track-stub__path",
				text: this.file.path,
			});
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
				this.showMapError(
					"Map tiles failed to load. Check your network or basemap URL in settings.",
				);
			});
			this.basemap.map.whenReady(() => {
				if (this.isClosing || !this.basemap) {
					return;
				}
				this.mapErrorEl?.hide();
				this.scheduleMapResize();
			});
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
		this.mapErrorEl.show();
	}

	private teardownMap(): void {
		this.mapInitGeneration++;
		const basemap = this.basemap;
		this.basemap = null;
		destroyTrackBasemap(basemap);
		this.mapContainerEl = null;
		this.mapWrapEl = null;
		this.mapErrorEl = null;
	}
}
