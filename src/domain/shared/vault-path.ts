/**
 * Normalizes a vault-relative path for stable storage and comparison.
 * Obsidian uses forward slashes on all platforms; strips redundant prefixes.
 */
export function normalizeVaultRelativePath(path: string): string {
	let normalized = path.replace(/\\/g, "/");
	while (normalized.startsWith("./")) {
		normalized = normalized.slice(2);
	}
	while (normalized.startsWith("/")) {
		normalized = normalized.slice(1);
	}
	normalized = normalized.replace(/\/+/g, "/");
	return normalized;
}
