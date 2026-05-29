/**
 * Regenerates geometry-only FIT fixtures for parser matrix tests (0.4-12).
 * Run: node scripts/generate-partial-fit-fixtures.mjs
 */
import { writeFileSync } from "node:fs";
import { Buffer } from "node:buffer";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FIXTURES = join(ROOT, "tests/fixtures");

function degToSemi(deg) {
	return Math.round(deg * (2 ** 31 / 180));
}

function u32le(n) {
	return [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >> 24) & 0xff];
}

function i32le(n) {
	return u32le(n >>> 0);
}

function fitCrc16(data, crc = 0) {
	const table = [];
	for (let i = 0; i < 256; i++) {
		let rem = i;
		for (let b = 0; b < 8; b++) {
			rem = rem & 1 ? (rem >>> 1) ^ 0xa001 : rem >>> 1;
		}
		table[i] = rem;
	}
	for (const byte of data) {
		crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
	}
	return crc & 0xffff;
}

function buildGeometryOnlyFit(points) {
	const messages = [];
	messages.push(0x40, 0, 0, 0, 0, 3, 0, 1, 0, 1, 2, 132, 2, 2, 132);
	messages.push(0, 4, 255, 0, 0, 0);
	messages.push(0x40, 0, 0, 20, 0, 2, 0, 4, 133, 1, 4, 133);
	for (const [lat, lon] of points) {
		messages.push(0, ...i32le(degToSemi(lat)), ...i32le(degToSemi(lon)));
	}

	const dataSize = messages.length;
	const header = [
		14,
		16,
		20,
		5,
		...u32le(dataSize),
		0x2e,
		0x46,
		0x49,
		0x54,
		0,
		0,
	];
	const body = [...header, ...messages];
	const fileCrc = fitCrc16(body);
	body.push(fileCrc & 0xff, (fileCrc >> 8) & 0xff);
	return Buffer.from(body);
}

const fit = buildGeometryOnlyFit([
	[53.2, 50.11],
	[53.21, 50.12],
]);
writeFileSync(join(FIXTURES, "partial-activity.fit"), fit);
writeFileSync(join(FIXTURES, "partial-activity.fit.gz"), gzipSync(fit));
writeFileSync(join(FIXTURES, "malformed-activity.fit.gz"), Buffer.from([1, 2, 3, 4, 5]));

console.log("Wrote partial-activity.fit, partial-activity.fit.gz, malformed-activity.fit.gz");
