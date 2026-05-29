import type { ClockPort } from "application/ports/clock-port";
import type { IndexResetPort } from "application/ports/index-reset-port";
import type { LoggerPort } from "application/ports/logger-port";
import type { PerfMetricsPort } from "application/ports/metrics-port";
import type { TrackParserPort } from "application/ports/parser-port";
import type {
	IndexMetaRepository,
	NoteLinkRepository,
	PlaceRepository,
	TrackRepository,
} from "application/ports/repositories";
import { Platform } from "obsidian";
import { resetIndex as runResetIndex } from "application/workflows/reset-index";
import type { VaultTrackEventHandlerPort } from "application/ports/vault-track-event-handler-port";
import { createFullScanWorkQueue } from "application/workflows/full-scan";
import { createIncrementalVaultTrackEventHandler } from "application/workflows/incremental-index";
import { createRotatingFileLoggerHandle } from "../infrastructure/logging";
import { createNoopMetricsPort } from "../infrastructure/logging/noop-metrics-port";
import { createSystemClockPort } from "../infrastructure/logging/system-clock-port";
import { createObsidianVaultScanner } from "../infrastructure/obsidian/vault-scanner";
import { createObsidianVaultTrackFilePort } from "../infrastructure/obsidian/vault-track-file";
import { createIndexTrackFileJob } from "../application/workflows/index-track-file";
import { createDefaultParserRouter } from "../infrastructure/parsers/parser-router";
import {
	SqlStorageAdapter,
	createSqlIndexMetaRepository,
	createSqlIndexResetPort,
	createSqlNoteLinkRepository,
	createSqlPlaceRepository,
	createSqlTrackRepository,
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
	readonly vaultTrackHandler: VaultTrackEventHandlerPort;
	resetIndex(): Promise<void>;
	/** Clears in-memory scan state and releases resources. Interrupt flag is write-ahead persisted in beginScanRun. */
	shutdown(): void;
	dispose(): void;
}

/**
 * Assembles application ports; opens sql.js storage, runs migrations, and wires SQL repositories.
 */
export async function createTrackdexContainer(
	plugin: TrackdexPluginHost,
): Promise<TrackdexContainer> {
	const disposers: Array<() => void> = [];

	const loggerHandle = createRotatingFileLoggerHandle(plugin);
	const logger = loggerHandle.port;
	const flushLogger = (): Promise<void> => loggerHandle.flush();
	const clock = createSystemClockPort();
	const metrics = createNoopMetricsPort();
	const trackParser = createDefaultParserRouter();

	let tracks: TrackRepository = createNoopTrackRepository();
	let places: PlaceRepository = createNoopPlaceRepository();
	let noteLinks: NoteLinkRepository = createNoopNoteLinkRepository();
	let indexMeta: IndexMetaRepository = createNoopIndexMetaRepository();
	let indexReset: IndexResetPort | null = null;
	let storage: SqlStorageAdapter | null = null;

	try {
		storage = new SqlStorageAdapter(plugin);
		await storage.open(logger);
		tracks = createSqlTrackRepository(storage);
		places = createSqlPlaceRepository(storage);
		noteLinks = createSqlNoteLinkRepository(storage);
		indexMeta = createSqlIndexMetaRepository(storage);
		indexReset = createSqlIndexResetPort(storage);
		disposers.push(() => {
			void storage?.close();
		});
		logger.info("storage: repositories wired");
	} catch (err: unknown) {
		const message = err instanceof Error ? err.message : String(err);
		logger.error("storage: bootstrap failed", { error: message });
		await storage?.close();
		storage = null;
	}

	const fullScanQueue = createFullScanWorkQueue({
		isMobile: Platform.isMobileApp,
	});

	const vaultTrackFile = createObsidianVaultTrackFilePort(plugin.app);
	const indexTrackFile = createIndexTrackFileJob({
		tracks,
		trackParser,
		vaultTrackFile,
		clock,
		logger,
	});

	const indexing = createIndexingService({
		logger,
		indexMeta,
		tracks,
		clock,
		queue: fullScanQueue,
		createScanner: () =>
			createObsidianVaultScanner(plugin.app, {
				scanExcludePatterns: plugin.settings.scanExcludePatterns,
			}),
		indexTrackFile,
	});
	const placeReindex = createPlaceReindexService({ logger, places });
	const linkIndex = createLinkIndexService({ logger, noteLinks });
	const trackQuery = createTrackQueryService(tracks);

	const vaultTrackHandler = createIncrementalVaultTrackEventHandler({
		tracks,
		queue: fullScanQueue,
		indexTrackFile,
		isScanPaused: async () => (await indexMeta.get()).scanPaused,
		logger,
	});

	const resetIndex = async (): Promise<void> => {
		if (!indexReset) {
			throw new Error("Trackdex: index reset unavailable (storage not open)");
		}
		await runResetIndex({ indexReset, indexMeta });
	};

	const dispose = (): void => {
		logger.info("lifecycle: container dispose");
		for (const runDispose of disposers) {
			runDispose();
		}
		disposers.length = 0;
		void flushLogger();
	};

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
		vaultTrackHandler,
		resetIndex,
		shutdown(): void {
			indexing.markInterruptedIfScanActive();
			dispose();
		},
		dispose,
	};
}
