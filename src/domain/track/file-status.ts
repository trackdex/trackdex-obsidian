import { domainError, type DomainError } from "domain/shared/errors";
import { err, ok, type Result } from "domain/shared/result";
import type { TrackPath } from "domain/track/track-record";
import type { TrackStatus } from "domain/track/track-status";

/** Indexing lifecycle status for a vault track file (alias of {@link TrackStatus}, §7.3 / F-01g). */
export type FileStatus = TrackStatus;

/** Signals that move a file between {@link FileStatus} values (parser details: milestone 0.4). */
export type FileStatusSignal =
	| "start_indexing"
	| "index_succeeded"
	| "index_failed"
	| "content_changed";

export interface FileStatusTransition {
	readonly from: FileStatus;
	readonly signal: FileStatusSignal;
	readonly to: FileStatus;
}

/**
 * Allowed status transitions (§7.3, REQUIREMENTS §7).
 * `pending → indexing → indexed`; `pending|indexing → error`; `indexed → stale → indexing`.
 */
export const FILE_STATUS_TRANSITIONS: readonly FileStatusTransition[] = [
	{ from: "pending", signal: "start_indexing", to: "indexing" },
	{ from: "stale", signal: "start_indexing", to: "indexing" },
	{ from: "error", signal: "start_indexing", to: "indexing" },
	{ from: "indexing", signal: "index_succeeded", to: "indexed" },
	{ from: "pending", signal: "index_failed", to: "error" },
	{ from: "indexing", signal: "index_failed", to: "error" },
	{ from: "indexed", signal: "content_changed", to: "stale" },
] as const;

const transitionKey = (from: FileStatus, signal: FileStatusSignal): string =>
	`${from}\0${signal}`;

const TRANSITION_LOOKUP = new Map<string, FileStatus>(
	FILE_STATUS_TRANSITIONS.map((row) => [transitionKey(row.from, row.signal), row.to]),
);

export function canTransitionFileStatus(
	current: FileStatus,
	signal: FileStatusSignal,
): boolean {
	return TRANSITION_LOOKUP.has(transitionKey(current, signal));
}

export function transitionFileStatus(
	current: FileStatus,
	signal: FileStatusSignal,
): Result<FileStatus, DomainError> {
	const next = TRANSITION_LOOKUP.get(transitionKey(current, signal));
	if (next === undefined) {
		return err(
			domainError(
				"validation_failed",
				`Invalid file status transition: ${current} + ${signal}`,
			),
		);
	}
	return ok(next);
}

/** Status assigned when a track file is first registered in the index. */
export function initialDiscoveredFileStatus(): FileStatus {
	return "pending";
}

/** Side effects for vault filesystem events (persistence via {@link TrackRepository}). */
export type FileLifecycleEffect =
	| { readonly kind: "none" }
	| { readonly kind: "remove" }
	| {
			readonly kind: "rename";
			readonly oldPath: TrackPath;
			readonly newPath: TrackPath;
			readonly mtimeMs: number;
	  }
	| {
			readonly kind: "insert_pending";
			readonly path: TrackPath;
			readonly mtimeMs: number;
	  };

export interface VaultRenameInput {
	readonly oldPath: TrackPath;
	readonly newPath: TrackPath;
	readonly mtimeMs: number;
}

/** §7.3 deletion: drop track row and related paths (repository cascades relations). */
export function resolveVaultFileDeleted(
	_current: FileStatus | null,
): FileLifecycleEffect {
	void _current;
	return { kind: "remove" };
}

/**
 * §7.3 rename: atomic path update when the row exists; otherwise register the new path.
 */
export function resolveVaultFileRenamed(
	hasExistingRow: boolean,
	input: VaultRenameInput,
): FileLifecycleEffect {
	if (!hasExistingRow) {
		return {
			kind: "insert_pending",
			path: input.newPath,
			mtimeMs: input.mtimeMs,
		};
	}
	return {
		kind: "rename",
		oldPath: input.oldPath,
		newPath: input.newPath,
		mtimeMs: input.mtimeMs,
	};
}

/** Vault `create`: register unknown paths as `pending`. */
export function resolveVaultFileCreated(
	hasExistingRow: boolean,
	path: TrackPath,
	mtimeMs: number,
): FileLifecycleEffect {
	if (hasExistingRow) {
		return { kind: "none" };
	}
	return { kind: "insert_pending", path, mtimeMs };
}

export interface VaultModifyInput {
	readonly path: TrackPath;
	readonly mtimeMs: number;
	readonly contentChanged: boolean;
}

export interface VaultModifyResolution {
	readonly effect: FileLifecycleEffect;
	readonly nextStatus?: FileStatus;
}

/**
 * Vault `modify`: new paths are discovered; indexed rows go `stale` when content changed.
 */
export function resolveVaultFileModified(
	current: FileStatus | null,
	input: VaultModifyInput,
): Result<VaultModifyResolution, DomainError> {
	if (current === null) {
		return ok({
			effect: {
				kind: "insert_pending",
				path: input.path,
				mtimeMs: input.mtimeMs,
			},
		});
	}

	if (!input.contentChanged) {
		return ok({ effect: { kind: "none" } });
	}

	if (current === "indexed") {
		const transitioned = transitionFileStatus(current, "content_changed");
		if (!transitioned.ok) {
			return transitioned;
		}
		return ok({ effect: { kind: "none" }, nextStatus: transitioned.value });
	}

	// Already queued, in flight, stale, or failed — mtime-only bookkeeping; re-index handled elsewhere.
	return ok({ effect: { kind: "none" } });
}
