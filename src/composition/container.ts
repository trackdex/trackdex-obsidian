import type { ClockPort } from "application/ports/clock-port";
import type { LoggerPort } from "application/ports/logger-port";
import type { PerfMetricsPort } from "application/ports/metrics-port";
import type { TrackParserPort } from "application/ports/parser-port";
import type {
	IndexMetaRepository,
	NoteLinkRepository,
	PlaceRepository,
	TrackRepository,
} from "application/ports/repositories";
import { createNoopLoggerPort } from "../infrastructure/logging/noop-logger-port";
import { createNoopMetricsPort } from "../infrastructure/logging/noop-metrics-port";
import { createSystemClockPort } from "../infrastructure/logging/system-clock-port";
import { createNoopTrackParserPort } from "../infrastructure/parsers/noop-track-parser-port";
import {
	createNoopIndexMetaRepository,
	createNoopNoteLinkRepository,
	createNoopPlaceRepository,
	createNoopTrackRepository,
} from "../infrastructure/storage/stubs/noop-repositories";
import type { TrackdexPluginHost } from "./plugin-host";

export interface TrackdexContainer {
	readonly logger: LoggerPort;
	readonly clock: ClockPort;
	readonly metrics: PerfMetricsPort;
	readonly trackParser: TrackParserPort;
	readonly tracks: TrackRepository;
	readonly places: PlaceRepository;
	readonly noteLinks: NoteLinkRepository;
	readonly indexMeta: IndexMetaRepository;
	dispose(): void;
}

/**
 * Assembles application ports with no-op infrastructure adapters.
 * Storage/parser production wiring: 0.1-09+; service facades: 0.1-08.
 */
export function createTrackdexContainer(
	_plugin: TrackdexPluginHost,
): TrackdexContainer {
	const disposers: Array<() => void> = [];

	return {
		logger: createNoopLoggerPort(),
		clock: createSystemClockPort(),
		metrics: createNoopMetricsPort(),
		trackParser: createNoopTrackParserPort(),
		tracks: createNoopTrackRepository(),
		places: createNoopPlaceRepository(),
		noteLinks: createNoopNoteLinkRepository(),
		indexMeta: createNoopIndexMetaRepository(),
		dispose(): void {
			for (const dispose of disposers) {
				dispose();
			}
			disposers.length = 0;
		},
	};
}
