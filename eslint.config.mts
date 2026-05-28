import tseslint from 'typescript-eslint';
import obsidianmd from "eslint-plugin-obsidianmd";
import globals from "globals";
import { globalIgnores } from "eslint/config";

export default tseslint.config(
	{
		languageOptions: {
			globals: {
				...globals.browser,
			},
			parserOptions: {
				projectService: {
					allowDefaultProject: [
						'eslint.config.js',
						'manifest.json'
					]
				},
				tsconfigRootDir: import.meta.dirname,
				extraFileExtensions: ['.json']
			},
		},
	},
	...obsidianmd.configs.recommended,
	globalIgnores([
		"node_modules",
		"dist",
		"scripts/build.mjs",
		"scripts/deploy.mjs",
		"scripts/deploy-android.mjs",
		"eslint.config.js",
		"scripts/version-bump.mjs",
		"versions.json",
		"main.js",
		"trackdex-dev-vault/**",
	]),
	{
		files: ["**/*.ts", "**/*.tsx"],
		plugins: {
			obsidianmd,
		},
		rules: {
			"obsidianmd/ui/sentence-case": [
				"error",
				{
					acronyms: ["GPX", "URL"],
					brands: ["Trackdex"],
					allowAutoFix: true,
				},
			],
		},
	},
);
