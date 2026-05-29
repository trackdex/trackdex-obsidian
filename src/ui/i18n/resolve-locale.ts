import type {SupportedLocale} from "./types";

/** Maps Obsidian / moment locale tags to a supported v1 locale. */
export function normalizeLocaleTag(raw: string | undefined | null): SupportedLocale {
	if (!raw) {
		return "en";
	}
	const base = raw.trim().toLowerCase().split(/[-_]/)[0];
	if (base === "ru") {
		return "ru";
	}
	return "en";
}

function readObsidianLocaleTag(): string | undefined {
	const momentGlobal = (globalThis as {
		moment?: {locale: () => string};
	}).moment;
	if (momentGlobal?.locale) {
		const tag = momentGlobal.locale();
		if (typeof tag === "string" && tag.length > 0) {
			return tag;
		}
	}

	try {
		// Obsidian UI language (global), not vault-scoped plugin data.
		// eslint-disable-next-line no-restricted-globals -- fallback when moment is unavailable
		const fromStorage = localStorage.getItem("language");
		if (fromStorage) {
			return fromStorage;
		}
	} catch {
		// localStorage may be unavailable in some contexts
	}

	return undefined;
}

/** Resolves UI locale from Obsidian settings, falling back to English. */
export function resolveLocale(): SupportedLocale {
	return normalizeLocaleTag(readObsidianLocaleTag());
}
