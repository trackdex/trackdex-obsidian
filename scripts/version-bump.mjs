import { readFileSync, writeFileSync } from "fs";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const targetVersion = process.env.npm_package_version;

const manifestPath = join(ROOT, "manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const { minAppVersion } = manifest;
manifest.version = targetVersion;
writeFileSync(manifestPath, JSON.stringify(manifest, null, "\t"));

const versionsPath = join(ROOT, "versions.json");
const versions = JSON.parse(readFileSync(versionsPath, "utf8"));
if (!Object.values(versions).includes(minAppVersion)) {
	versions[targetVersion] = minAppVersion;
	writeFileSync(versionsPath, JSON.stringify(versions, null, "\t"));
}
