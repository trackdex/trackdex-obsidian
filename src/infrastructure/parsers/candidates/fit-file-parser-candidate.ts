import FitParser from "fit-file-parser";
import {
	mapFitFileParserToParsedTrack,
	summarizeParsedTrack,
} from "./map-to-parsed-track";
import type { FitSpikeParseResult } from "./fit-spike-types";

export async function parseWithFitFileParser(
	sourceLabel: string,
	bytes: Uint8Array,
): Promise<FitSpikeParseResult> {
	const backend = "fit-file-parser" as const;
	const started = performance.now();
	try {
		const parser = new FitParser({ force: true, mode: "both" });
		const parsed = await parser.parseAsync(bytes.buffer.slice(
			bytes.byteOffset,
			bytes.byteOffset + bytes.byteLength,
		));
		const sample = mapFitFileParserToParsedTrack(
			parsed as Parameters<typeof mapFitFileParserToParsedTrack>[0],
		);
		const summary = summarizeParsedTrack(sample);
		if (summary.pointCount === 0) {
			return {
				backend,
				sourceLabel,
				ok: false,
				message: "No GPS points in FIT records.",
			};
		}
		const parseMs = performance.now() - started;
		return {
			backend,
			sourceLabel,
			ok: true,
			message: `OK ${String(summary.pointCount)} pts, ${String(summary.segmentCount)} laps, ${parseMs.toFixed(0)}ms`,
			metrics: { ...summary, parseMs },
			sample,
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return {
			backend,
			sourceLabel,
			ok: false,
			message,
		};
	}
}
