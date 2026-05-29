import esbuild from "esbuild";
import { readFileSync, statSync } from "node:fs";
import { builtinModules } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MAIN_OUT = join(ROOT, "main.js");
const SPIKE_ONLY_OUT = join(ROOT, "main.js.spike-only.tmp");
const FIT_FFP_OUT = join(ROOT, "main.js.fit-ffp.tmp");
const FIT_GARMIN_OUT = join(ROOT, "main.js.fit-garmin.tmp");

function formatMb(bytes) {
	return `${(bytes / (1024 * 1024)).toFixed(2)} MB (${bytes} bytes)`;
}

function sqlWasmEmbedPlugin() {
	const wasmPath = join(ROOT, "node_modules/sql.js/dist/sql-wasm.wasm");
	return {
		name: "sql-wasm-embed",
		setup(build) {
			build.onResolve({ filter: /^trackdex:sql-wasm$/ }, () => ({
				path: "trackdex-sql-wasm",
				namespace: "sql-wasm-embed",
			}));
			build.onLoad({ filter: /.*/, namespace: "sql-wasm-embed" }, () => {
				const base64 = readFileSync(wasmPath).toString("base64");
				return {
					contents: [
						`const SQL_WASM_BASE64 = ${JSON.stringify(base64)};`,
						"export function getSqlWasmBinary() {",
						"  return new Uint8Array(Buffer.from(SQL_WASM_BASE64, 'base64'));",
						"}",
					].join("\n"),
					loader: "js",
				};
			});
		},
	};
}

async function buildIsolated(entryPath, outfile) {
	await esbuild.build({
		entryPoints: [entryPath],
		bundle: true,
		outfile,
		format: "cjs",
		target: "es2018",
		minify: true,
		treeShaking: true,
		external: ["obsidian", "electron", ...builtinModules],
		plugins: entryPath.includes("storage") ? [sqlWasmEmbedPlugin()] : [],
		logLevel: "silent",
	});
	return statSync(outfile).size;
}

const productionMainSize = statSync(MAIN_OUT).size;
const sqlSpikeSize = await buildIsolated(
	join(ROOT, "src/infrastructure/storage/candidates/spike-bundle-entry.ts"),
	SPIKE_ONLY_OUT,
);
const fitFfpSize = await buildIsolated(
	join(
		ROOT,
		"src/infrastructure/parsers/candidates/spike-bundle-entry-fit-file-parser.ts",
	),
	FIT_FFP_OUT,
);
const fitGarminSize = await buildIsolated(
	join(
		ROOT,
		"src/infrastructure/parsers/candidates/spike-bundle-entry-garmin-sdk.ts",
	),
	FIT_GARMIN_OUT,
);
const wasmSize = statSync(
	join(ROOT, "node_modules/sql.js/dist/sql-wasm.wasm"),
).size;

console.log("Bundle size report (run after `npm run build`):");
console.log(`  production main.js (spike flags false): ${formatMb(productionMainSize)}`);
console.log(`  sql.js + embedded WASM (isolated): ${formatMb(sqlSpikeSize)}`);
console.log(`  fit-file-parser (isolated): ${formatMb(fitFfpSize)}`);
console.log(`  @garmin-fit/sdk (isolated): ${formatMb(fitGarminSize)}`);
console.log(`  raw sql-wasm.wasm on disk: ${formatMb(wasmSize)}`);
console.log(
	`  rough main.js + sql.js spike: ${formatMb(productionMainSize + sqlSpikeSize)}`,
);
console.log(
	`  rough main.js + fit-file-parser spike: ${formatMb(productionMainSize + fitFfpSize)}`,
);
