import type {
	PerfCounterName,
	PerfMetricsPort,
	PerfRunRecord,
} from "application/ports/metrics-port";

/** No-op metrics until perf-report storage lands in 0.10. */
export function createNoopMetricsPort(): PerfMetricsPort {
	return {
		recordRun(_record: PerfRunRecord): void {},
		incrementCounter(_name: PerfCounterName, _delta?: number): void {},
		startTimer(_operation: string, _context?: PerfRunRecord["context"]) {
			return (_outcome: {
				success: boolean;
				itemsCount?: number;
				runId?: string;
			}): void => {};
		},
	};
}
