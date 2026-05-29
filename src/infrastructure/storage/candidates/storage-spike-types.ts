export const SPIKE_META_TABLE = "_spike_meta";
export const SPIKE_META_KEY = "spike";

export interface StorageSpikeResult {
	backend: string;
	mode: "write" | "verify";
	ok: boolean;
	persistencePath: string;
	markerValue: string | null;
	message: string;
}

export interface StorageSpikeAdapter {
	readonly backend: string;
	readonly persistencePath: string;
	open(): Promise<void>;
	runCrud(markerValue: string): Promise<void>;
	readMarker(): Promise<string | null>;
	persist(): Promise<void>;
	close(): Promise<void>;
}
