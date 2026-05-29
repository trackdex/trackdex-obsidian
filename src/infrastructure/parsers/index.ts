export {
	extractTrkptsFromDocument,
	GPX_11_NAMESPACE,
	isValidGpxCoordinate,
	parseGpxTrackPoints,
	type GpxLatLng,
	type ParseGpxTrackResult,
} from "./gpx-parser";
export { createFitParserPort } from "./fit-parser";
export {
	createDefaultParserRouter,
	createParserRouter,
	type ParserRouterDeps,
} from "./parser-router";
export {
	createTcxParserPort,
	extractTrackpointsFromDocument,
	isValidCoordinate,
	parseTcxToParsedTrack,
	TCX_NAMESPACE,
	TPX_NAMESPACE,
} from "./tcx-parser";
