import type { ParsedTrack } from "../../../domain/track/parsed-track";
import type { FitParserSpikeBackend } from "./spike-config";

export interface FitSpikeParseMetrics {
	readonly pointCount: number;
	readonly segmentCount: number;
	readonly hasHr: boolean;
	readonly hasPower: boolean;
	readonly hasCadence: boolean;
	readonly parseMs: number;
}

export interface FitSpikeParseResult {
	readonly backend: FitParserSpikeBackend;
	readonly sourceLabel: string;
	readonly ok: boolean;
	readonly message: string;
	readonly metrics?: FitSpikeParseMetrics;
	readonly sample?: ParsedTrack;
}
