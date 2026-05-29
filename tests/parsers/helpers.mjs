import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DOMParser } from "@xmldom/xmldom";
import jiti from "jiti";

globalThis.DOMParser = DOMParser;

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const FIXTURES = join(ROOT, "tests/fixtures");

const importTs = jiti(import.meta.url, {
	alias: {
		domain: join(ROOT, "src/domain"),
		application: join(ROOT, "src/application"),
	},
});

export const { createDefaultParserRouter } = importTs(
	"../../src/infrastructure/parsers/parser-router.ts",
);
export const { deriveTrackDataFlags } = importTs(
	"../../src/domain/track/derive-track-data-flags.ts",
);

export { FIXTURES, ROOT };

export function fixtureBytes(name) {
	return new Uint8Array(readFileSync(join(FIXTURES, name)));
}

export function parseFixture(extension, fixtureName) {
	const router = createDefaultParserRouter();
	return router.parse({
		vaultRelativePath: `tracks/${fixtureName}`,
		extension,
		content: fixtureBytes(fixtureName),
	});
}

export function assertPartialTrack(track) {
	for (const point of track.points) {
		if (point.elevationM !== null) {
			throw new Error("partial fixture should not include elevation");
		}
		if (point.timestampRaw !== null) {
			throw new Error("partial fixture should not include timestamps");
		}
		if (point.hrBpm !== null) {
			throw new Error("partial fixture should not include heart rate");
		}
		if (point.powerW !== null) {
			throw new Error("partial fixture should not include power");
		}
		if (point.cadenceRpm !== null) {
			throw new Error("partial fixture should not include cadence");
		}
		if (point.speedMps !== null) {
			throw new Error("partial fixture should not include speed");
		}
	}

	const flags = deriveTrackDataFlags(track);
	if (flags.hasGeometry !== true) {
		throw new Error("partial fixture should expose geometry");
	}
	for (const [key, value] of Object.entries(flags)) {
		if (key !== "hasGeometry" && value === true) {
			throw new Error(`partial fixture should not set ${key}`);
		}
	}
}
