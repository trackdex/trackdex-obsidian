import type { App, Plugin } from "obsidian";

export const INDEX_SQLITE_FILE = "index.sqlite";

export function getPluginDataDir(plugin: Plugin): string {
	return `${plugin.app.vault.configDir}/plugins/${plugin.manifest.id}`;
}

export function getIndexSqlitePath(plugin: Plugin): string {
	return `${getPluginDataDir(plugin)}/${INDEX_SQLITE_FILE}`;
}

export async function ensurePluginDataDir(plugin: Plugin): Promise<void> {
	const dir = getPluginDataDir(plugin);
	const adapter = plugin.app.vault.adapter;
	if (!(await adapter.exists(dir))) {
		await adapter.mkdir(dir);
	}
}

export async function readPluginBinary(
	app: App,
	absolutePath: string,
): Promise<Uint8Array | null> {
	const adapter = app.vault.adapter;
	if (!(await adapter.exists(absolutePath))) {
		return null;
	}
	const buffer = await adapter.readBinary(absolutePath);
	return new Uint8Array(buffer);
}

export async function writePluginBinary(
	app: App,
	absolutePath: string,
	data: Uint8Array,
): Promise<void> {
	await app.vault.adapter.writeBinary(absolutePath, data.buffer);
}
