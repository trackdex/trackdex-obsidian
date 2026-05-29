/**
 * Storage spike gate (0.1-03). Keep `false` in committed builds.
 * Production storage bootstrap uses sql.js via storage-adapter.ts (0.1-09).
 */
export const ENABLE_STORAGE_SPIKE = false;

/**
 * v1 schema smoke commands (0.2-11). Keep `false` in committed builds.
 * Uses production `index.sqlite` + `tracks` table via container repos.
 */
export const ENABLE_STORAGE_SCHEMA_SMOKE = false;

/** Default candidate for the dev spike command. */
export type StorageSpikeBackend = "sqljs" | "indexeddb";

export const DEFAULT_STORAGE_SPIKE_BACKEND: StorageSpikeBackend = "sqljs";
