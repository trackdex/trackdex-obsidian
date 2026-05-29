import { normalizeVaultRelativePath } from "domain/shared/vault-path";

/** Built-in vault paths skipped during scan (§7.2). */
export const DEFAULT_SCAN_EXCLUDE_PATTERNS = [
	// Default user-facing globs per F-01b; not Vault#configDir (customizable in 0.9).
	// eslint-disable-next-line obsidianmd/hardcoded-config-path -- product default exclude
	".obsidian/**",
	".trash/**",
] as const;

export type ScanExcludePattern = string;

/** Merges built-in excludes with user patterns from settings. */
export function resolveScanExcludePatterns(
	userPatterns: readonly ScanExcludePattern[] | undefined,
): readonly ScanExcludePattern[] {
	const user =
		userPatterns
			?.map((pattern) => pattern.trim())
			.filter((pattern) => pattern.length > 0) ?? [];
	return [...DEFAULT_SCAN_EXCLUDE_PATTERNS, ...user];
}

/**
 * Returns true when a normalized vault-relative path matches any exclude glob.
 * Patterns are vault-relative, forward-slash, glob/ignore-like (§7.2, F-01b).
 */
export function isVaultPathExcluded(
	vaultRelativePath: string,
	patterns: readonly ScanExcludePattern[],
): boolean {
	const path = normalizeVaultRelativePath(vaultRelativePath);
	for (const rawPattern of patterns) {
		const pattern = normalizeExcludePattern(rawPattern);
		if (!pattern) {
			continue;
		}
		if (matchExcludePattern(pattern, path)) {
			return true;
		}
	}
	return false;
}

function normalizeExcludePattern(pattern: string): string | null {
	const trimmed = pattern.trim();
	if (!trimmed) {
		return null;
	}
	return normalizeVaultRelativePath(trimmed);
}

function matchExcludePattern(pattern: string, path: string): boolean {
	if (pattern.endsWith("/**")) {
		const prefix = pattern.slice(0, -3);
		if (path === prefix || path.startsWith(`${prefix}/`)) {
			return true;
		}
	}
	return globPatternToRegExp(pattern).test(path);
}

function globPatternToRegExp(pattern: string): RegExp {
	let regex = "^";
	for (let i = 0; i < pattern.length; i++) {
		const char = pattern[i]!;
		if (char === "*") {
			if (pattern[i + 1] === "*") {
				const slash = pattern[i + 2];
				if (slash === "/") {
					regex += "(?:.*/)?";
					i += 2;
				} else {
					regex += ".*";
					i += 1;
				}
			} else {
				regex += "[^/]*";
			}
			continue;
		}
		if (char === "?") {
			regex += "[^/]";
			continue;
		}
		if ("\\^$+.|()[]{}".includes(char)) {
			regex += `\\${char}`;
			continue;
		}
		regex += char;
	}
	regex += "$";
	return new RegExp(regex);
}
