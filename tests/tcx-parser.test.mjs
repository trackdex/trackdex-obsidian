import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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
	parseTcxToParsedTrack,
	extractTrackpointsFromDocument,
	isValidCoordinate,
	createTcxParserPort,
	TCX_NAMESPACE,
} = importTs("../src/infrastructure/parsers/tcx-parser.ts");
const { createDefaultParserRouter } = importTs(
	"../src/infrastructure/parsers/parser-router.ts",
);

const FIXTURE_PATH = join(ROOT, "tests/fixtures/sample-activity.tcx");
const FIXTURE_XML = readFileSync(FIXTURE_PATH, "utf8");

const TCX_NO_NS = `<?xml version="1.0" encoding="UTF-8"?>
<TrainingCenterDatabase>
  <Activities>
    <Activity Sport="Running">
      <Lap StartTime="2024-01-01T10:00:00Z">
        <Track>
          <Trackpoint>
            <Time>2024-01-01T10:00:00Z</Time>
            <Position>
              <LatitudeDegrees>40.0</LatitudeDegrees>
              <LongitudeDegrees>-74.0</LongitudeDegrees>
            </Position>
          </Trackpoint>
          <Trackpoint>
            <Time>2024-01-01T10:01:00Z</Time>
            <Position>
              <LatitudeDegrees>40.1</LatitudeDegrees>
              <LongitudeDegrees>-74.1</LongitudeDegrees>
            </Position>
          </Trackpoint>
        </Track>
      </Lap>
    </Activity>
  </Activities>
</TrainingCenterDatabase>`;

const TCX_NO_POINTS = `<?xml version="1.0" encoding="UTF-8"?>
<TrainingCenterDatabase xmlns="${TCX_NAMESPACE}">
  <Activities>
    <Activity Sport="Other">
      <Lap StartTime="2024-01-01T10:00:00Z"></Lap>
    </Activity>
  </Activities>
</TrainingCenterDatabase>`;

const TCX_INVALID_COORDS = `<?xml version="1.0" encoding="UTF-8"?>
<TrainingCenterDatabase xmlns="${TCX_NAMESPACE}">
  <Activities>
    <Activity Sport="Other">
      <Lap StartTime="2024-01-01T10:00:00Z">
        <Track>
          <Trackpoint>
            <Time>2024-01-01T10:00:00Z</Time>
            <Position>
              <LatitudeDegrees>91</LatitudeDegrees>
              <LongitudeDegrees>0</LongitudeDegrees>
            </Position>
          </Trackpoint>
          <Trackpoint>
            <Time>2024-01-01T10:01:00Z</Time>
            <Position>
              <LatitudeDegrees>1</LatitudeDegrees>
              <LongitudeDegrees>2</LongitudeDegrees>
            </Position>
          </Trackpoint>
        </Track>
      </Lap>
    </Activity>
  </Activities>
</TrainingCenterDatabase>`;

test("parseTcxToParsedTrack: fixture with namespace", () => {
	const result = parseTcxToParsedTrack(FIXTURE_XML);
	assert.equal(result.ok, true);
	if (!result.ok) {
		return;
	}
	const track = result.value;
	assert.equal(track.sportRaw, "Biking");
	assert.equal(track.titleFromFile, "Morning ride");
	assert.equal(track.startedAtRaw, "2024-06-01T08:00:00.000Z");
	assert.equal(track.endedAtRaw, "2024-06-01T08:02:00.000Z");
	assert.equal(track.points.length, 3);
	assert.equal(track.segments.length, 2);
	assert.equal(track.segments[0].pointCount, 2);
	assert.equal(track.segments[1].pointCount, 1);

	const first = track.points[0];
	assert.equal(first.lat, 53.2);
	assert.equal(first.lon, 50.11);
	assert.equal(first.elevationM, 125);
	assert.equal(first.hrBpm, 120);
	assert.equal(first.cadenceRpm, 85);
	assert.equal(first.speedMps, 5.5);
	assert.equal(first.powerW, 180);

	assert.ok(track.bbox);
	assert.equal(track.bbox.south, 53.2);
	assert.equal(track.bbox.north, 53.22);
});

test("parseTcxToParsedTrack: without namespace", () => {
	const result = parseTcxToParsedTrack(TCX_NO_NS);
	assert.equal(result.ok, true);
	if (!result.ok) {
		return;
	}
	assert.equal(result.value.sportRaw, "Running");
	assert.equal(result.value.points.length, 2);
});

test("parseTcxToParsedTrack: empty file", () => {
	const result = parseTcxToParsedTrack("  ");
	assert.equal(result.ok, false);
	if (result.ok) {
		return;
	}
	assert.equal(result.error.code, "parse_failed");
	assert.match(result.error.message, /empty/i);
});

test("parseTcxToParsedTrack: no track points", () => {
	const result = parseTcxToParsedTrack(TCX_NO_POINTS);
	assert.equal(result.ok, false);
	if (result.ok) {
		return;
	}
	assert.match(result.error.message, /track points/i);
});

test("parseTcxToParsedTrack: malformed xml", () => {
	const result = parseTcxToParsedTrack("<not-xml");
	assert.equal(result.ok, false);
	if (result.ok) {
		return;
	}
	assert.match(result.error.message, /parse TCX/i);
});

test("extractTrackpointsFromDocument: skips invalid coordinates", () => {
	const doc = new DOMParser().parseFromString(TCX_INVALID_COORDS, "application/xml");
	const points = extractTrackpointsFromDocument(doc);
	assert.equal(points.length, 1);
	assert.equal(points[0].lat, 1);
	assert.equal(points[0].lon, 2);
});

test("isValidCoordinate", () => {
	assert.equal(isValidCoordinate(0, 0), true);
	assert.equal(isValidCoordinate(90, 180), true);
	assert.equal(isValidCoordinate(91, 0), false);
	assert.equal(isValidCoordinate(0, 181), false);
});

test("createTcxParserPort: parses Uint8Array content", async () => {
	const parser = createTcxParserPort();
	const result = await parser.parse({
		vaultRelativePath: "tracks/sample.tcx",
		extension: "tcx",
		content: new TextEncoder().encode(FIXTURE_XML),
	});
	assert.equal(result.ok, true);
	if (!result.ok) {
		return;
	}
	assert.equal(result.value.points.length, 3);
});

test("default parser router: tcx parses via wired adapter", async () => {
	const router = createDefaultParserRouter();
	const result = await router.parse({
		vaultRelativePath: "tracks/sample.tcx",
		extension: "tcx",
		content: new TextEncoder().encode(FIXTURE_XML),
	});
	assert.equal(result.ok, true);
	if (!result.ok) {
		return;
	}
	assert.equal(result.value.points.length, 3);
});
