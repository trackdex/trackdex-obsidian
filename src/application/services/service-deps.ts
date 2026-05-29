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

/** Ports injected into application service facades (composition wires implementations). */
export interface TrackdexServiceDeps {
	readonly logger: LoggerPort;
	readonly clock: ClockPort;
	readonly metrics: PerfMetricsPort;
	readonly trackParser: TrackParserPort;
	readonly tracks: TrackRepository;
	readonly places: PlaceRepository;
	readonly noteLinks: NoteLinkRepository;
	readonly indexMeta: IndexMetaRepository;
}
