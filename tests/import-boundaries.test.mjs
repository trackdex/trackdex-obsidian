import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const SRC = join(ROOT, "src");

/** npm packages that must stay inside infrastructure adapters (milestone 0.1 architecture gate). */
const FORBIDDEN = [
	{ pattern: /from\s+["']sql\.js["']/, label: "sql.js" },
	{ pattern: /from\s+["']fit-file-parser["']/, label: "fit-file-parser" },
	{ pattern: /from\s+["']@garmin\/fit\/sdk["']/, label: "@garmin/fit/sdk" },
];

function collectTsFiles(dir, out = []) {
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const full = join(dir, entry.name);
		if (entry.isDirectory()) {
			collectTsFiles(full, out);
		} else if (entry.name.endsWith(".ts")) {
			out.push(full);
		}
	}
	return out;
}

function rel(path) {
	return relative(ROOT, path).replaceAll("\\", "/");
}

function isAllowedStorageImport(filePath) {
	return rel(filePath).startsWith("src/infrastructure/storage/");
}

function isAllowedParserImport(filePath) {
	return rel(filePath).startsWith("src/infrastructure/parsers/");
}

test("import boundaries: storage and parser npm packages stay in infrastructure", () => {
	const violations = [];

	for (const file of collectTsFiles(SRC)) {
		const content = readFileSync(file, "utf8");
		const fileRel = rel(file);

		for (const { pattern, label } of FORBIDDEN) {
			if (!pattern.test(content)) {
				continue;
			}

			const allowed =
				label === "sql.js"
					? isAllowedStorageImport(file)
					: isAllowedParserImport(file);

			if (!allowed) {
				violations.push(`${fileRel} imports ${label}`);
			}
		}
	}

	assert.deepEqual(
		violations,
		[],
		violations.length
			? `Forbidden imports:\n${violations.join("\n")}`
			: undefined,
	);
});

test("import boundaries: application and domain do not import adapter npm packages", () => {
	const violations = [];

	for (const layer of ["application", "domain"]) {
		const layerDir = join(SRC, layer);
		for (const file of collectTsFiles(layerDir)) {
			const content = readFileSync(file, "utf8");
			for (const { pattern, label } of FORBIDDEN) {
				if (pattern.test(content)) {
					violations.push(`${rel(file)} imports ${label}`);
				}
			}
		}
	}

	assert.deepEqual(violations, []);
});

test("import boundaries: composition does not import sql.js directly", () => {
	const compositionDir = join(SRC, "composition");
	for (const file of collectTsFiles(compositionDir)) {
		const content = readFileSync(file, "utf8");
		assert.doesNotMatch(
			content,
			/from\s+["']sql\.js["']/,
			`${rel(file)} must not import sql.js directly`,
		);
	}
});
