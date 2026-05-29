import type { EnqueueFullScan } from "application/services/indexing-service";
import type { IndexMetaRepository } from "application/ports/repositories";
import type { LoggerPort } from "application/ports/logger-port";

export interface ResumeAfterInterruptDeps {
	readonly indexMeta: IndexMetaRepository;
	readonly enqueueFullScan?: EnqueueFullScan;
	readonly logger?: LoggerPort;
}

/** Clears interrupted marker and re-enqueues full scan (§7.1; 0.3-08 wires real workflow). */
export async function resumeAfterInterrupt(
	deps: ResumeAfterInterruptDeps,
): Promise<void> {
	const meta = await deps.indexMeta.get();
	if (!meta.lastRunInterrupted) {
		return;
	}
	await deps.indexMeta.update({ lastRunInterrupted: false });
	const log = deps.logger?.child?.({ workflow: "resume-after-interrupt" }) ?? deps.logger;
	log?.info("resumed after interrupted indexing run");
	if (deps.enqueueFullScan) {
		await deps.enqueueFullScan();
	} else {
		log?.info("enqueueFullScan not wired (0.3-08)");
	}
}
