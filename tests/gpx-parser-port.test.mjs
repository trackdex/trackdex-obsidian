import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DOMParser } from "@xmldom/xmldom";
import jiti from "jiti";

globalThis.DOMParser = DOMParser;

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FIXTURES = join(ROOT, "tests/fixtures");
const importTs = jiti(import.meta.url, {
	alias: {
		domain: join(ROOT, "src/domain"),
		application: join(ROOT, "src/application"),
	},
});

const { createGpxParserPort, parseGpxDocumentToParsedTrack } = importTs(
	"../src/infrastructure/parsers/gpx-parser.ts",
);
const { createDefaultParserRouter } = importTs(
	"../src/infrastructure/parsers/parser-router.ts",
);

function fixtureBytes(name) {
	return new Uint8Array(readFileSync(join(FIXTURES, name)));
}

function baseInput(extension, content) {
	return {
		vaultRelativePath: `tracks/${nameFromExtension(extension)}`,
		extension,
		content,
	};
}

function nameFromExtension(extension) {
	return extension === "fit.gz" ? "sample.fit.gz" : `sample.${extension}`;
}

test("fixtures: sample-track.gpx and malformed-track.gpx exist", () => {
	const valid = readFileSync(join(FIXTURES, "sample-track.gpx"));
	const malformed = readFileSync(join(FIXTURES, "malformed-track.gpx"));
	assert.ok(valid.length > 100);
	assert.ok(malformed.length > 50);
});

test("createGpxParserPort: valid fixture parses to ParsedTrack", async () => {
	const parser = createGpxParserPort();
	const result = await parser.parse(
		baseInput("gpx", fixtureBytes("sample-track.gpx")),
	);

	assert.equal(result.ok, true);
	if (!result.ok) {
		return;
	}

	const track = result.value;
	assert.equal(track.titleFromFile, "Morning ride");
	assert.equal(track.sportRaw, "cycling");
	assert.equal(track.startedAtRaw, "2024-06-01T08:00:00Z");
	assert.equal(track.endedAtRaw, "2024-06-01T08:10:00Z");
	assert.equal(track.points.length, 3);
	assert.equal(track.segments.length, 2);
	assert.equal(track.segments[0]?.pointCount, 2);
	assert.equal(track.segments[1]?.pointCount, 1);
	assert.equal(track.points[0]?.elevationM, 125);
	assert.equal(track.points[0]?.hrBpm, 120);
	assert.deepEqual(track.bbox, {
		south: 53.2,
		west: 50.11,
		north: 53.22,
		east: 50.13,
	});
});

test("createGpxParserPort: malformed fixture returns parse_failed", async () => {
	const parser = createGpxParserPort();
	const result = await parser.parse(
		baseInput("gpx", fixtureBytes("malformed-track.gpx")),
	);

	assert.equal(result.ok, false);
	if (result.ok) {
		return;
	}
	assert.equal(result.error.code, "parse_failed");
	assert.match(result.error.message, /track points/i);
});

test("createGpxParserPort: empty content returns parse_failed", async () => {
	const parser = createGpxParserPort();
	const result = await parser.parse(baseInput("gpx", new Uint8Array(0)));

	assert.equal(result.ok, false);
	if (result.ok) {
		return;
	}
	assert.equal(result.error.code, "parse_failed");
	assert.match(result.error.message, /empty/i);
});

test("createGpxParserPort: invalid XML returns parse_failed", async () => {
	const parser = createGpxParserPort();
	const result = await parser.parse(
		baseInput("gpx", new TextEncoder().encode("<gpx><unclosed>")),
	);

	assert.equal(result.ok, false);
	if (result.ok) {
		return;
	}
	assert.equal(result.error.code, "parse_failed");
	assert.match(result.error.message, /parse GPX/i);
});

test("parseGpxDocumentToParsedTrack: maps segment timestamps and bbox", () => {
	const xml = readFileSync(join(FIXTURES, "sample-track.gpx"), "utf8");
	const doc = new DOMParser().parseFromString(xml, "application/xml");
	const track = parseGpxDocumentToParsedTrack(doc);

	assert.equal(track.segments[0]?.startedAtRaw, "2024-06-01T08:00:00Z");
	assert.equal(track.segments[0]?.endedAtRaw, "2024-06-01T08:05:00Z");
	assert.deepEqual(track.segments[0]?.bbox, {
		south: 53.2,
		west: 50.11,
		north: 53.21,
		east: 50.12,
	});
});

test("default parser router: GPX routes to real adapter", async () => {
	const router = createDefaultParserRouter();
	const result = await router.parse(
		baseInput("gpx", fixtureBytes("sample-track.gpx")),
	);

	assert.equal(result.ok, true);
	if (!result.ok) {
		return;
	}
	assert.equal(result.value.titleFromFile, "Morning ride");
	assert.equal(result.value.points.length, 3);
});

test("createGpxParserPort: reads Garmin gpxtpx:cad as cadenceRpm", async () => {
	const xml = `<?xml version="1.0" encoding="UTF-8"?>
<gpx xmlns="http://www.topografix.com/GPX/1/1"
  xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1">
  <trk>
    <trkseg>
      <trkpt lat="53.2" lon="50.11">
        <time>2024-06-01T08:00:00Z</time>
        <extensions>
          <gpxtpx:TrackPointExtension>
            <gpxtpx:cad>88</gpxtpx:cad>
          </gpxtpx:TrackPointExtension>
        </extensions>
      </trkpt>
    </trkseg>
  </trk>
</gpx>`;
	const parser = createGpxParserPort();
	const result = await parser.parse(
		baseInput("gpx", new TextEncoder().encode(xml)),
	);

	assert.equal(result.ok, true);
	if (!result.ok) {
		return;
	}
	assert.equal(result.value.points[0]?.cadenceRpm, 88);
});
