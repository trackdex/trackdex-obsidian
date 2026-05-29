/**
 * Storage spike gate (0.1-03). Keep `false` in committed builds so production
 * Production storage bootstrap uses sql.js via storage-adapter.ts (0.1-09).
 */
export const ENABLE_STORAGE_SPIKE = false;

/** Default candidate for the dev spike command. */
export type StorageSpikeBackend = "sqljs" | "indexeddb";

export const DEFAULT_STORAGE_SPIKE_BACKEND: StorageSpikeBackend = "sqljs";
