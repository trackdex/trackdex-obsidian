import { spawnSync } from "node:child_process";
import { createWriteStream, existsSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { posix } from "node:path";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const OBSIDIAN_PACKAGE = "md.obsidian";
const OBSIDIAN_APK_VERSION = "1.12.7";
const DEFAULT_REMOTE_VAULT_PATH = "/sdcard/trackdex-dev-vault";
const DEFAULT_APK_URL = `https://github.com/obsidianmd/obsidian-releases/releases/download/v${OBSIDIAN_APK_VERSION}/Obsidian-${OBSIDIAN_APK_VERSION}.apk`;

const EXIT = {
	ADB_NOT_FOUND: 10,
	ADB_NOT_WORKING: 11,
	NO_DEVICES: 20,
	MULTIPLE_DEVICES: 21,
	OBSIDIAN_INSTALL_FAILED: 30,
	VAULT_SOURCE_MISSING: 40,
	DEPLOY_DEV_FAILED: 50,
	SYNC_FAILED: 70,
};

/** @type {{ adbPath: string; remotePath: string; apkUrl: string; skipDeployDev: boolean }} */
const options = {
	adbPath: process.env.ADB ?? "adb",
	remotePath: DEFAULT_REMOTE_VAULT_PATH,
	apkUrl: DEFAULT_APK_URL,
	skipDeployDev: false,
};

/** @type {string | null} */
let deviceSerial = null;

function parseCliArgs(argv) {
	for (let i = 2; i < argv.length; i++) {
		const arg = argv[i];
		if (arg === "--skip-deploy-dev") {
			options.skipDeployDev = true;
			continue;
		}
		if (arg === "--adb-path" && argv[i + 1]) {
			options.adbPath = argv[++i];
			continue;
		}
		if (arg === "--remote-path" && argv[i + 1]) {
			options.remotePath = argv[++i];
			continue;
		}
		if (arg === "--apk-url" && argv[i + 1]) {
			options.apkUrl = argv[++i];
			continue;
		}
		if (arg === "--help" || arg === "-h") {
			printUsage();
			process.exit(0);
		}
		console.error(`Unknown argument: ${arg}`);
		printUsage();
		process.exit(1);
	}
}

function printUsage() {
	console.log(`Usage: npm run deploy:android [-- options]

Options:
  --adb-path <path>       Path to adb (default: adb or $ADB)
  --remote-path <path>    Remote vault on device (default: ${DEFAULT_REMOTE_VAULT_PATH})
  --apk-url <url>         Obsidian APK URL if install is needed
  --skip-deploy-dev       Skip npm run deploy:dev before push
  -h, --help              Show this help
`);
}

function writeStep(message) {
	console.log(`[deploy:android] ${message}`);
}

function fail(message, code) {
	console.error(`[deploy:android] Error: ${message}`);
	process.exit(code);
}

function getPluginId() {
	const manifestPath = join(ROOT, "manifest.json");
	if (!existsSync(manifestPath)) {
		fail(`manifest.json not found at ${manifestPath}`, EXIT.SYNC_FAILED);
	}
	try {
		const { id } = JSON.parse(readFileSync(manifestPath, "utf8"));
		if (!id) {
			fail("manifest.json is missing plugin id.", EXIT.SYNC_FAILED);
		}
		return id;
	} catch (error) {
		fail(`Failed to parse manifest.json: ${error}`, EXIT.SYNC_FAILED);
	}
}

/**
 * @param {string[]} args
 * @returns {{ status: number | null; stdout: string; stderr: string; error: NodeJS.ErrnoException | null }}
 */
function spawnAdb(args) {
	const fullArgs = deviceSerial ? ["-s", deviceSerial, ...args] : args;
	const result = spawnSync(options.adbPath, fullArgs, {
		encoding: "utf8",
		maxBuffer: 50 * 1024 * 1024,
	});

	return {
		status: result.status,
		stdout: result.stdout ?? "",
		stderr: result.stderr ?? "",
		error: result.error ?? null,
	};
}

/**
 * @param {string[]} args
 * @returns {string}
 */
function runAdb(args) {
	const { status, stdout, stderr, error } = spawnAdb(args);

	if (error?.code === "ENOENT") {
		fail(
			"adb command not found. Install Android Platform Tools and add adb to PATH, or set --adb-path.",
			EXIT.ADB_NOT_FOUND,
		);
	}

	if (error) {
		fail(`adb failed: ${error.message}`, EXIT.ADB_NOT_WORKING);
	}

	if (status !== 0) {
		const detail = [stderr, stdout].filter(Boolean).join("\n").trim();
		fail(
			`adb ${args.join(" ")} failed (exit ${status})${detail ? `:\n${detail}` : ""}`,
			EXIT.SYNC_FAILED,
		);
	}

	return stdout;
}

function testAdbReady() {
	writeStep("Checking adb availability...");
	const { status, error } = spawnSync(options.adbPath, ["version"], { encoding: "utf8" });

	if (error?.code === "ENOENT") {
		fail(
			"adb command not found. Install Android Platform Tools and add adb to PATH, or set --adb-path.",
			EXIT.ADB_NOT_FOUND,
		);
	}

	if (error || status !== 0) {
		fail(`adb is present but not working: ${error?.message ?? `exit ${status}`}`, EXIT.ADB_NOT_WORKING);
	}
}

/**
 * @param {string} output
 * @returns {string[]}
 */
function parseAdbDevices(output) {
	return output
		.split(/\r?\n/)
		.slice(1)
		.map((line) => line.trim())
		.filter((line) => line.length > 0)
		.filter((line) => /\tdevice$/.test(line))
		.map((line) => line.split("\t")[0]);
}

function assertSingleDevice() {
	writeStep("Checking connected devices...");
	const output = runAdb(["devices"]);
	const devices = parseAdbDevices(output);

	if (devices.length === 0) {
		fail(
			"No device in 'device' state found. Connect one Android device and enable USB debugging.",
			EXIT.NO_DEVICES,
		);
	}

	if (devices.length > 1) {
		fail(
			`Expected exactly one device, found ${devices.length}: ${devices.join(", ")}. Disconnect extras or use adb disconnect.`,
			EXIT.MULTIPLE_DEVICES,
		);
	}

	deviceSerial = devices[0];
	writeStep(`Using device: ${deviceSerial}`);
}

function isObsidianInstalled() {
	const output = runAdb(["shell", "pm", "list", "packages", OBSIDIAN_PACKAGE]);
	return new RegExp(`package:${OBSIDIAN_PACKAGE}`).test(output);
}

async function downloadApk(url, destPath) {
	writeStep(`Downloading Obsidian APK from ${url} ...`);
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`HTTP ${response.status} ${response.statusText}`);
	}
	if (!response.body) {
		throw new Error("Empty response body");
	}
	await pipeline(response.body, createWriteStream(destPath));
}

