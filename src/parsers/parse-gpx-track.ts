/** GPX 1.1 default namespace (Topografix). */
export const GPX_11_NAMESPACE = "http://www.topografix.com/GPX/1/1";

export type GpxLatLng = [lat: number, lng: number];

export type ParseGpxTrackResult =
	| {ok: true; points: GpxLatLng[]}
	| {ok: false; message: string};

export function parseGpxTrackPoints(xml: string): ParseGpxTrackResult {
	const trimmed = xml.trim();
	if (!trimmed) {
		return {ok: false, message: "GPX file is empty."};
	}

	let doc: Document;
	try {
		doc = new DOMParser().parseFromString(trimmed, "application/xml");
	} catch {
		return {ok: false, message: "Could not parse GPX."};
	}

	if (hasXmlParserError(doc)) {
		return {ok: false, message: "Could not parse GPX."};
	}

	const points = extractTrkptsFromDocument(doc);
	if (points.length === 0) {
		return {ok: false, message: "No track points in this GPX."};
	}

	return {ok: true, points};
}

/** Exported for unit tests with an injected Document. */
export function extractTrkptsFromDocument(doc: Document): GpxLatLng[] {
	const points: GpxLatLng[] = [];
	const seen = new Set<Element>();

	const fromNs = doc.getElementsByTagNameNS(GPX_11_NAMESPACE, "trkpt");
	for (let i = 0; i < fromNs.length; i++) {
		const el = fromNs.item(i);
		if (el && !seen.has(el)) {
			seen.add(el);
			pushTrkpt(el, points);
		}
	}

	if (points.length > 0) {
		return points;
	}

	const byTag = doc.getElementsByTagName("trkpt");
	for (let i = 0; i < byTag.length; i++) {
		const el = byTag.item(i);
		if (el && !seen.has(el)) {
			seen.add(el);
			pushTrkpt(el, points);
		}
	}

	if (points.length > 0) {
		return points;
	}

	const all = doc.getElementsByTagName("*");
	for (let i = 0; i < all.length; i++) {
		const el = all.item(i);
		if (el && el.localName === "trkpt" && !seen.has(el)) {
			seen.add(el);
			pushTrkpt(el, points);
		}
	}

	return points;
}

function hasXmlParserError(doc: Document): boolean {
	const errors = doc.getElementsByTagName("parsererror");
	return errors.length > 0;
}

function pushTrkpt(el: Element, points: GpxLatLng[]): void {
	const lat = parseCoordinate(el.getAttribute("lat"));
	const lng = parseCoordinate(el.getAttribute("lon"));
	if (lat === null || lng === null || !isValidGpxCoordinate(lat, lng)) {
		return;
	}
	points.push([lat, lng]);
}

function parseCoordinate(value: string | null): number | null {
	if (value === null || value === "") {
		return null;
	}
	const n = Number.parseFloat(value);
	if (!Number.isFinite(n)) {
		return null;
	}
	return n;
}

/** Validates a parsed lat/lng pair (exported for tests). */
export function isValidGpxCoordinate(lat: number, lng: number): boolean {
	return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}
