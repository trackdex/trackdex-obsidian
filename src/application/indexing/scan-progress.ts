import type { TrackPath } from "domain/track/track-record";

/** Files at or above this size show "processing large file" (REQ-001 / F-01f). */
export const LARGE_TRACK_FILE_BYTES = 10 * 1024 * 1024;

export type ScanProgressPhase = "idle" | "discovering" | "indexing";

export interface ScanProgressSnapshot {
	readonly phase: ScanProgressPhase;
	readonly active: boolean;
	readonly discoveredTotal: number;
	readonly indexTotal: number;
	readonly completedCount: number;
	readonly currentFilePath: TrackPath | null;
	readonly isProcessingLargeFile: boolean;
}

const IDLE_SNAPSHOT: ScanProgressSnapshot = {
	phase: "idle",
	active: false,
	discoveredTotal: 0,
	indexTotal: 0,
	completedCount: 0,
	currentFilePath: null,
	isProcessingLargeFile: false,
};

export interface ScanProgressListener {
	(snapshot: ScanProgressSnapshot): void;
}

export interface ScanProgressStore {
	getSnapshot(): ScanProgressSnapshot;
	subscribe(listener: ScanProgressListener): () => void;
}

export interface ScanProgressReporter {
	beginScan(): void;
	endScan(): void;
	setDiscoveredTotal(count: number): void;
	beginIndexing(total: number): void;
	beginFile(path: TrackPath, options?: { readonly sizeBytes?: number }): void;
	completeFile(path: TrackPath): void;
	reset(): void;
}

export type ScanProgress = ScanProgressStore & ScanProgressReporter;

export function isLargeTrackFile(sizeBytes: number | undefined): boolean {
	return sizeBytes !== undefined && sizeBytes >= LARGE_TRACK_FILE_BYTES;
}

/** Observable scan progress for UI layers (0.9-08); no DOM in application. */
export function createScanProgress(): ScanProgress {
	let snapshot = IDLE_SNAPSHOT;
	const listeners = new Set<ScanProgressListener>();
	const activeFiles = new Map<TrackPath, boolean>();

	const emit = (): void => {
		for (const listener of listeners) {
			listener(snapshot);
		}
	};

	const setSnapshot = (next: ScanProgressSnapshot): void => {
		snapshot = next;
		emit();
	};

	const resolveCurrentFile = (): Pick<
		ScanProgressSnapshot,
		"currentFilePath" | "isProcessingLargeFile"
	> => {
		const paths = [...activeFiles.keys()];
		if (paths.length === 0) {
			return { currentFilePath: null, isProcessingLargeFile: false };
		}
		const currentFilePath = paths[paths.length - 1]!;
		return {
			currentFilePath,
			isProcessingLargeFile: activeFiles.get(currentFilePath) ?? false,
		};
	};

	return {
		getSnapshot: () => snapshot,

		subscribe(listener) {
			listeners.add(listener);
			listener(snapshot);
			return () => listeners.delete(listener);
		},

		beginScan() {
			activeFiles.clear();
			setSnapshot({
				phase: "discovering",
				active: true,
				discoveredTotal: 0,
				indexTotal: 0,
				completedCount: 0,
				currentFilePath: null,
				isProcessingLargeFile: false,
			});
		},

		endScan() {
			activeFiles.clear();
			setSnapshot({ ...IDLE_SNAPSHOT });
		},

		setDiscoveredTotal(count) {
			setSnapshot({ ...snapshot, discoveredTotal: count });
		},

		beginIndexing(total) {
			setSnapshot({
				...snapshot,
				phase: "indexing",
				indexTotal: total,
				completedCount: 0,
				currentFilePath: null,
				isProcessingLargeFile: false,
			});
		},

		beginFile(path, options) {
			activeFiles.set(path, isLargeTrackFile(options?.sizeBytes));
			setSnapshot({ ...snapshot, ...resolveCurrentFile() });
		},

		completeFile(path) {
			activeFiles.delete(path);
			setSnapshot({
				...snapshot,
				completedCount: snapshot.completedCount + 1,
				...resolveCurrentFile(),
			});
		},

		reset() {
			activeFiles.clear();
			setSnapshot({ ...IDLE_SNAPSHOT });
		},
	};
}
