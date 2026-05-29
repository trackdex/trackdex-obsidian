/** Hardcoded rotation policy per REQUIREMENTS / TECHNICAL_DESIGN §13. */
export const LOG_MAX_FILES = 5;
export const LOG_MAX_BYTES = 1_048_576;
export const LOG_FILE_BASENAME = "trackdex.log";
export const LOGS_SUBDIR = "logs";

/** Active log plus rotated segments: `trackdex.log`, `trackdex.log.1`, … */
export function logSegmentNames(
	basename: string,
	maxFiles: number,
): readonly string[] {
	const names: string[] = [basename];
	for (let i = 1; i < maxFiles; i++) {
		names.push(`${basename}.${i}`);
	}
	return names;
}

export type RotationStep =
	| { op: "remove"; path: string }
	| { op: "rename"; from: string; to: string };

/**
 * Ordered steps to rotate logs in `logsDir` (delete oldest, shift segments, roll active).
 * Executor should skip steps when `from` / remove target does not exist.
 */
export function buildRotationSteps(
	logsDir: string,
	basename: string,
	maxFiles: number,
): RotationStep[] {
	const names = logSegmentNames(basename, maxFiles);
	const steps: RotationStep[] = [];
	const oldest = names[maxFiles - 1];
	if (oldest) {
		steps.push({ op: "remove", path: `${logsDir}/${oldest}` });
	}
	for (let i = maxFiles - 2; i >= 1; i--) {
		const from = names[i];
		const to = names[i + 1];
		if (from && to) {
			steps.push({
				op: "rename",
				from: `${logsDir}/${from}`,
				to: `${logsDir}/${to}`,
			});
		}
	}
	const active = names[0];
	const firstRotated = names[1];
	if (active && firstRotated) {
		steps.push({
			op: "rename",
			from: `${logsDir}/${active}`,
			to: `${logsDir}/${firstRotated}`,
		});
	}
	return steps;
}

/** Rotate before append when the active file would exceed `maxBytes`. */
export function needsRotationBeforeAppend(
	currentSize: number,
	appendBytes: number,
	maxBytes: number,
): boolean {
	return currentSize > 0 && currentSize + appendBytes > maxBytes;
}
