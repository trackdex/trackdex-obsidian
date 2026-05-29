import { Notice } from "obsidian";
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
	SqlStorageAdapter,
	createSqlIndexMetaRepository,
} from "../infrastructure/storage";
import {
	createNoopIndexMetaRepository,
	createNoopNoteLinkRepository,
	createNoopPlaceRepository,
	createNoopTrackRepository,
} from "../infrastructure/storage/stubs/noop-repositories";
import {
	createIndexingService,
	createLinkIndexService,
	createPlaceReindexService,
	createTrackQueryService,
	type IndexingService,
	type LinkIndexService,
	type PlaceReindexService,
	type TrackQueryService,
} from "../application/services";
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
	readonly indexing: IndexingService;
	readonly placeReindex: PlaceReindexService;
	readonly linkIndex: LinkIndexService;
	readonly trackQuery: TrackQueryService;
	dispose(): void;
}

/**
 * Assembles application ports; opens sql.js storage and runs migrations on bootstrap.
 * Track/place/link repositories remain no-op until milestone 0.2.
 */
export async function createTrackdexContainer(
	plugin: TrackdexPluginHost,
): Promise<TrackdexContainer> {
	const disposers: Array<() => void> = [];

	const logger = createNoopLoggerPort();
	const clock = createSystemClockPort();
	const metrics = createNoopMetricsPort();
	const trackParser = createNoopTrackParserPort();
	const tracks = createNoopTrackRepository();
	const places = createNoopPlaceRepository();
	const noteLinks = createNoopNoteLinkRepository();

	let indexMeta: IndexMetaRepository = createNoopIndexMetaRepository();
	let storage: SqlStorageAdapter | null = null;

	try {
		storage = new SqlStorageAdapter(plugin);
		await storage.open(logger);
		indexMeta = createSqlIndexMetaRepository(storage);
		disposers.push(() => {
			void storage?.close();
		});
	} catch (err: unknown) {
		const message = err instanceof Error ? err.message : String(err);
		logger.error("storage: bootstrap failed", { error: message });
		new Notice(
			"Trackdex could not open the local track index. Catalog features are limited until you reload the plugin.",
		);
		await storage?.close();
		storage = null;
	}

	const indexing = createIndexingService({ logger, indexMeta });
	const placeReindex = createPlaceReindexService({ logger, places });
	const linkIndex = createLinkIndexService({ logger, noteLinks });
	const trackQuery = createTrackQueryService(tracks);

	return {
		logger,
		clock,
		metrics,
		trackParser,
		tracks,
		places,
		noteLinks,
		indexMeta,
		indexing,
		placeReindex,
		linkIndex,
		trackQuery,
		dispose(): void {
			for (const dispose of disposers) {
				dispose();
			}
			disposers.length = 0;
		},
	};
}
