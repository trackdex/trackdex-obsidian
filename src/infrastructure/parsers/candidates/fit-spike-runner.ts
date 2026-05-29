import { isFitTrackFileName } from "domain/track/track-file-name";
import { Notice, TFile, type Plugin } from "obsidian";
import { gunzipFit } from "./gunzip";
import { parseWithFitFileParser } from "./fit-file-parser-candidate";
import { parseWithGarminSdk } from "./garmin-sdk-candidate";
import type { FitSpikeParseResult } from "./fit-spike-types";
import { resolveFitFileForSpike } from "./resolve-fit-spike-file";
import {
	DEFAULT_FIT_PARSER_SPIKE_BACKEND,
	type FitParserSpikeBackend,
} from "./spike-config";

export interface RunFitParserSpikeOptions {
	readonly backend?: FitParserSpikeBackend;
	readonly vaultRelativePath?: string;
}

async function loadVaultFitBytes(
	plugin: Plugin,
	vaultRelativePath: string,
): Promise<{ label: string; bytes: Uint8Array }> {
	const abstract = plugin.app.vault.getAbstractFileByPath(vaultRelativePath);
	if (!(abstract instanceof TFile)) {
		throw new Error(`File not found: ${vaultRelativePath}`);
	}
	if (!isFitTrackFileName(abstract.name)) {
		throw new Error(`Not a FIT track file: ${vaultRelativePath}`);
	}
	const buf = await plugin.app.vault.readBinary(abstract);
	return { label: vaultRelativePath, bytes: new Uint8Array(buf) };
}

async function loadResolvedFitBytes(
	plugin: Plugin,
): Promise<{ label: string; bytes: Uint8Array }> {
	const file = await resolveFitFileForSpike(plugin.app);
	const buf = await plugin.app.vault.readBinary(file);
	return { label: file.path, bytes: new Uint8Array(buf) };
}

async function maybeGunzip(
	label: string,
	bytes: Uint8Array,
): Promise<{ label: string; bytes: Uint8Array }> {
	if (label.toLowerCase().endsWith(".fit.gz")) {
		const decompressed = await gunzipFit(bytes);
		return { label, bytes: decompressed };
	}
	return { label, bytes };
}

async function parseBytes(
	backend: FitParserSpikeBackend,
	label: string,
	bytes: Uint8Array,
): Promise<FitSpikeParseResult> {
	if (backend === "fit-file-parser") {
		return parseWithFitFileParser(label, bytes);
	}
	return parseWithGarminSdk(label, bytes);
}

export async function runFitParserSpike(
	plugin: Plugin,
	options: RunFitParserSpikeOptions = {},
): Promise<FitSpikeParseResult> {
	const backend = options.backend ?? DEFAULT_FIT_PARSER_SPIKE_BACKEND;
	let loaded = options.vaultRelativePath
		? await loadVaultFitBytes(plugin, options.vaultRelativePath)
		: await loadResolvedFitBytes(plugin);
	const { label, bytes } = await maybeGunzip(loaded.label, loaded.bytes);
	return parseBytes(backend, label, bytes);
}

export function showFitSpikeNotice(result: FitSpikeParseResult): void {
	const prefix = result.ok ? "Trackdex FIT spike" : "Trackdex FIT spike FAILED";
	new Notice(`${prefix} [${result.backend}]: ${result.message}`, result.ok ? 8000 : 0);
	console.debug("[trackdex fit spike]", result);
}
