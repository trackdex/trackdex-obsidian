import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const MAIN_JS = join(ROOT, "main.js");
const STYLES_CSS = join(ROOT, "styles.css");

const MIN_MAIN_JS_BYTES = 500_000;

const ALLOWED_REQUIRES = new Set([
	"obsidian",
	"electron",
	"@codemirror/autocomplete",
	"@codemirror/collab",
	"@codemirror/commands",
	"@codemirror/language",
	"@codemirror/lint",
	"@codemirror/search",
	"@codemirror/state",
	"@codemirror/view",
	"@lezer/common",
	"@lezer/highlight",
	"@lezer/lr",
]);

const NODE_BUILTINS = new Set([
	"assert",
	"buffer",
	"child_process",
	"cluster",
	"crypto",
	"dgram",
	"dns",
	"domain",
	"events",
	"fs",
	"http",
	"https",
	"module",
	"net",
	"os",
	"path",
	"readline",
	"repl",
	"stream",
	"string_decoder",
	"tls",
	"tty",
	"url",
	"util",
	"vm",
	"worker_threads",
]);

function collectRequires(mainJs) {
	return [...mainJs.matchAll(/require\(["']([^"']+)["']\)/g)].map((m) => m[1]);
}

function unexpectedRequires(requires) {
	return [
		...new Set(
			requires.filter(
				(id) =>
					!ALLOWED_REQUIRES.has(id) &&
					!NODE_BUILTINS.has(id) &&
					!id.startsWith("node:"),
			),
		),
	];
}

test("bundle integrity: release artifacts exist", () => {
	assert.equal(
		existsSync(MAIN_JS),
		true,
		"main.js missing — run npm run build first",
	);
	assert.equal(
		existsSync(STYLES_CSS),
		true,
		"styles.css missing — run npm run build first",
	);
});

test("bundle integrity: main.js has Obsidian default export", () => {
	const mainJs = readFileSync(MAIN_JS, "utf8");
	assert.match(mainJs, /module\.exports/);
	assert.match(mainJs, /default:\s*\(\)\s*=>/);
});

test("bundle integrity: main.js is not truncated", () => {
	const { size } = statSync(MAIN_JS);
	assert.ok(
		size >= MIN_MAIN_JS_BYTES,
		`main.js is only ${size} bytes; expected at least ${MIN_MAIN_JS_BYTES}`,
	);
});

test("bundle integrity: no unresolved domain/application requires", () => {
	const mainJs = readFileSync(MAIN_JS, "utf8");
	const stray = unexpectedRequires(collectRequires(mainJs));
	const layerImports = stray.filter(
		(id) => id.startsWith("domain/") || id.startsWith("application/"),
	);
	assert.deepEqual(
		layerImports,
		[],
		layerImports.length
			? `esbuild left bare layer imports as external requires:\n${layerImports.join("\n")}\n\nFix scripts/build.mjs alias/tsconfig.`
			: undefined,
	);
	assert.deepEqual(
		stray,
		[],
		stray.length
			? `Unexpected require() targets in main.js:\n${stray.join("\n")}`
			: undefined,
	);
});

const FORBIDDEN_SPIKE_COMMAND_IDS = [
	"storage-spike-smoke",
	"storage-spike-verify",
	"storage-spike-indexeddb",
	"fit-spike-smoke",
	"fit-spike-garmin-sdk",
];

const FORBIDDEN_SPIKE_REQUIRES = [
	"fit-file-parser",
	"@garmin-fit/sdk",
	"@garmin/fit/sdk",
];

test("bundle integrity: production main.js excludes spike commands and parser deps", () => {
	const mainJs = readFileSync(MAIN_JS, "utf8");
	const commandIds = FORBIDDEN_SPIKE_COMMAND_IDS.filter((id) =>
		mainJs.includes(id),
	);
	const parserRequires = FORBIDDEN_SPIKE_REQUIRES.filter((pkg) =>
		mainJs.includes(`require("${pkg}")`),
	);
	const found = [...commandIds, ...parserRequires];
	assert.deepEqual(
		found,
		[],
		found.length
			? `Production main.js must not include spike artifacts (set spike flags to false and rebuild):\n${found.join("\n")}`
			: undefined,
	);
});
