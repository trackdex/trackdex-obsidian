import type { LoggerPort } from "application/ports/logger-port";
import type {
	VaultTrackEvent,
	VaultTrackEventHandlerPort,
} from "application/ports/vault-track-event-handler-port";

/** Logs vault track events until the incremental pipeline (0.3-09) is wired. */
export function createStubVaultTrackEventHandler(
	logger: LoggerPort,
): VaultTrackEventHandlerPort {
	const log = logger.child?.({ component: "vault-events" }) ?? logger;
	return {
		async handleVaultTrackEvent(event: VaultTrackEvent): Promise<void> {
			log.debug("vault track event (stub)", { kind: event.kind });
		},
	};
}
