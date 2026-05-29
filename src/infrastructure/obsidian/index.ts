export {registerTrackdexCommands, TRACKDEX_COMMAND_IDS} from "./commands-registry";
export {
	createObsidianVaultScanner,
	isVaultTrackFileCandidate,
	listTrackFilesFromCandidates,
	type VaultFileCandidate,
} from "./vault-scanner";
export { createObsidianVaultTrackFilePort } from "./vault-track-file";
export {
	registerVaultIndexEvents,
	resolveVaultTrackRenameEvents,
	shouldDispatchVaultTrackEvents,
	vaultPathBasename,
	type RegisterVaultIndexEventsDeps,
	type VaultTrackRenameInput,
} from "./vault-index-events";
