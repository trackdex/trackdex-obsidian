/** Plugin index lifecycle metadata (`index_meta` logical row). */
export interface IndexMeta {
	readonly schemaVersion: number;
	readonly firstScanApproved: boolean;
	readonly scanPaused: boolean;
	readonly lastFullScanAtUtc: string | null;
	readonly lastRunInterrupted: boolean;
}

export const DEFAULT_INDEX_META: IndexMeta = {
	schemaVersion: 0,
	firstScanApproved: false,
	scanPaused: false,
	lastFullScanAtUtc: null,
	lastRunInterrupted: false,
};
