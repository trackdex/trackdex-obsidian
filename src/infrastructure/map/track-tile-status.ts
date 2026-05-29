import type {TrackBasemap} from "./track-basemap";

const DEFAULT_TILE_ERROR_THRESHOLD = 5;

export interface TrackTileStatusMonitor {
	readonly tilesUnavailable: boolean;
	onChange(handler: (unavailable: boolean) => void): () => void;
	destroy(): void;
}

export interface TrackTileStatusOptions {
	tileErrorThreshold?: number;
}

/**
 * Tracks offline state and repeated tile load failures so the view can show
 * geometry-only mode with a persistent notice (REQ-005).
 */
export function createTrackTileStatusMonitor(
	basemap: TrackBasemap,
	options?: TrackTileStatusOptions,
): TrackTileStatusMonitor {
	const threshold = options?.tileErrorThreshold ?? DEFAULT_TILE_ERROR_THRESHOLD;
	let tileErrorCount = 0;
	let tilesUnavailable = !navigator.onLine;
	let destroyed = false;
	const handlers = new Set<(unavailable: boolean) => void>();

	const notify = (): void => {
		for (const handler of handlers) {
			handler(tilesUnavailable);
		}
	};

	const setUnavailable = (value: boolean): void => {
		if (tilesUnavailable === value) {
			return;
		}
		tilesUnavailable = value;
		notify();
	};

	const onTileError = (): void => {
		tileErrorCount++;
		if (tileErrorCount >= threshold) {
			setUnavailable(true);
		}
	};

	const onOnline = (): void => {
		tileErrorCount = 0;
		setUnavailable(false);
	};

	const onOffline = (): void => {
		setUnavailable(true);
	};

	basemap.tileLayer.on("tileerror", onTileError);
	window.addEventListener("online", onOnline);
	window.addEventListener("offline", onOffline);

	return {
		get tilesUnavailable() {
			return tilesUnavailable;
		},
		onChange(handler) {
			handlers.add(handler);
			return () => {
				handlers.delete(handler);
			};
		},
		destroy() {
			if (destroyed) {
				return;
			}
			destroyed = true;
			basemap.tileLayer.off("tileerror", onTileError);
			window.removeEventListener("online", onOnline);
			window.removeEventListener("offline", onOffline);
			handlers.clear();
		},
	};
}