async function installObsidianIfNeeded() {
	if (isObsidianInstalled()) {
		writeStep(`Obsidian package '${OBSIDIAN_PACKAGE}' already installed.`);
		return;
	}

	writeStep(`Obsidian package '${OBSIDIAN_PACKAGE}' is missing. Installing...`);
	const tempApk = join(tmpdir(), `obsidian-${OBSIDIAN_APK_VERSION}.apk`);

	try {
		await downloadApk(options.apkUrl, tempApk);
		writeStep("Installing Obsidian APK on device...");
		runAdb(["install", "-r", tempApk]);
	} catch (error) {
		fail(`Failed to download/install Obsidian APK: ${error}`, EXIT.OBSIDIAN_INSTALL_FAILED);
	} finally {
		if (existsSync(tempApk)) {
			rmSync(tempApk, { force: true });
		}
	}

	if (!isObsidianInstalled()) {
		fail(
			`Obsidian installation verification failed for package '${OBSIDIAN_PACKAGE}'.`,
			EXIT.OBSIDIAN_INSTALL_FAILED,
		);
	}

	writeStep("Obsidian installed successfully.");
}

function runDeployDev() {
	if (options.skipDeployDev) {
		writeStep("Skipping deploy:dev as requested.");
		return;
	}

	writeStep("Running deploy:dev (plugin into trackdex-dev-vault)...");
	const result = spawnSync(process.execPath, [join(ROOT, "scripts", "deploy.mjs"), "dev"], {
		cwd: ROOT,
		stdio: "inherit",
	});

	if (result.status !== 0) {
		fail("deploy:dev failed. Fix errors above and retry.", EXIT.DEPLOY_DEV_FAILED);
	}
}

