import assert from "node:assert/strict";
import test from "node:test";
import {join} from "node:path";
import {fileURLToPath} from "node:url";
import jiti from "jiti";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const importTs = jiti(import.meta.url, {
	alias: {
		domain: join(ROOT, "src/domain"),
	},
});

const {domainBboxToLeafletBounds, domainLatLngToLeaflet} = importTs(
	"../src/infrastructure/map/track-route-geometry.ts",
);

test("domainLatLngToLeaflet maps lon to Leaflet lng", () => {
	const latlngs = domainLatLngToLeaflet([
		{lat: 48.1, lon: 11.5},
		{lat: 48.2, lon: 11.6},
	]);
	assert.deepEqual(latlngs, [
		[48.1, 11.5],
		[48.2, 11.6],
	]);
});

test("domainBboxToLeafletBounds returns south-west / north-east corners", () => {
	const bounds = domainBboxToLeafletBounds({
		south: 47,
		west: 10,
		north: 48,
		east: 11,
	});
	assert.deepEqual(bounds, [
		[47, 10],
		[48, 11],
	]);
});

test("domainBboxToLeafletBounds rejects invalid bbox", () => {
	assert.equal(domainBboxToLeafletBounds(null), null);
	assert.equal(
		domainBboxToLeafletBounds({south: 48, west: 10, north: 47, east: 11}),
		null,
	);
});
