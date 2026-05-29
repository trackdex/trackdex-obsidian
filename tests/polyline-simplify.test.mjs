import test from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import jiti from "jiti";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const importTs = jiti(import.meta.url, {
	alias: {
		domain: join(ROOT, "src/domain"),
	},
});

const {
	POLYLINE_SIMPLIFY_TOLERANCE_M,
	computeTrackBbox,
	computeTrackMapGeometry,
	isBboxValidForMapFit,
	simplifyTrackPolyline,
	stringifyPolylineSimplifiedJson,
	stringifyTrackBboxJson,
} = importTs("../src/domain/track/polyline-simplify.ts");

function point(overrides) {
	return { lat: 0, lon: 0, ...overrides };
}

test("computeTrackBbox: empty -> null", () => {
	assert.equal(computeTrackBbox([]), null);
});

test("computeTrackBbox: single point", () => {
	const bbox = computeTrackBbox([point({ lat: 48.1, lon: 11.5 })]);
	assert.deepEqual(bbox, { south: 48.1, west: 11.5, north: 48.1, east: 11.5 });
});

test("computeTrackBbox: spans all points", () => {
	const bbox = computeTrackBbox([
		point({ lat: 53.2, lon: 50.11 }),
		point({ lat: 53.21, lon: 50.12 }),
		point({ lat: 53.22, lon: 50.13 }),
	]);
	assert.deepEqual(bbox, {
		south: 53.2,
		west: 50.11,
		north: 53.22,
		east: 50.13,
	});
});

test("isBboxValidForMapFit: accepts degenerate and normal boxes", () => {
	assert.equal(
		isBboxValidForMapFit({ south: 48.1, west: 11.4, north: 48.2, east: 11.6 }),
		true,
	);
	assert.equal(
		isBboxValidForMapFit({ south: 48.15, west: 11.5, north: 48.15, east: 11.5 }),
		true,
	);
	assert.equal(
		isBboxValidForMapFit({ south: 48.2, west: 11.4, north: 48.1, east: 11.6 }),
		false,
	);
	assert.equal(
		isBboxValidForMapFit({ south: 48.1, west: 11.6, north: 48.2, east: 11.4 }),
		false,
	);
});

test("simplifyTrackPolyline: empty -> null", () => {
	assert.equal(simplifyTrackPolyline([]), null);
});

test("simplifyTrackPolyline: collinear middle point removed within tolerance", () => {
	const points = [
		point({ lat: 0, lon: 0 }),
		point({ lat: 0, lon: 0.001 }),
		point({ lat: 0, lon: 0.002 }),
	];
	const simplified = simplifyTrackPolyline(points, POLYLINE_SIMPLIFY_TOLERANCE_M);
	assert.deepEqual(simplified, [
		{ lat: 0, lon: 0 },
		{ lat: 0, lon: 0.002 },
	]);
});

test("simplifyTrackPolyline: corner point kept", () => {
	const points = [
		point({ lat: 0, lon: 0 }),
		point({ lat: 0.01, lon: 0 }),
		point({ lat: 0.01, lon: 0.01 }),
	];
	const simplified = simplifyTrackPolyline(points, 5);
	assert.equal(simplified.length, 3);
	assert.deepEqual(simplified[0], { lat: 0, lon: 0 });
	assert.deepEqual(simplified[simplified.length - 1], { lat: 0.01, lon: 0.01 });
});

test("computeTrackMapGeometry: bbox contains simplified polyline vertices", () => {
	const points = [
		point({ lat: 48.1, lon: 11.5 }),
		point({ lat: 48.1005, lon: 11.501 }),
		point({ lat: 48.101, lon: 11.502 }),
	];
	const { bbox, polylineSimplified } = computeTrackMapGeometry(points);
	assert.ok(bbox);
	assert.ok(polylineSimplified);
	assert.ok(isBboxValidForMapFit(bbox));
	for (const vertex of polylineSimplified) {
		assert.ok(vertex.lat >= bbox.south && vertex.lat <= bbox.north);
		assert.ok(vertex.lon >= bbox.west && vertex.lon <= bbox.east);
	}
});

test("stringifyTrackBboxJson / stringifyPolylineSimplifiedJson: stable reindex output", () => {
	const points = [
		point({ lat: 48.1, lon: 11.5 }),
		point({ lat: 48.1005, lon: 11.501 }),
		point({ lat: 48.101, lon: 11.502 }),
	];
	const geometry = computeTrackMapGeometry(points);

	const bboxJsonFirst = stringifyTrackBboxJson(geometry.bbox);
	const bboxJsonSecond = stringifyTrackBboxJson(geometry.bbox);
	const polylineJsonFirst = stringifyPolylineSimplifiedJson(geometry.polylineSimplified);
	const polylineJsonSecond = stringifyPolylineSimplifiedJson(geometry.polylineSimplified);

	assert.equal(bboxJsonSecond, bboxJsonFirst);
	assert.equal(polylineJsonSecond, polylineJsonFirst);
	assert.equal(bboxJsonFirst, '{"south":48.1,"west":11.5,"north":48.101,"east":11.502}');
	assert.ok(polylineJsonFirst?.startsWith("["));
});

test("polyline simplify: reindex stability — identical input yields identical output", () => {
	const points = [
		point({ lat: 48.1, lon: 11.5 }),
		point({ lat: 48.1002, lon: 11.5005 }),
		point({ lat: 48.1005, lon: 11.501 }),
		point({ lat: 48.1008, lon: 11.5015 }),
		point({ lat: 48.101, lon: 11.502 }),
	];

	const first = computeTrackMapGeometry(points);
	const second = computeTrackMapGeometry(points);

	assert.deepEqual(second, first);
	assert.deepEqual(
		stringifyPolylineSimplifiedJson(second.polylineSimplified),
		stringifyPolylineSimplifiedJson(first.polylineSimplified),
	);
});
