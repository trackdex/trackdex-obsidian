# Trackdex

[![tests](https://img.shields.io/github/actions/workflow/status/trackdex/trackdex-obsidian/lint.yml?branch=main&label=tests)](https://github.com/trackdex/trackdex-obsidian/actions/workflows/lint.yml?query=branch%3Amain)

Trackdex — your track index. An Obsidian-based local catalog for GPX, FIT, and more.

Read-only catalog of GPX tracks in your Obsidian vault: browse files, view tracks on a map, filter by region, and see stats.

## Install

Copy `manifest.json`, `main.js`, and `styles.css` to `.obsidian/plugins/trackdex-obsidian/` in your vault, then enable the plugin in **Settings → Community plugins**.

## Development

```bash
npm install
npm run dev
```

Build for release: `npm run build`. Deploy to the local dev vault: `npm run deploy:dev`. Push the dev vault to a connected Android device: `npm run deploy:android`.

## Source layout (0.1-01)

Plugin source follows layered modules under `src/`:

- `composition/` — DI bootstrap (stub until milestone 0.1-07)
- `application/` — use-cases and ports (placeholders)
- `domain/` — pure business logic (placeholders)
- `infrastructure/` — map (Leaflet), parsers (GPX), storage, logging, Obsidian adapters (placeholders where not yet implemented)
- `ui/` — views, settings tab, components, i18n (placeholders for i18n)

Prototype code moved in 0.1-01: track view and registration (`ui/views/`), settings (`ui/settings/`), view helpers (`ui/components/`), map (`infrastructure/map/`), GPX parser (`infrastructure/parsers/gpx-parser.ts`).

Outside layers (unchanged): `src/constants.ts`, `src/styles/track-view.css`.

Prototype settings and demo commands were removed in **0.1-13**; v1 settings UI is planned for milestone **0.9**. No legacy re-export shims (`src/map`, `src/parsers`, etc.) — imports use the paths above.

## Releases

Obsidian installs plugin files from **GitHub Releases**; the release tag must match `version` in `manifest.json` (SemVer `x.y.z`, no `v` prefix).

1. If the release needs a newer Obsidian app, update `minAppVersion` in `manifest.json` first.
2. Bump and tag: `npm version patch` (or `minor` / `major`). This updates `package.json`, `manifest.json`, and `versions.json`, creates a commit, and tags the version (`.npmrc` disables the `v` prefix).
3. Push: `git push && git push --tags`. GitHub Actions builds the plugin and publishes a release with `main.js`, `manifest.json`, and `styles.css`, plus a release discussion.
4. Obsidian matches the tag to `manifest.version` when users install or update.

First-time listing in the community catalog: follow [Submit your plugin](https://docs.obsidian.md/Plugins/Releasing/Submit+your+plugin) (PR to [obsidian-releases](https://github.com/obsidianmd/obsidian-releases)).

## npm scripts

- `npm run dev` - dev-сборка плагина через `scripts/build.mjs`.
- `npm run build` - production-сборка: проверка TypeScript (`tsc` без emit), затем build-скрипт.
- `npm run test` - запуск базового smoke-теста через встроенный Node test runner.
- `npm run deploy` - деплой через `scripts/deploy.mjs`.
- `npm run deploy:dev` - деплой в dev-хранилище (`trackdex-dev-vault`).
- `npm version` (patch/minor/major) — lifecycle hook `version` runs `scripts/version-bump.mjs` and stages `manifest.json` / `versions.json`; do not call `npm run version` manually.
- `npm run deploy:android` - `deploy:dev`, затем push `trackdex-dev-vault` на устройство в `/sdcard/trackdex-dev-vault` (нужен `adb` в PATH, ровно одно USB-устройство с отладкой; при отсутствии Obsidian — скачивание и установка APK).
- `npm run version` - bump версии через `scripts/version-bump.mjs` + `git add manifest.json versions.json`.
- `npm run lint` - запуск ESLint по проекту.

## License

MIT — see [LICENSE](LICENSE).
