import test from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { DOMParser } from "@xmldom/xmldom";
import jiti from "jiti";

globalThis.DOMParser = DOMParser;

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const importTs = jiti(import.meta.url, {
	alias: {
		domain: join(ROOT, "src/domain"),
		application: join(ROOT, "src/application"),
	},
});
const {
	parseGpxTrackPoints,
	extractTrkptsFromDocument,
	isValidGpxCoordinate,
} = importTs("../src/infrastructure/parsers/gpx-parser.ts");

const GPX_NS = "http://www.topografix.com/GPX/1/1";

const GPX_WITH_NS = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" xmlns="${GPX_NS}">
  <trk>
    <trkseg>
      <trkpt lat="53.2" lon="50.11"><ele>125</ele></trkpt>
      <trkpt lat="53.21" lon="50.12"><ele>126</ele></trkpt>
      <trkpt lat="53.22" lon="50.13"><ele>127</ele></trkpt>
    </trkseg>
  </trk>
</gpx>`;

const GPX_NO_NS = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1">
  <trk>
    <trkseg>
      <trkpt lat="40.0" lon="-74.0"></trkpt>
      <trkpt lat="40.1" lon="-74.1"></trkpt>
    </trkseg>
  </trk>
</gpx>`;

const GPX_EMPTY_TRACK = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" xmlns="${GPX_NS}">
  <trk><name>Empty</name></trk>
</gpx>`;

test("parseGpxTrackPoints: GPX 1.1 with namespace", () => {
	const result = parseGpxTrackPoints(GPX_WITH_NS);
	assert.equal(result.ok, true);
	if (!result.ok) {
		return;
	}
	assert.equal(result.points.length, 3);
	assert.deepEqual(result.points[0], [53.2, 50.11]);
	assert.deepEqual(result.points[2], [53.22, 50.13]);
});

test("parseGpxTrackPoints: GPX without namespace", () => {
	const result = parseGpxTrackPoints(GPX_NO_NS);
	assert.equal(result.ok, true);
	if (!result.ok) {
		return;
	}
	assert.equal(result.points.length, 2);
	assert.deepEqual(result.points[0], [40.0, -74.0]);
});

test("parseGpxTrackPoints: no trkpt returns error", () => {
	const result = parseGpxTrackPoints(GPX_EMPTY_TRACK);
	assert.equal(result.ok, false);
	if (result.ok) {
		return;
	}
	assert.match(result.message, /track points/i);
});

test("parseGpxTrackPoints: empty string", () => {
	const result = parseGpxTrackPoints("  ");
	assert.equal(result.ok, false);
});

test("extractTrkptsFromDocument: skips invalid coordinates", () => {
	const doc = new DOMParser().parseFromString(
		`<gpx xmlns="${GPX_NS}">
      <trkpt lat="91" lon="0"></trkpt>
      <trkpt lat="0" lon="200"></trkpt>
      <trkpt lat="1" lon="2"></trkpt>
    </gpx>`,
		"application/xml",
	);
	const points = extractTrkptsFromDocument(doc);
	assert.deepEqual(points, [[1, 2]]);
});

test("isValidGpxCoordinate", () => {
	assert.equal(isValidGpxCoordinate(0, 0), true);
	assert.equal(isValidGpxCoordinate(90, 180), true);
	assert.equal(isValidGpxCoordinate(91, 0), false);
	assert.equal(isValidGpxCoordinate(0, 181), false);
});
