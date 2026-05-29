import { Decoder, Stream } from "@garmin-fit/sdk";
import {
	mapGarminSdkToParsedTrack,
	summarizeParsedTrack,
} from "./map-to-parsed-track";
import type { FitSpikeParseResult } from "./fit-spike-types";

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
				message: `Decoder errors: ${errors.map((e) => String(e)).join("; ")}`,
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
