import { Decoder, Stream } from "@garmin-fit/sdk";
import {
	mapGarminSdkToParsedTrack,
	summarizeParsedTrack,
} from "./map-to-parsed-track";
import type { FitSpikeParseResult } from "./fit-spike-types";

function formatGarminDecoderErrors(errors: readonly unknown[]): string {
	const joined = errors.map((e) => String(e)).join("; ");
	if (/compressed timestamp/i.test(joined)) {
		return (
			`${joined} — Garmin SDK does not support compressed-timestamp FIT ` +
			"(common on recent Garmin exports). v1 uses fit-file-parser; this spike is reference-only."
		);
	}
	return joined;
}

export async function parseWithGarminSdk(
	sourceLabel: string,
	bytes: Uint8Array,
): Promise<FitSpikeParseResult> {
	const backend = "garmin-sdk" as const;
	const started = performance.now();
	try {
		const stream = Stream.fromByteArray(bytes);
		const decoder = new Decoder(stream);
		if (!decoder.isFIT()) {
			return {
				backend,
				sourceLabel,
				ok: false,
				message: "Not a FIT file (header check failed).",
			};
		}
		const { messages, errors } = decoder.read();
		if (errors && errors.length > 0) {
			return {
				backend,
				sourceLabel,
				ok: false,
				message: `Decoder errors: ${formatGarminDecoderErrors(errors)}`,
			};
		}
		const sample = mapGarminSdkToParsedTrack(messages);
		const summary = summarizeParsedTrack(sample);
		if (summary.pointCount === 0) {
			return {
				backend,
				sourceLabel,
				ok: false,
				message: "No GPS points in recordMesgs.",
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
