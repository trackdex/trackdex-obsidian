/** BCP-47 base tags supported in v1. */
export type SupportedLocale = "en" | "ru";

type Join<K extends string, P extends string> = P extends ""
	? K
	: `${P}.${K}`;

/** Dot-separated paths to string leaves in a nested message tree. */
export type DotPaths<T, P extends string = ""> = T extends string
	? never
	: {
			[K in keyof T & string]: T[K] extends string
				? Join<K, P>
				: DotPaths<T[K], Join<K, P>>;
		}[keyof T & string];

export type TranslationParams = Readonly<Record<string, string | number>>;
