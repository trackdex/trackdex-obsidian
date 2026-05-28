# Trackdex

Read-only catalog of GPX tracks in your Obsidian vault: browse files, view tracks on a map, filter by region, and see stats.

## Install

Copy `manifest.json`, `main.js`, and `styles.css` to `.obsidian/plugins/trackdex-obsidian/` in your vault, then enable the plugin in **Settings → Community plugins**.

## Development

```bash
npm install
npm run dev
```

Build for release: `npm run build`. Deploy to the local dev vault: `npm run deploy:dev`.

## Source layout (0.1-01)

Plugin source follows layered modules under `src/`:

- `composition/` — DI bootstrap (stub until milestone 0.1-07)
- `application/` — use-cases and ports (placeholders)
- `domain/` — pure business logic (placeholders)
- `infrastructure/` — map (Leaflet), parsers (GPX), storage, logging, Obsidian adapters (placeholders where not yet implemented)
- `ui/` — views, settings tab, components, i18n (placeholders for i18n)

Prototype code moved in 0.1-01: track view and registration (`ui/views/`), settings (`ui/settings/`), view helpers (`ui/components/`), map (`infrastructure/map/`), GPX parser (`infrastructure/parsers/gpx-parser.ts`).

Outside layers (unchanged): `src/constants.ts`, `src/styles/track-view.css`.

Legacy prototype settings and demo commands remain until milestone **0.1-13**. No legacy re-export shims (`src/map`, `src/parsers`, etc.) — imports use the paths above.

## npm scripts

- `npm run dev` - dev-сборка плагина через `scripts/build.mjs`.
- `npm run build` - production-сборка: проверка TypeScript (`tsc` без emit), затем build-скрипт.
- `npm run test` - запуск базового smoke-теста через встроенный Node test runner.
- `npm run deploy` - деплой через `scripts/deploy.mjs`.
- `npm run deploy:dev` - деплой в dev-хранилище (`trackdex-dev-vault`).
- `npm run version` - bump версии через `scripts/version-bump.mjs` + `git add manifest.json versions.json`.
- `npm run lint` - запуск ESLint по проекту.

## License

MIT — see [LICENSE](LICENSE).