function assertLocalVault() {
	const localVault = join(ROOT, "trackdex-dev-vault");
	if (!existsSync(localVault) || !statSync(localVault).isDirectory()) {
		fail(
			`Local dev vault not found: ${localVault}. Create it or run npm run deploy:dev first.`,
			EXIT.VAULT_SOURCE_MISSING,
		);
	}
	return localVault;
}

function syncVaultToDevice(localVault) {
	const remote = options.remotePath;
	writeStep(`Replacing remote vault at '${remote}'...`);

	runAdb(["shell", "rm", "-rf", remote]);
	runAdb(["shell", "mkdir", "-p", remote]);

	// Push each top-level entry. A single `adb push vault/. remote` on Windows creates
	// remote/trackdex-dev-vault/... instead of merging into remote/.
	const entries = readdirSync(localVault);
	if (entries.length === 0) {
		fail(`Local dev vault is empty: ${localVault}`, EXIT.VAULT_SOURCE_MISSING);
	}

	for (const name of entries) {
		const localPath = join(localVault, name);
		const remoteTarget = posix.join(remote, name);
		writeStep(`  push ${name} → ${remoteTarget}`);
		runAdb(["push", localPath, remoteTarget]);
	}
}

function warnIfPluginMissing(pluginId) {
	const remotePluginDir = posix.join(options.remotePath, ".obsidian", "plugins", pluginId);
	const { status, stdout, stderr } = spawnAdb(["shell", "ls", remotePluginDir]);

	if (status !== 0) {
		const detail = [stderr, stdout].filter(Boolean).join(" ").trim();
		console.warn(
			`[deploy:android] Warning: could not verify plugin at ${remotePluginDir}${detail ? ` (${detail})` : ""}. Run npm run build, then deploy:android again.`,
		);
		return;
	}

	const hasMain = stdout.includes("main.js");
	const hasManifest = stdout.includes("manifest.json");
	if (!hasMain || !hasManifest) {
		console.warn(
			`[deploy:android] Warning: plugin artifacts missing at ${remotePluginDir}. Run npm run build, then deploy:android again.`,
		);
	}
}

function printReport(localVault, pluginId) {
	const remotePluginPath = posix.join(options.remotePath, ".obsidian", "plugins", pluginId);
	console.log("");
	writeStep("Done.");
	console.log("");
	console.log(`  Device:       ${deviceSerial}`);
	console.log(`  Local vault:  ${localVault}`);
	console.log(`  Remote vault: ${options.remotePath}`);
	console.log("");
	console.log("  Open in Obsidian mobile: pick folder trackdex-dev-vault on internal storage.");
	console.log(`  Plugin path:  ${remotePluginPath}`);
	console.log("");
}

async function main() {
	parseCliArgs(process.argv);

	writeStep("Starting Android deploy...");
	runDeployDev();
	const localVault = assertLocalVault();
	testAdbReady();
	assertSingleDevice();
	await installObsidianIfNeeded();

	const pluginId = getPluginId();
	syncVaultToDevice(localVault);
	warnIfPluginMissing(pluginId);
	printReport(localVault, pluginId);
}

main().catch((error) => {
	fail(String(error), EXIT.SYNC_FAILED);
});
