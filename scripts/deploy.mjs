import { copyFileSync, existsSync, mkdirSync, readFileSync } from "fs";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const ARTIFACTS = ["manifest.json", "main.js", "styles.css"];

const TARGETS = {
	dev: {
		description: "Install plugin into trackdex-dev-vault (desktop testing)",
		vaultDir: join(ROOT, "trackdex-dev-vault"),
	},
};

function printUsage() {
	console.log("Available deploy targets:\n");
	for (const [name, { description }] of Object.entries(TARGETS)) {
		console.log(`  ${name}  — ${description}`);
	}
	console.log("\nUsage: npm run deploy:<target>");
	console.log("Example: npm run deploy:dev");
}

function getPluginId() {
	const manifestPath = join(ROOT, "manifest.json");
	if (!existsSync(manifestPath)) {
		console.error("manifest.json not found in project root.");
		process.exit(1);
	}
	const { id } = JSON.parse(readFileSync(manifestPath, "utf8"));
	if (!id) {
		console.error("manifest.json is missing plugin id.");
		process.exit(1);
	}
	return id;
}

function deployDev() {
	const { vaultDir } = TARGETS.dev;
	if (!existsSync(vaultDir)) {
		console.error(`Dev vault not found: ${vaultDir}`);
		process.exit(1);
	}

	const missing = ARTIFACTS.filter((file) => !existsSync(join(ROOT, file)));
	if (missing.length > 0) {
		console.error(`Missing release artifacts: ${missing.join(", ")}`);
		console.error("Run npm run build to generate main.js, then retry.");
		process.exit(1);
	}

	const pluginId = getPluginId();
	const pluginDir = join(vaultDir, ".obsidian", "plugins", pluginId);
	mkdirSync(pluginDir, { recursive: true });

	for (const file of ARTIFACTS) {
		const from = join(ROOT, file);
		const to = join(pluginDir, file);
		copyFileSync(from, to);
		console.log(`  ${file} → ${to}`);
	}

	console.log(`\nInstalled to ${pluginDir}`);
	console.log("Reload Obsidian and enable the plugin in Settings → Community plugins.");
}

const target = process.argv[2];

if (!target) {
	printUsage();
	process.exit(0);
}

if (!(target in TARGETS)) {
	console.error(`Unknown deploy target: ${target}\n`);
	printUsage();
	process.exit(1);
}

if (target === "dev") {
	console.log(`Deploying to ${TARGETS.dev.vaultDir} …\n`);
	deployDev();
}
