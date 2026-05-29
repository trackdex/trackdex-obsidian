import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function readSpikeFlag(filePath, exportName) {
	const content = readFileSync(join(ROOT, filePath), "utf8");
	const match = content.match(
		new RegExp(`export const ${exportName} = (true|false)`),
	);
	assert.ok(match, `${exportName} not found in ${filePath}`);
	return match[1] === "true";
}

test("spike config: ENABLE_STORAGE_SPIKE is false in committed builds", () => {
	assert.equal(
		readSpikeFlag(
			"src/infrastructure/storage/candidates/spike-config.ts",
			"ENABLE_STORAGE_SPIKE",
		),
		false,
	);
});

test("spike config: ENABLE_STORAGE_SCHEMA_SMOKE is false in committed builds", () => {
	assert.equal(
		readSpikeFlag(
			"src/infrastructure/storage/candidates/spike-config.ts",
			"ENABLE_STORAGE_SCHEMA_SMOKE",
		),
		false,
	);
});

