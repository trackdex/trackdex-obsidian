import {en, type MessagesSchema} from "./locales/en";
import {ru} from "./locales/ru";
import type {TranslationKey} from "./locales/en";
import {resolveLocale} from "./resolve-locale";
import type {SupportedLocale, TranslationParams} from "./types";

const localeMessages: Record<SupportedLocale, MessagesSchema> = {
	en,
	ru,
};

function getMessageByPath(
	messages: MessagesSchema,
	key: TranslationKey,
): string | undefined {
	const parts = key.split(".");
	let current: unknown = messages;
	for (const part of parts) {
		if (current === null || typeof current !== "object") {
			return undefined;
		}
		current = (current as Record<string, unknown>)[part];
	}
	return typeof current === "string" ? current : undefined;
}

export function interpolate(
	template: string,
	params?: TranslationParams,
): string {
	if (!params) {
		return template;
	}
	let result = template;
	for (const [name, value] of Object.entries(params)) {
		result = result.replace(
			new RegExp(`\\{${name}\\}`, "g"),
			String(value),
		);
	}
	return result;
}

export function createTranslator(locale: SupportedLocale) {
	return function translate(
		key: TranslationKey,
		params?: TranslationParams,
	): string {
		const localized =
			getMessageByPath(localeMessages[locale], key) ??
			getMessageByPath(localeMessages.en, key);
		if (localized === undefined) {
			return key;
		}
		return interpolate(localized, params);
	};
}

/** Translates a key for the current Obsidian UI locale. */
export function t(key: TranslationKey, params?: TranslationParams): string {
	return createTranslator(resolveLocale())(key, params);
}
