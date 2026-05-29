import { createTimeNormalizationContext } from "application/indexing/time-context";
import { buildIndexedTrackRecord } from "application/indexing/track-record-builder";
import type { ClockPort } from "application/ports/clock-port";
import type { LoggerPort } from "application/ports/logger-port";
import type { TrackParserPort } from "application/ports/parser-port";
import type { TrackRepository } from "application/ports/repositories";
import type { VaultTrackFilePort } from "application/ports/vault-track-file-port";
import type { DomainError } from "domain/shared/errors";
import { domainError } from "domain/shared/errors";
import { aggregateParsedTrackForCatalog } from "domain/track/segment-aggregation";
import { transitionFileStatus } from "domain/track/file-status";
import type { TrackPath } from "domain/track/track-record";
import type { TrackStatus } from "domain/track/track-status";
import type { IndexTrackFileJob } from "./full-scan";

export interface IndexTrackFileDeps {
	readonly tracks: TrackRepository;
	readonly trackParser: TrackParserPort;
	readonly vaultTrackFile: VaultTrackFilePort;
	readonly clock: ClockPort;
	readonly logger?: LoggerPort;
}

function formatErrorDetails(error: DomainError): string | null {
	const parts = [`code=${error.code}`];
	if (error.cause instanceof Error) {
		parts.push(error.cause.message);
	} else if (typeof error.cause === "string") {
		parts.push(error.cause);
	}
	return parts.join("\n");
}

async function markIndexing(
	tracks: TrackRepository,
	path: TrackPath,
	currentStatus: TrackStatus,
	log: LoggerPort | undefined,
): Promise<boolean> {
	if (currentStatus === "indexing") {
		return true;
	}

	const transitioned = transitionFileStatus(currentStatus, "start_indexing");
	if (!transitioned.ok) {
		log?.warn("index track skipped: cannot start indexing", {
			path,
			status: currentStatus,
			reason: transitioned.error.message,
		});
		return false;
	}

	await tracks.updateStatus(path, transitioned.value);
	return true;
}

async function markIndexError(
	tracks: TrackRepository,
	path: TrackPath,
	error: DomainError,
): Promise<void> {
	const transitioned = transitionFileStatus("indexing", "index_failed");
	if (!transitioned.ok) {
		await tracks.updateStatus(path, "error", {
			message: error.message,
			details: formatErrorDetails(error),
		});
		return;
	}

	await tracks.updateStatus(path, transitioned.value, {
		message: error.message,
		details: formatErrorDetails(error),
	});
}

/**
 * Parse → normalize → metrics → persist `indexed` or `error` for one vault track file (§7.4).
 */
export async function indexTrackFile(
	deps: IndexTrackFileDeps,
	path: TrackPath,
): Promise<void> {
	const log = deps.logger?.child?.({ workflow: "index-track-file" }) ?? deps.logger;
	const existing = await deps.tracks.findByPath(path);
	if (existing === null) {
		log?.debug("index track skipped: row missing", { path });
		return;
	}

	if (!(await markIndexing(deps.tracks, path, existing.status, log))) {
		return;
	}

	const file = await deps.vaultTrackFile.read(path);
	if (file === null) {
		await markIndexError(
			deps.tracks,
			path,
			domainError("not_found", `Track file not found in vault: ${path}`),
		);
		return;
	}

	const parsed = await deps.trackParser.parse({
		vaultRelativePath: path,
		extension: file.extension,
		content: file.content,
	});

	if (!parsed.ok) {
		await markIndexError(deps.tracks, path, parsed.error);
		return;
	}

	const aggregated = aggregateParsedTrackForCatalog(
		parsed.value,
		createTimeNormalizationContext(deps.clock),
	);

	const indexed = buildIndexedTrackRecord({
		path,
		mtimeMs: file.mtimeMs,
		sha256: existing.sha256,
		aggregated,
	});

	const succeeded = transitionFileStatus("indexing", "index_succeeded");
	if (!succeeded.ok) {
		log?.warn("index track: unexpected status after parse", {
			path,
			reason: succeeded.error.message,
		});
	}

	await deps.tracks.upsert(indexed);
}

/** Factory for full/incremental scan job enqueue (0.4-11). */
export function createIndexTrackFileJob(deps: IndexTrackFileDeps): IndexTrackFileJob {
	return (path) => indexTrackFile(deps, path);
}
