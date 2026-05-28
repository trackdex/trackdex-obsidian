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

## npm scripts

- `npm run dev` - dev-сборка плагина через `scripts/build.mjs`.
- `npm run build` - production-сборка: проверка TypeScript (`tsc` без emit), затем build-скрипт.
- `npm run test` - запуск базового smoke-теста через встроенный Node test runner.
- `npm run deploy` - деплой через `scripts/deploy.mjs`.
- `npm run deploy:dev` - деплой в dev-режиме (`scripts/deploy.mjs dev`).
- `npm run version` - bump версии через `scripts/version-bump.mjs` + `git add manifest.json versions.json`.
- `npm run lint` - запуск ESLint по проекту.

## License

MIT — see [LICENSE](LICENSE).
