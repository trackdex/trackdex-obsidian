# Trackdex

Read-only catalog of GPX tracks in your Obsidian vault: browse files, view tracks on a map, filter by region, and see stats.

## Install

Copy `manifest.json`, `main.js`, and `styles.css` to `.obsidian/plugins/trackdex-obsidian/` in your vault, then enable the plugin in **Settings → Community plugins**.

## Plugin data (local storage)

Trackdex keeps its index and logs under the Obsidian plugin data directory (not in your note files):

| Artifact | Path (relative to vault root) |
| --- | --- |
| Plugin data dir | `.obsidian/plugins/trackdex-obsidian/` |
| Track index (SQLite) | `.obsidian/plugins/trackdex-obsidian/index.sqlite` |
| Indexing logs | `.obsidian/plugins/trackdex-obsidian/logs/` |

The active log file is `trackdex.log`. When it reaches 1 MB, it rotates to `trackdex.log.1`, then `trackdex.log.2`, and so on, keeping at most **5 files × 1 MB** (~5 MB total). Older segments are deleted. Logs are JSON lines on disk only; the plugin does not upload them.

### Vault sync

The plugin data directory may be included in vault sync (Obsidian Sync, git, Dropbox, etc.) depending on your setup. Trackdex does not automatically exclude `index.sqlite` or logs from sync.

- **Single writer:** Treat `index.sqlite` as one device at a time. Concurrent writes from two devices (for example two desktops syncing the same vault) can corrupt SQLite. On a new device, expect to reindex rather than merge index files.
- **Sync traffic:** The index grows with your GPX catalog; logs are capped by rotation but still sync if the plugin folder syncs.
- **Backups:** Include `.obsidian/plugins/trackdex-obsidian/` in vault backups if you want to preserve the index; deleting that folder forces a full reindex.

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

## npm scripts

- `npm run dev` - dev-сборка плагина через `scripts/build.mjs`.
- `npm run build` - production-сборка: проверка TypeScript (`tsc` без emit), затем build-скрипт.
- `npm run test` - запуск базового smoke-теста через встроенный Node test runner.
- `npm run deploy` - деплой через `scripts/deploy.mjs`.
- `npm run deploy:dev` - деплой в dev-хранилище (`trackdex-dev-vault`).
- `npm run deploy:android` - `deploy:dev`, затем push `trackdex-dev-vault` на устройство в `/sdcard/trackdex-dev-vault` (нужен `adb` в PATH, ровно одно USB-устройство с отладкой; при отсутствии Obsidian — скачивание и установка APK).
- `npm run version` - bump версии через `scripts/version-bump.mjs` + `git add manifest.json versions.json`.
- `npm run lint` - запуск ESLint по проекту.

## License

MIT — see [LICENSE](LICENSE).
