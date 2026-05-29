#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const mdDir = path.join(root, "docs", "milestones");

/** @typedef {{ slug: string, title: string, type: string, goal: string, deps: string[], scope: string[], out: string[], crit: string[], art: string[], blocks?: string[] }} Task */

/**
 * @param {string} version
 * @param {number} num
 * @param {Task} t
 * @param {string} milestoneName
 */
function renderTask(version, num, t, milestoneName) {
  const id = `${version}-${String(num).padStart(2, "0")}`;
  const depsBlock =
    t.deps.length === 0
      ? "Нет (стартовая задача milestone или prerequisite из предыдущего milestone)."
      : t.deps.map((d) => `- **${d}**`).join("\n");
  const blocksSec = t.blocks?.length
    ? `\n## Блокирует\n\n${t.blocks.map((b) => `- **${b}**`).join("\n")}\n`
    : "";
  return `# ${id} — ${t.title}

**Milestone:** ${version} — ${milestoneName}  
**Тип:** ${t.type}

## Цель

${t.goal}

## Зависимости

${depsBlock}

## Объём работ

${t.scope.map((s) => `- ${s}`).join("\n")}

## Вне scope

${t.out.map((s) => `- ${s}`).join("\n")}

## Условия завершения

${t.crit.map((c) => `- [ ] ${c}`).join("\n")}

## Артефакты

${t.art.map((a) => `- ${a}`).join("\n")}
${blocksSec}`;
}

/** @param {Task} t */
const T = (slug, title, type, goal, deps, scope, out, crit, art, blocks) => ({
  slug,
  title,
  type,
  goal,
  deps,
  scope,
  out,
  crit,
  art,
  blocks,
});

/** @type {Array<{ version: string, name: string, goal: string, done: string[], gates?: string[], prereqSection: string, mermaid: string, tasks: Task[] }>} */
const MILESTONES = [
  {
    version: "0.2",
    name: "Storage schema and indexing meta",
    goal:
      "подготовить персистентное хранилище: схема v1, миграции, meta, репозитории, ротируемые логи.",
    done: [
      "`npm run build` и тесты проходят.",
      "Fresh vault → schema v1; upgrade path работает.",
      "Reset index — только service data.",
      "Desktop/mobile storage smoke PASS.",
      "README: data dir, sync, logs.",
    ],
    gates: ["**0.3 разблокирован:** репозитории и index_meta для scan."],
    prereqSection: "### Prerequisite\n\n- Milestone **0.1** complete (**0.1-14** PASS).",
    mermaid: `flowchart TD
  T01[0.2-01 DDL] --> T02[0.2-02 Migration]
  T02 --> T03[0.2-03 Meta]
  T02 --> T04[0.2-04 Tracks]
  T02 --> T05[0.2-05 Places links]
  T04 --> T06[0.2-06 Indexes]
  T07[0.2-07 Logs] --> T09[0.2-09 Wire]
  T03 --> T09
  T04 --> T09
  T05 --> T09
  T08[0.2-08 Reset] --> T09
  T09 --> T11[0.2-11 Smoke]
  T11 --> T12[0.2-12 Acceptance]`,
    tasks: [
      T(
        "v1-logical-schema-ddl",
        "Логическая схема v1 (DDL)",
        "infrastructure / storage",
        "Таблицы `tracks`, `places`, `track_places`, `note_track_links`, `index_meta` per `docs/TECHNICAL_DESIGN.md` §6.1.",
        ["0.1-14", "0.1-09"],
        [
          "DDL всех полей §6.1 с CHECK/constraints.",
          "Path-based PK; FK-семантика документирована.",
        ],
        ["Данные scan/parser (**0.3**, **0.4**).", "Rotating logs (**0.2-07**)."],
        [
          "Идемпотентное создание схемы на fresh install.",
          "Поля metrics/segments/flags соответствуют §6.1.",
          "`npm run build` проходит.",
        ],
        ["`src/infrastructure/storage/migrations/v1-schema.ts`"],
        ["0.2-02"],
      ),
      T(
        "migration-v1-runner",
        "Миграция v1 и runner",
        "infrastructure / storage",
        "Migration v0→v1, transactional runner on каждом `onload` per §6.2.",
        ["0.2-01"],
        [
          "`schema_version` в `index_meta`.",
          "Транзакция apply + bump version.",
          "Logger: migration start/end/error; Notice при fatal error.",
        ],
        ["Миграции v2+."],
        [
          "Fresh DB: v1 применяется один раз.",
          "Повторный onload: no-op.",
          "Simulated failure не портит user data.",
        ],
        ["`migrations/v1.ts`", "migration tests"],
        ["0.2-03", "0.2-09"],
      ),
      T(
        "index-meta-repository",
        "Index meta repository",
        "infrastructure / storage",
        "Персист `first_scan_approved`, `scan_paused`, `last_full_scan_at_utc`, `last_run_interrupted`, `schema_version`.",
        ["0.2-02"],
        ["`IndexMetaRepository` port implementation.", "Defaults per §7.1."],
        ["First-scan UX (**0.3-06**)."],
        ["Все required keys round-trip.", "Unit/integration test."],
        ["`index-meta-repository.ts`"],
        ["0.2-09", "0.3-06"],
      ),
      T(
        "track-repository-crud",
        "Track repository (CRUD)",
        "infrastructure / storage",
        "CRUD/query `tracks` для scan и parser pipeline.",
        ["0.2-02"],
        [
          "insert/update/delete/getByPath/listByStatus.",
          "Rename path policy (atomic update or documented remap).",
        ],
        ["Catalog aggregations (**0.6**)."],
        ["CRUD tests.", "Status enum enforced."],
        ["`track-repository.ts`"],
        ["0.2-06", "0.3-04"],
      ),
      T(
        "place-link-repositories",
        "Place и note–track repositories",
        "infrastructure / storage",
        "CRUD `places`, `track_places`, `note_track_links` per §6.1.",
        ["0.2-02"],
        ["Three repository implementations.", "Track delete cascades relations."],
        ["Geometry match (**0.7**).", "Markdown links (**0.8**)."],
        ["Tests per table."],
        [
          "`place-repository.ts`",
          "`track-place-repository.ts`",
          "`note-track-link-repository.ts`",
        ],
        ["0.2-06"],
      ),
      T(
        "query-indexes",
        "Query indexes",
        "infrastructure / storage",
        "Индексы §6.1 для catalog, scan, place/link queries.",
        ["0.2-01", "0.2-04", "0.2-05"],
        ["Все индексы из §6.1 в migration v1."],
        [],
        ["Индексы создаются вместе с v1 migration."],
        ["DDL/index section in v1 migration"],
      ),
      T(
        "rotating-file-logs",
        "Ротируемые файловые логи",
        "infrastructure / logging",
        "Логи в plugin data dir, ротация `5 × 1 MB` per REQUIREMENTS / §13.",
        ["0.1-02", "0.1-07"],
        [
          "File logger adapter (Logger port).",
          "Events: scan, parse error, migration, lifecycle.",
        ],
        ["Remote log shipping."],
        ["Max 5 files × 1 MB.", "No vault file writes."],
        ["`src/infrastructure/logging/file-logger.ts`"],
        ["0.2-09"],
      ),
      T(
        "reset-index-behavior",
        "Reset index (только service data)",
        "application",
        "Use case: очистка index tables/meta без изменения трек-файлов vault.",
        ["0.2-03", "0.2-04", "0.2-05"],
        [
          "`reset-index` workflow.",
          "Document: что удаляется / что сохраняется.",
        ],
        ["Confirmation modal (**0.9-06**)."],
        [
          "После reset schema intact.",
          "Vault track files untouched (mtime test).",
        ],
        ["`src/application/workflows/reset-index.ts`"],
        ["0.2-09"],
      ),
      T(
        "wire-repositories-container",
        "Подключить репозитории в контейнер",
        "composition",
        "Заменить storage stubs **0.1-08** реальными repos + file logger.",
        ["0.2-03", "0.2-04", "0.2-05", "0.2-07", "0.2-08"],
        ["`composition/container.ts` wiring.", "DB close on unload."],
        [],
        [
          "onload: open → migrate → live repos.",
          "sql.js only under `infrastructure/storage/**`.",
        ],
        ["Updated `container.ts`"],
        ["0.2-11", "0.3"],
      ),
      T(
        "readme-plugin-data-dir",
        "README: data dir, sync, logs",
        "документация",
        "Раздел README: `index.sqlite`, logs path, vault sync cautions.",
        ["0.2-07", "0.2-09"],
        ["`README.md` section with paths and rotation policy."],
        ["Release packaging (**0.10**)."],
        ["Нет TBD по storage paths."],
        ["`README.md`"],
      ),
      T(
        "storage-desktop-mobile-smoke",
        "Smoke: storage desktop/mobile",
        "QA / evidence",
        "CRUD + migration startup на desktop и mobile (≥1 платформа).",
        ["0.2-09"],
        [
          "`docs/milestones/0.2/evidence/storage-schema-smoke.md`.",
          "Fresh install, reload, CRUD track row.",
        ],
        ["Perf baseline (**0.10**)."],
        ["Desktop PASS dated.", "Mobile PASS or documented blocker."],
        ["`evidence/storage-schema-smoke.md`"],
        ["0.2-12"],
      ),
    ],
  },
  {
    version: "0.3",
    name: "Scan engine and file status pipeline",
    goal:
      "полный/инкрементальный scan vault, машина состояний файлов, first-scan consent и recovery прерванного прогона.",
    done: [
      "Статусы корректны при create/modify/delete/rename.",
      "Прерванная индексация детектируется; recovery через явное действие.",
      "UI отзывчив (bounded concurrency + yield).",
    ],
    gates: ["**0.4 разблокирован:** scan может ставить parse jobs в очередь."],
    prereqSection: "### Prerequisite\n\n- Milestone **0.2** complete (**0.2-12** PASS).",
    mermaid: `flowchart TD
  T01[0.3-01 Scanner] --> T02[0.3-02 Excludes]
  T02 --> T08[0.3-08 Full scan]
  T03[0.3-03 Queue] --> T08
  T04[0.3-04 State machine] --> T08
  T05[0.3-05 Events] --> T09[0.3-09 Incremental]
  T08 --> T09
  T06[0.3-06 First scan] --> T08
  T08 --> T11[0.3-11 Indexing service]
  T09 --> T11
  T10[0.3-10 Progress] --> T11
  T11 --> T12[0.3-12 Acceptance]`,
    tasks: [
      T(
        "vault-recursive-scanner",
        "Рекурсивный scanner vault",
        "infrastructure / obsidian",
        "Discovery `.gpx`, `.tcx`, `.fit`, `.fit.gz` case-insensitive per §7.2.",
        ["0.2-12"],
        ["`VaultScanner` port + adapter.", "Vault-relative normalized paths."],
        ["Parsing (**0.4**)."],
        ["Fixture listing tests.", "Case variants matched."],
        ["`vault-scanner.ts`"],
        ["0.3-02", "0.3-08"],
      ),
      T(
        "scan-exclude-patterns",
        "Exclude patterns",
        "application / indexing",
        "Default `.obsidian/**`, `.trash/**` + user globs.",
        ["0.3-01"],
        ["Exclude matcher.", "Read settings (defaults until **0.9-03** UI)."],
        ["Settings tab polish (**0.9**)."],
        ["Tests: default + user pattern."],
        ["`exclude-matcher.ts`"],
      ),
      T(
        "bounded-work-queue",
        "Очередь с bounded concurrency",
        "application / indexing",
        "Concurrency 2 desktop / 1 mobile; micro-batch yield §7.2.",
        ["0.2-12"],
        ["Work queue with cap.", "Yield between batches."],
        [],
        ["Concurrency never exceeds cap.", "UI thread not blocked (manual/timer)."],
        ["`work-queue.ts`"],
        ["0.3-08"],
      ),
      T(
        "file-state-machine",
        "Машина состояний файла",
        "domain / application",
        "Transitions per §7.3: pending/indexing/indexed/stale/error.",
        ["0.2-04"],
        ["Domain transition rules.", "Delete/rename flows."],
        ["Parser error details (**0.4**)."],
        ["Table-driven transition tests."],
        ["`src/domain/track/file-status.ts`"],
        ["0.3-08", "0.3-09"],
      ),
      T(
        "vault-event-listeners",
        "Слушатели vault events",
        "infrastructure / obsidian",
        "`create/modify/delete/rename` → incremental jobs; respect `scan_paused`.",
        ["0.3-04", "0.3-03"],
        ["registerEvent adapters.", "Extension filter."],
        ["Place/note listeners (**0.7**, **0.8**)."],
        ["Rename updates path.", "Paused ignores events."],
        ["`vault-index-events.ts`"],
        ["0.3-09"],
      ),
      T(
        "first-scan-consent-ux",
        "UX первого скана (consent)",
        "UI",
        "No auto-scan until `first_scan_approved`; CTA per REQ-001.",
        ["0.2-03", "0.1-12"],
        ["`empty-state-first-scan` component.", "Approve → meta + full scan."],
        ["Full settings (**0.9**)."],
        ["Fresh plugin: no scan until confirm.", "Meta persisted after approve."],
        ["`empty-state-first-scan.ts`"],
        ["0.3-08"],
      ),
      T(
        "interrupted-run-banner",
        "Баннер прерванной индексации",
        "UI",
        "`last_run_interrupted` → banner + «проверить и продолжить».",
        ["0.2-03"],
        ["Set flag on unsafe shutdown.", "Resume action."],
        [],
        ["Interrupt → banner on reload.", "Resume clears flag."],
        ["`interrupted-run-banner.ts`"],
      ),
      T(
        "full-scan-workflow",
        "Workflow полного скана",
        "application / workflow",
        "Discover → pending → queue jobs; wire `scan-or-resume-indexing`.",
        ["0.3-01", "0.3-02", "0.3-03", "0.3-04", "0.3-06"],
        ["`runFullScan` use case.", "Update `last_full_scan_at_utc`."],
        ["Production parser (**0.4-11**)."],
        ["Command runs on test vault.", "Statuses in DB."],
        ["`full-scan.ts`"],
        ["0.3-11"],
      ),
      T(
        "incremental-pipeline",
        "Инкрементальный pipeline",
        "application / workflow",
        "Events → state machine + queue; avoid full rescan when possible.",
        ["0.3-05", "0.3-08"],
        ["create/modify/delete handlers."],
        [],
        ["Integration: add file → pending; delete → row gone."],
        ["`incremental-index.ts`"],
      ),
      T(
        "scan-progress-model",
        "Модель прогресса для UI",
        "application",
        "Progress store: totals, current file, «processing large file» flag.",
        ["0.3-03"],
        ["Observable progress without DOM in application."],
        ["Progress panel UI (**0.9-08**)."],
        ["Counters update during full scan."],
        ["`scan-progress.ts`"],
        ["0.3-11", "0.9-08"],
      ),
      T(
        "indexing-service-integration",
        "Indexing service (интеграция)",
        "application / service",
        "Facade: scan, queue, state, meta, progress; pause support.",
        ["0.3-08", "0.3-09", "0.3-10"],
        ["`IndexingService` for commands/events."],
        [],
        ["E2E test vault scan → DB statuses.", "`npm test` green."],
        ["`indexing-service.ts`"],
        ["0.3-12", "0.4-11"],
      ),
    ],
  },
  {
    version: "0.4",
    name: "Parser normalization and computed metrics",
    goal:
      "парсинг GPX/TCX/FIT/FIT.GZ в unified model, детерминированные метрики, polyline/bbox, cleanup FIT spike.",
    done: [
      "Fixture tests valid/partial/invalid.",
      "Stable metrics on reindex.",
      "Explicit missing data flags.",
      "No `@garmin-fit/sdk` in package.json.",
    ],
    gates: ["**0.5 разблокирован:** indexed tracks с метриками для track view."],
    prereqSection:
      "### Prerequisite\n\n- **0.1-06** FIT gate closed.\n- Milestone **0.3** complete (**0.3-12** PASS).",
    mermaid: `flowchart TD
  T01[0.4-01 Router] --> T02[0.4-02 GPX]
  T01 --> T03[0.4-03 TCX]
  T01 --> T04[0.4-04 FIT]
  T01 --> T05[0.4-05 FIT.GZ]
  T02 --> T06[0.4-06 Normalize TZ]
  T03 --> T06
  T04 --> T06
  T05 --> T06
  T06 --> T07[0.4-07 Metrics]
  T07 --> T08[0.4-08 Multi-segment]
  T08 --> T09[0.4-09 Data flags]
  T09 --> T10[0.4-10 Polyline bbox]
  T10 --> T11[0.4-11 Pipeline]
  T11 --> T12[0.4-12 Fixtures]
  T12 --> T13[0.4-13 FIT cleanup]
  T13 --> T14[0.4-14 Acceptance]`,
    tasks: [
      T(
        "parser-router",
        "Parser router",
        "infrastructure / parsers",
        "Router по расширению → `TrackParserPort` implementation.",
        ["0.3-12", "0.1-06"],
        ["`parser-router.ts` behind port.", "Extension case-insensitive."],
        [],
        ["Routes .gpx/.tcx/.fit/.fit.gz.", "Unknown ext → typed error."],
        ["`parser-router.ts`"],
        ["0.4-02", "0.4-03", "0.4-04", "0.4-05"],
      ),
      T(
        "gpx-parser",
        "GPX parser",
        "infrastructure / parsers",
        "GPX → intermediate `ParsedTrack` model.",
        ["0.4-01"],
        ["`gpx-parser.ts` adapter.", "Representative fixtures."],
        [],
        ["Valid GPX fixture parses.", "Malformed → error model."],
        ["`gpx-parser.ts`"],
      ),
      T(
        "tcx-parser",
        "TCX parser",
        "infrastructure / parsers",
        "TCX → `ParsedTrack`.",
        ["0.4-01"],
        ["`tcx-parser.ts`."],
        [],
        ["TCX fixture tests."],
        ["`tcx-parser.ts`"],
      ),
      T(
        "fit-parser",
        "FIT parser (fit-file-parser)",
        "infrastructure / parsers",
        "`.fit` via `fit-file-parser` per §2.5; runtime dependency in bundle.",
        ["0.4-01", "0.1-06"],
        ["`fit-parser.ts`.", "Move `fit-file-parser` to dependencies."],
        ["Garmin SDK path."],
        ["`.fit` fixture → ParsedTrack.", "Bundle measure documented."],
        ["`fit-parser.ts`"],
      ),
      T(
        "fit-gz-parser",
        "FIT.GZ parser",
        "infrastructure / parsers",
        "`.fit.gz`: `DecompressionStream` + FIT parse.",
        ["0.4-04"],
        ["`fit-gz-parser.ts` or shared gunzip helper."],
        ["Node zlib."],
        ["`.fit.gz` fixture tests."],
        ["`fit-gz-parser.ts`"],
      ),
      T(
        "timestamp-timezone-normalization",
        "Нормализация timestamps/timezones",
        "domain",
        "Rules §8–9: explicit/indexing_local/unknown; raw + UTC fields.",
        ["0.4-02", "0.4-03", "0.4-04", "0.4-05"],
        ["Domain normalization service.", "timezone_source enum."],
        [],
        ["Unit tests for TZ edge cases."],
        ["`domain/.../time-normalization.ts`"],
        ["0.4-07"],
      ),
      T(
        "computed-metrics-pipeline",
        "Computed metrics (domain)",
        "domain",
        "distance, elapsed, speeds, elevation 3m threshold, HR/cadence/power §8.",
        ["0.4-06"],
        ["Pure domain metrics functions.", "No invented defaults."],
        [],
        ["Deterministic fixture expected values.", "Reindex stability test."],
        ["`domain/.../track-metrics.ts`"],
        ["0.4-08"],
      ),
      T(
        "multi-segment-aggregation",
        "Multi-segment aggregation",
        "domain / application",
        "One catalog row per file; `segments_json`; aggregated metrics.",
        ["0.4-07"],
        ["Aggregate all segments/tracks in file.", "Persist segment metadata."],
        [],
        ["Multi-segment fixture → one row + segments list."],
        ["segment aggregation module"],
        ["0.4-09"],
      ),
      T(
        "data-flags-persistence",
        "Data flags",
        "application / storage",
        "Persist `data_flags_json` for missing fields.",
        ["0.4-08", "0.2-04"],
        ["Map domain flags → JSON column."],
        [],
        ["Partial file indexed not error; flags visible."],
        ["track repository mapping"],
      ),
      T(
        "polyline-simplification-bbox",
        "Polyline simplification и bbox",
        "domain / infrastructure",
        "Simplify polyline for map; `bbox_json` generation.",
        ["0.4-07"],
        ["Simplification algorithm per TECHNICAL_DESIGN.", "bbox from points."],
        [],
        ["Stable simplified polyline on reindex.", "bbox valid for map fit."],
        ["`polyline-simplify.ts`"],
        ["0.4-11"],
      ),
      T(
        "indexing-parse-pipeline",
        "Parse pipeline в indexing",
        "application",
        "Wire parse → normalize → metrics → persist indexed/error.",
        ["0.4-10", "0.3-11"],
        ["Indexing job calls parser router.", "error_message + error_details."],
        [],
        ["E2E: file → indexed row with metrics.", "Broken file → error status visible."],
        ["indexing job handler"],
        ["0.4-12"],
      ),
      T(
        "parser-fixture-tests",
        "Parser fixture tests",
        "tests",
        "Matrix valid/partial/invalid; FIT/FIT.GZ included.",
        ["0.4-11"],
        ["Fixtures under `tests/fixtures/`.", "CI runs parser suite."],
        [],
        ["All v1 formats covered.", "`npm test` green."],
        ["`tests/parsers/**`"],
        ["0.4-13"],
      ),
      T(
        "fit-spike-cleanup",
        "Cleanup FIT spike artifacts",
        "refactoring",
        "Remove `@garmin-fit/sdk`, spike commands, `ENABLE_FIT_PARSER_SPIKE` modules per IMPLEMENTATION_PLAN §0.4.",
        ["0.4-12"],
        [
          "Remove garmin candidate, spike command, types.",
          "`fit-file-parser` only FIT lib.",
          "Default spike flags false; delete unused modules.",
        ],
        [],
        [
          "No `@garmin-fit/sdk` in package.json.",
          "import-boundaries test still passes.",
        ],
        ["PR removing spike code"],
        ["0.4-14"],
      ),
    ],
  },
  {
    version: "0.5",
    name: "Track view (file open -> map + stats)",
    goal: "первый user-visible value: custom view при открытии трек-файла, карта + статистика.",
    done: [
      "Explorer opens custom view for supported extensions.",
      "Offline/no-tile: geometry + notice.",
      "Computed metrics only; segments when available.",
    ],
    gates: ["**0.6 разблокирован:** navigation target from catalog."],
    prereqSection: "### Prerequisite\n\n- Milestone **0.4** complete (**0.4-14** PASS).",
    mermaid: `flowchart TD
  T01[0.5-01 View registration] --> T02[0.5-02 Desktop layout]
  T01 --> T03[0.5-03 Mobile tabs]
  T02 --> T04[0.5-04 Map tiles fallback]
  T03 --> T04
  T04 --> T05[0.5-05 Attribution legal]
  T02 --> T06[0.5-06 Stats panel]
  T06 --> T07[0.5-07 Segment list]
  T07 --> T08[0.5-08 Acceptance]`,
    tasks: [
      T(
        "track-view-registration",
        "Регистрация Track view",
        "UI / obsidian",
        "Custom view для `.gpx/.tcx/.fit/.fit.gz`; open from explorer.",
        ["0.4-14", "0.1-12"],
        ["Extend **0.1-12** shell with real layout.", "File-open routing."],
        [],
        ["Click .gpx opens Track view.", "All extensions registered."],
        ["`track-view.ts`"],
        ["0.5-02", "0.5-03"],
      ),
      T(
        "desktop-layout-map-stats",
        "Desktop layout: map | stats",
        "UI",
        "Split: map left, stats right per PRODUCT_SPEC.",
        ["0.5-01"],
        ["CSS/layout for desktop.", "Component cleanup on close."],
        [],
        ["Desktop layout matches spec.", "No listener leaks."],
        ["track view layout modules"],
      ),
      T(
        "mobile-tabs-layout",
        "Mobile layout: tabs map/stats",
        "UI",
        "Tab switcher map/stats on narrow width.",
        ["0.5-01"],
        ["Responsive tabs.", "Touch-friendly."],
        [],
        ["Mobile: tabs work.", "Same data as desktop."],
        ["mobile layout CSS"],
      ),
      T(
        "map-tiles-offline-fallback",
        "Карта: tiles и offline fallback",
        "infrastructure / map",
        "Tile adapter; offline shows route + clear notice.",
        ["0.5-02", "0.5-03", "0.4-10"],
        ["Leaflet/map adapter.", "No network → geometry only."],
        ["Tile provider UI (**backlog**)."],
        ["Offline notice visible.", "Route polyline from index."],
        ["`infrastructure/map/**`"],
      ),
      T(
        "attribution-legal-in-view",
        "Attribution и legal text",
        "UI",
        "Tile attribution + legal/privacy snippet in view/settings link.",
        ["0.5-04"],
        ["Attribution per provider ToS.", "Link to settings legal block."],
        [],
        ["Attribution visible when tiles load."],
        ["view legal component"],
      ),
      T(
        "stats-panel-indexed-data",
        "Панель статистики",
        "UI",
        "Display computed metrics from index only (no re-parse).",
        ["0.5-02", "0.4-11"],
        ["Wire track row → stats UI.", "Explicit «—» for missing."],
        [],
        ["Metrics match DB.", "No synthetic defaults."],
        ["stats panel component"],
        ["0.5-07"],
      ),
      T(
        "segment-list-ui",
        "Список сегментов",
        "UI",
        "Segment list when `segments_json` present.",
        ["0.5-06", "0.4-08"],
        ["Render segment names/metrics."],
        [],
        ["Multi-segment file shows list.", "Single-segment hidden or compact."],
        ["segment list component"],
      ),
    ],
  },
  {
    version: "0.6",
    name: "Sidebar catalog and filtering",
    goal: "каталог Tracks: группировки, фильтры, агрегаты, навигация в track view.",
    done: [
      "Grouping/filtering on mixed dataset.",
      "Aggregates match metrics with filters.",
      "no-date/no-sport/error cases explicit.",
    ],
    gates: [],
    prereqSection: "### Prerequisite\n\n- Milestone **0.5** complete (**0.5-08** PASS).",
    mermaid: `flowchart TD
  T01[0.6-01 Sidebar shell] --> T02[0.6-02 Date tree]
  T01 --> T03[0.6-03 Place group]
  T01 --> T04[0.6-04 Sport group]
  T02 --> T05[0.6-05 Sort filter]
  T03 --> T05
  T04 --> T05
  T05 --> T06[0.6-06 Aggregates]
  T06 --> T07[0.6-07 Row badges]
  T07 --> T08[0.6-08 Navigate view]
  T08 --> T09[0.6-09 Edge cases]
  T09 --> T10[0.6-10 Acceptance]`,
    tasks: [
      T(
        "sidebar-tracks-shell",
        "Sidebar «Tracks» shell",
        "UI",
        "Implement sidebar view from **0.1-12** shell.",
        ["0.5-08", "0.1-12"],
        ["`open-tracks-sidebar` command opens view.", "List container."],
        [],
        ["Sidebar opens and lists tracks."],
        ["`tracks-sidebar-view.ts`"],
        ["0.6-02", "0.6-03", "0.6-04"],
      ),
      T(
        "date-tree-grouping",
        "Группировка: дата (год→месяц→день)",
        "UI / application",
        "Date tree grouping per REQ.",
        ["0.6-01", "0.2-04"],
        ["Query by `started_at_utc`.", "Tree UI expand/collapse."],
        [],
        ["Tracks without date → explicit bucket."],
        ["date grouping module"],
      ),
      T(
        "place-grouping",
        "Группировка: place",
        "UI / application",
        "Group by linked places (after **0.7** data exists, UI can show empty until then).",
        ["0.6-01"],
        ["Place grouping query.", "Handle no places."],
        ["Place indexing (**0.7**) — use stub/empty until wired."],
        ["Grouping works when relations exist."],
        ["place grouping"],
      ),
      T(
        "sport-grouping",
        "Группировка: sport",
        "UI / application",
        "Group by `sport_normalized`.",
        ["0.6-01"],
        ["Sport buckets + no-sport bucket."],
        [],
        ["Unknown sport explicit."],
        ["sport grouping"],
      ),
      T(
        "sorting-and-filters",
        "Сортировка и фильтры",
        "UI",
        "Sort keys; filters incl. errors/unindexed visibility.",
        ["0.6-02", "0.6-03", "0.6-04"],
        ["Filter state in sidebar.", "Persist optional in session."],
        [],
        ["Error-only filter works.", "Sort stable."],
        ["filter controls"],
      ),
      T(
        "distance-elapsed-aggregates",
        "Агрегаты distance/elapsed",
        "application",
        "Month/year/custom range + sport filter aggregates.",
        ["0.6-05"],
        ["Aggregate queries from indexed metrics."],
        [],
        ["Totals match sum of visible tracks (tests)."],
        ["aggregate service"],
      ),
      T(
        "catalog-row-badges",
        "Поля строки и badges",
        "UI",
        "date, distance, duration, elevation, places, sport, status.",
        ["0.6-05"],
        ["Row renderer.", "Status/error badges."],
        [],
        ["All fields per PRODUCT_SPEC visible."],
        ["row component"],
      ),
      T(
        "sidebar-to-track-navigation",
        "Навигация sidebar → track view",
        "UI",
        "Click row opens Track view for path.",
        ["0.6-07", "0.5-01"],
        ["Activate leaf workspace.", "Focus track file."],
        [],
        ["Navigation works desktop/mobile."],
        ["navigation handler"],
      ),
      T(
        "catalog-edge-cases",
        "Edge cases каталога",
        "UI / QA",
        "no-date, no-sport, error rows explicit representation.",
        ["0.6-08"],
        ["UX copy via i18n.", "Manual test checklist."],
        [],
        ["Checklist PASS in acceptance evidence."],
        ["edge-case notes in README milestone"],
      ),
    ],
  },
  {
    version: "0.7",
    name: "Places (frontmatter geometry + relations)",
    goal: "place model, geometry validation/matching, commands, `track_places` relations.",
    done: [
      "Place changes propagate relations.",
      "Invalid geometry never crashes; visible in UI.",
    ],
    gates: [],
    prereqSection:
      "### Prerequisite\n\n- Milestone **0.4**+ indexing (**0.3-12**); **0.6** sidebar can consume relations.",
    mermaid: `flowchart TD
  T01[0.7-01 Place parser] --> T02[0.7-02 Geometry validate]
  T02 --> T03[0.7-03 Matcher]
  T03 --> T04[0.7-04 track_places persist]
  T04 --> T05[0.7-05 Make place cmd]
  T05 --> T06[0.7-06 Edit geometry modal]
  T06 --> T07[0.7-07 Reindex places]
  T07 --> T08[0.7-08 Debounced auto]
  T08 --> T09[0.7-09 Invalid UI]
  T09 --> T10[0.7-10 Acceptance]`,
    tasks: [
      T(
        "place-frontmatter-parser",
        "Парсер place frontmatter",
        "infrastructure / obsidian",
        "`trackdex-type: place` + geometry from note.",
        ["0.2-05"],
        ["Read frontmatter/YAML.", "Map to domain Place."],
        [],
        ["Valid place note parses."],
        ["`place-note-parser.ts`"],
        ["0.7-02"],
      ),
      T(
        "geometry-validation",
        "Валидация геометрии",
        "domain",
        "point/circle/rectangle/polygon single outer ring §10.2.",
        ["0.7-01"],
        ["Validators per kind.", "is_valid + error_message."],
        ["holes/multipolygon"],
        ["Invalid cases → is_valid=false.", "Tests per kind."],
        ["`geometry-validation.ts`"],
        ["0.7-03"],
      ),
      T(
        "geometry-matcher",
        "Geometry matcher",
        "domain",
        "bbox prefilter + point-in-geometry; >=1 point inside rule.",
        ["0.7-02", "0.4-10"],
        ["Matcher service.", "Use track points/bbox."],
        [],
        ["Fixture: track inside polygon matches."],
        ["`geometry-matcher.ts`"],
        ["0.7-04"],
      ),
      T(
        "track-places-relations",
        "Persist track_places",
        "application",
        "Write relations + `last_visit_at_utc` on reindex.",
        ["0.7-03", "0.2-05"],
        ["Reindex places workflow.", "Clear stale relations."],
        [],
        ["Relations updated after place change."],
        ["`reindex-track-places.ts`"],
        ["0.7-07"],
      ),
      T(
        "make-current-note-place",
        "Команда: make current note a place",
        "UI / command",
        "Wire `make-current-note-place` with frontmatter template.",
        ["0.7-02", "0.1-11"],
        ["Command sets YAML scaffold."],
        [],
        ["Active md note → place frontmatter."],
        ["command handler"],
      ),
      T(
        "edit-place-geometry-modal",
        "Редактирование геометрии place",
        "UI",
        "Modal/YAML-assisted flow per v1 (not map editor).",
        ["0.7-05"],
        ["`edit-current-place-geometry` command.", "Validate on save."],
        ["Visual map editor (**backlog**)."],
        ["Save updates note + triggers reindex."],
        ["place geometry modal"],
      ),
      T(
        "reindex-places-command",
        "Команда reindex places",
        "application / command",
        "Wire `reindex-places` full place scan + relation rebuild.",
        ["0.7-04", "0.1-11"],
        ["Scan place notes in vault."],
        [],
        ["Command completes; relations consistent."],
        ["`reindex-places.ts`"],
      ),
      T(
        "debounced-place-auto-reindex",
        "Debounced auto-reindex place notes",
        "infrastructure",
        "On place note modify → debounced reindex.",
        ["0.7-07"],
        ["registerEvent debounce.", "Respect scan_paused."],
        [],
        ["Edit place note updates relations within debounce window."],
        ["place note watcher"],
      ),
      T(
        "invalid-place-ui",
        "Invalid place в UI/индексе",
        "UI",
        "Invalid places visible; no pipeline crash.",
        ["0.7-02", "0.6-07"],
        ["Sidebar/catalog indicator.", "Error message from index."],
        [],
        ["Bad YAML → is_valid=0 + visible badge."],
        ["invalid place UI"],
      ),
    ],
  },
  {
    version: "0.8",
    name: "Note links and many-to-many relations",
    goal: "индексация Obsidian-ссылок note↔track, UI indicators.",
    done: [
      "Incremental on note changes.",
      "Link variant tests pass.",
    ],
    gates: [],
    prereqSection: "### Prerequisite\n\n- **0.2-05** link repository; **0.5** track view shell.",
    mermaid: `flowchart TD
  T01[0.8-01 Link extractor] --> T02[0.8-02 Obsidian resolve]
  T02 --> T03[0.8-03 Persist links]
  T03 --> T04[0.8-04 Incremental notes]
  T04 --> T05[0.8-05 Track view notes]
  T05 --> T06[0.8-06 Catalog indicator]
  T06 --> T07[0.8-07 Link tests]
  T07 --> T08[0.8-08 Acceptance]`,
    tasks: [
      T(
        "markdown-link-extractor",
        "Извлечение ссылок из Markdown",
        "infrastructure",
        "Parse wikilinks, markdown links, aliases, embeds per §11.",
        ["0.2-12"],
        ["Extractor from note content."],
        [],
        ["Unit tests per link form."],
        ["`markdown-link-extractor.ts`"],
        ["0.8-02"],
      ),
      T(
        "obsidian-link-resolution",
        "Разрешение ссылок Obsidian",
        "infrastructure / obsidian",
        "Resolve ambiguous links via Obsidian API.",
        ["0.8-01"],
        ["Adapter uses metadataCache/fileManager."],
        [],
        ["Ambiguous link resolves to track path or skipped safely."],
        ["`link-resolver.ts`"],
        ["0.8-03"],
      ),
      T(
        "note-track-links-persistence",
        "Persist note_track_links",
        "application",
        "Upsert/delete links on note index.",
        ["0.8-02", "0.2-05"],
        ["Incremental diff per note."],
        [],
        ["Many-to-many preserved.", "Delete note cleans links."],
        ["`index-note-links.ts`"],
        ["0.8-04"],
      ),
      T(
        "incremental-note-indexing",
        "Инкрементальная индексация заметок",
        "infrastructure",
        "`.md` create/modify/delete → reindex links only.",
        ["0.8-03"],
        ["registerEvent on markdown.", "No full vault rescan."],
        [],
        ["Edit note updates links without full scan."],
        ["note link watcher"],
      ),
      T(
        "track-view-related-notes",
        "Связанные заметки в track view",
        "UI",
        "List related notes from `note_track_links`.",
        ["0.8-03", "0.5-06"],
        ["Panel in track view.", "Open note action."],
        [],
        ["Linked note appears after index."],
        ["related notes panel"],
      ),
      T(
        "catalog-link-indicator",
        "Индикатор ссылок в каталоге",
        "UI",
        "Badge/icon when track has linked notes.",
        ["0.8-03", "0.6-07"],
        ["Sidebar row indicator."],
        [],
        ["Track with links shows indicator."],
        ["catalog badge"],
      ),
      T(
        "link-variant-tests",
        "Тесты вариантов ссылок",
        "tests",
        "Coverage wikilink, md-link, alias, embed, path variants.",
        ["0.8-03"],
        ["Fixture notes in tests."],
        [],
        ["All REQUIRED link forms in REQUIREMENTS covered."],
        ["`tests/links/**`"],
      ),
    ],
  },
  {
    version: "0.9",
    name: "Settings, controls, and UX hardening",
    goal: "полный settings tab, progress panel, error details, EN/RU pass, wire commands.",
    done: [
      "All settings work without restart where feasible.",
      "Reset flow explicit and safe.",
    ],
    gates: ["**0.10 разблокирован:** perf instrumentation + release checklist."],
    prereqSection:
      "### Prerequisite\n\n- Core features **0.3–0.8**; stubs from **0.1-11** replaced with real handlers.",
    mermaid: `flowchart TD
  T01[0.9-01 Settings tab] --> T02[0.9-02 Units]
  T01 --> T03[0.9-03 Excludes]
  T01 --> T04[0.9-04 POI radius]
  T01 --> T05[0.9-05 Pause resume]
  T01 --> T06[0.9-06 Reset confirm]
  T01 --> T07[0.9-07 Legal privacy]
  T08[0.9-08 Progress panel] --> T11[0.9-11 Wire commands]
  T09[0.9-09 Error details UI] --> T11
  T10[0.9-10 i18n pass] --> T11
  T02 --> T11
  T03 --> T11
  T05 --> T11
  T06 --> T11
  T11 --> T12[0.9-12 Acceptance]`,
    tasks: [
      T(
        "settings-tab-shell",
        "Settings tab (каркас)",
        "UI",
        "Trackdex settings tab per **0.1** settings migration.",
        ["0.1-10", "0.2-09"],
        ["`TrackdexSettingTab` sections.", "load/save via plugin data."],
        [],
        ["Settings visible in Obsidian settings."],
        ["`ui/settings/trackdex-settings.ts`"],
        ["0.9-02", "0.9-03", "0.9-04", "0.9-05", "0.9-06", "0.9-07"],
      ),
      T(
        "settings-units",
        "Настройка units",
        "UI / settings",
        "Metric/imperial per REQUIREMENTS.",
        ["0.9-01"],
        ["Persist + apply in stats/sidebar formatters."],
        [],
        ["Changing units updates display without restart."],
        ["units setting"],
      ),
      T(
        "settings-exclude-patterns",
        "Exclude patterns",
        "UI / settings",
        "User exclude globs wired to **0.3-02**.",
        ["0.9-01", "0.3-02"],
        ["Text area or list editor.", "Validation feedback."],
        [],
        ["New pattern affects next scan."],
        ["excludes setting"],
      ),
      T(
        "settings-poi-radius",
        "Default POI radius",
        "UI / settings",
        "Default radius for place/circle helpers.",
        ["0.9-01"],
        ["Numeric setting with bounds."],
        [],
        ["Used by place commands."],
        ["poi radius setting"],
      ),
      T(
        "settings-pause-resume-indexing",
        "Pause/resume indexing",
        "UI / settings + command",
        "Wire `pause-indexing` + meta `scan_paused`.",
        ["0.9-01", "0.3-11", "0.2-03"],
        ["Toggle in settings.", "Command sync."],
        [],
        ["Paused stops queue; resume continues."],
        ["pause/resume wiring"],
      ),
      T(
        "settings-reset-rebuild-confirm",
        "Reset/rebuild index + confirmation",
        "UI",
        "Wire `reset-rebuild-index` with explicit copy (files untouched).",
        ["0.9-01", "0.2-08"],
        ["Modal confirmation.", "EN/RU strings."],
        [],
        ["Reset requires confirm.", "Runs **0.2-08** use case."],
        ["reset confirm modal"],
      ),
      T(
        "settings-legal-privacy-block",
        "Legal/privacy block",
        "UI",
        "Disclosure tile provider, offline-first, logs local only.",
        ["0.9-01"],
        ["Static + links per PRODUCT_SPEC."],
        [],
        ["Block visible in settings."],
        ["legal section"],
      ),
      T(
        "progress-panel-bottom-right",
        "Панель прогресса",
        "UI",
        "Bottom-right progress from **0.3-10** model.",
        ["0.3-10"],
        ["Non-intrusive overlay.", "Large file status text."],
        [],
        ["Visible during scan.", "Hides when idle."],
        ["progress panel component"],
      ),
      T(
        "error-details-ui",
        "UI деталей ошибок",
        "UI",
        "Short reason + expandable technical details per REQ-002.",
        ["0.4-11", "0.6-07"],
        ["Track view + catalog.", "Copy-friendly details."],
        [],
        ["Error track shows expand details."],
        ["error details component"],
      ),
      T(
        "i18n-localization-pass",
        "EN/RU localization pass",
        "UI / i18n",
        "All user-visible strings in dictionaries.",
        ["0.1-10"],
        ["Audit commands, settings, views, notices."],
        [],
        ["No hardcoded EN in UI paths.", "RU complete for v1 strings."],
        ["`ui/i18n/**` updates"],
        ["0.9-11"],
      ),
      T(
        "wire-commands-real-handlers",
        "Подключить команды к логике",
        "composition",
        "Replace «not implemented» notices with real handlers.",
        ["0.9-02", "0.9-03", "0.9-05", "0.9-06", "0.3-11", "0.7-07"],
        ["All 6 v1 commands functional."],
        [],
        ["Each command does documented action."],
        ["commands-registry updates"],
      ),
    ],
  },
  {
    version: "0.10",
    name: "Performance baseline and release readiness",
    goal: "perf thresholds, test sweep, README, manifest/release checklist, MVP validation.",
    done: [
      "PASS/FAIL perf report.",
      "Must requirements validated.",
      "Known limitations documented.",
    ],
    gates: [],
    prereqSection: "### Prerequisite\n\n- Milestones **0.1–0.9** complete; MVP feature-complete.",
    mermaid: `flowchart TD
  T01[0.10-01 Metrics port] --> T02[0.10-02 Instrumentation]
  T02 --> T03[0.10-03 Export perf report]
  T03 --> T04[0.10-04 Baseline dataset]
  T04 --> T05[0.10-05 Unit sweep]
  T05 --> T06[0.10-06 Integration sweep]
  T06 --> T07[0.10-07 Parser fixtures sweep]
  T07 --> T08[0.10-08 README limits]
  T08 --> T09[0.10-09 Release checklist]
  T09 --> T10[0.10-10 MVP validation]
  T10 --> T11[0.10-11 Acceptance]`,
    tasks: [
      T(
        "metrics-port-implementation",
        "Реализация Metrics port",
        "infrastructure",
        "Replace metrics stub **0.1-08** for perf collection.",
        ["0.1-02", "0.1-08"],
        ["Timers/counters API.", "In-memory + optional persist snapshot."],
        [],
        ["Metrics registered in container."],
        ["metrics adapter"],
        ["0.10-02"],
      ),
      T(
        "performance-instrumentation",
        "Performance instrumentation",
        "application / infrastructure",
        "Instrument scan, parse, migration, UI ready per §14.",
        ["0.10-01", "0.3-11", "0.4-11"],
        ["Hooks at indexing/parser boundaries.", "Event latency samples."],
        [],
        ["Counters increment during baseline run."],
        ["instrumentation modules"],
        ["0.10-03"],
      ),
      T(
        "export-performance-report-command",
        "Команда export performance report",
        "UI / command",
        "Debug command exports PASS/FAIL vs §14 thresholds.",
        ["0.10-02"],
        ["Markdown/JSON report to plugin data or clipboard."],
        [],
        ["Report generated on demand.", "Thresholds from TECHNICAL_DESIGN §14.1."],
        ["perf report command"],
      ),
      T(
        "baseline-dataset-thresholds",
        "Baseline dataset и thresholds",
        "QA",
        "Run baseline vault; compare §14.1 targets.",
        ["0.10-03"],
        ["Document dataset size.", "Desktop gate; mobile aspirational noted."],
        [],
        ["Report filed in `evidence/perf-baseline.md`."],
        ["`evidence/perf-baseline.md`"],
      ),
      T(
        "unit-test-sweep",
        "Unit test sweep",
        "tests",
        "Ensure domain/parser/migration unit coverage green.",
        ["0.4-12"],
        ["Fix gaps found in audit."],
        [],
        ["`npm test` all unit files pass."],
        ["test suite"],
      ),
      T(
        "integration-test-sweep",
        "Integration test sweep",
        "tests",
        "Indexing + storage integration paths.",
        ["0.3-12", "0.2-12"],
        ["Adapter integration tests as needed."],
        [],
        ["Integration tests pass in CI."],
        ["integration tests"],
      ),
      T(
        "parser-fixture-sweep",
        "Parser fixture sweep",
        "tests",
        "Final pass all format fixtures including FIT/GZ.",
        ["0.4-12"],
        ["Add missing edge fixtures."],
        [],
        ["Parser matrix complete."],
        ["fixtures"],
      ),
      T(
        "readme-algorithms-privacy-limits",
        "README: algorithms, privacy, limits",
        "документация",
        "README per IMPLEMENTATION_PLAN §0.10.",
        ["0.9-07", "0.10-04"],
        ["Algorithms summary.", "Privacy/network.", "Mobile/large vault limits."],
        [],
        ["README sections complete."],
        ["README.md"],
      ),
      T(
        "manifest-versions-release-checklist",
        "Manifest, versions, release checklist",
        "release",
        "Bump version, `versions.json`, release asset checklist AGENTS.md.",
        ["0.10-10"],
        ["manifest.json semver.", "Tag = version without `v`."],
        [],
        ["Checklist in milestone evidence.", "minAppVersion accurate."],
        ["`manifest.json`", "`versions.json`", "release checklist doc"],
      ),
      T(
        "mvp-requirements-validation",
        "Валидация Must requirements",
        "QA",
        "Map REQUIREMENTS §11 checklist + PRODUCT_SPEC to PASS/FAIL.",
        ["0.9-12"],
        ["Traceability table in evidence."],
        [],
        ["All Must items PASS or documented deferral with user approval."],
        ["`evidence/mvp-requirements-trace.md`"],
        ["0.10-11"],
      ),
    ],
  },
];

function renderAcceptance(version, name, taskCount, prereqSection) {
  const last = taskCount + 1;
  const id = `${version}-${String(last).padStart(2, "0")}`;
  const prev = [];
  for (let i = 1; i <= taskCount; i++) {
    prev.push(`${version}-${String(i).padStart(2, "0")}`);
  }
  const next = (parseFloat(version) + 0.1).toFixed(1);
  return `# ${id} — Приёмка milestone ${version}

**Milestone:** ${version} — ${name}  
**Тип:** QA / gate verification

## Цель

Подтвердить deliverables и done criteria IMPLEMENTATION_PLAN для milestone ${version} перед стартом ${next}.

## Зависимости

${prev.map((d) => `- **${d}**`).join("\n")}

## Объём работ

- Прогнать \`npm run build\` и \`npm test\`.
- Import architecture gate (storage/parser libs only in infrastructure).
- Ручной smoke desktop (+ mobile, если \`isDesktopOnly: false\`).
- Чеклист IMPLEMENTATION_PLAN и PRODUCT_SPEC acceptance criteria для этого milestone.
- Обновить таблицу приёмки в \`docs/milestones/${version}/README.md\`.

## Вне scope

- Реализация задач milestone ${next} (кроме проверки gate «разблокирован»).

## Условия завершения

- [ ] \`npm run build\` — exit 0.
- [ ] \`npm test\` — exit 0.
- [ ] Задачи ${prev.join(", ")} закрыты (чеклисты отмечены).
- [ ] Deliverables IMPLEMENTATION_PLAN для ${version} подтверждены.
- [ ] Cross-milestone gates: трек-файлы read-only; отсутствующие данные явны; битые файлы видимы с диагностикой.

## Артефакты

- Заполненная таблица приёмки в \`docs/milestones/${version}/README.md\` (дата, версия, PASS/FAIL).
- При FAIL — follow-up задачи в этой папке; не начинать ${next} до закрытия blocking gates.

${prereqSection}
`;
}

function writeMilestone(def) {
  const dir = path.join(mdDir, def.version);
  fs.mkdirSync(path.join(dir, "evidence"), { recursive: true });
  const gitkeep = path.join(dir, "evidence", ".gitkeep");
  if (!fs.existsSync(gitkeep)) fs.writeFileSync(gitkeep, "");

  def.tasks.forEach((t, i) => {
    const num = i + 1;
    const content = renderTask(def.version, num, t, def.name);
    fs.writeFileSync(
      path.join(dir, `${def.version}-${String(num).padStart(2, "0")}-${t.slug}.md`),
      content,
    );
  });

  const accNum = def.tasks.length + 1;
  const accContent = renderAcceptance(
    def.version,
    def.name,
    def.tasks.length,
    def.prereqSection,
  );
  fs.writeFileSync(
    path.join(
      dir,
      `${def.version}-${String(accNum).padStart(2, "0")}-milestone-acceptance.md`,
    ),
    accContent,
  );

  const rows = def.tasks
    .map((t, i) => {
      const num = i + 1;
      const id = `${def.version}-${String(num).padStart(2, "0")}`;
      return `| ${id} | [${id}-${t.slug}.md](./${id}-${t.slug}.md) | ${t.title} |`;
    })
    .join("\n");
  const accId = `${def.version}-${String(accNum).padStart(2, "0")}`;
  const readme = `# Milestone ${def.version} — ${def.name}

Источник: [IMPLEMENTATION_PLAN.md](../../IMPLEMENTATION_PLAN.md) (раздел «Milestone ${def.version}»).

Цель milestone: ${def.goal}

## Задачи

| ID | Файл | Кратко |
|----|------|--------|
${rows}
| ${accId} | [${accId}-milestone-acceptance.md](./${accId}-milestone-acceptance.md) | Приёмка milestone ${def.version} |

## Граф зависимостей

\`\`\`mermaid
${def.mermaid}
\`\`\`

## Критерии завершения milestone (сводка)

${def.done.map((s) => `- ${s}`).join("\n")}
${
  def.gates?.length
    ? `\n## Gates для следующих milestones\n\n${def.gates.map((g) => `- ${g}`).join("\n")}\n`
    : ""
}
## Приёмка milestone (**${accId}**)

| Поле | Значение |
|------|----------|
| **Дата** | _TBD_ |
| **Версия** | _TBD_ (\`manifest.json\`) |
| **Результат** | _TBD_ (PASS/FAIL) |
| **Коммит** | _TBD_ |

${def.prereqSection}
`;
  fs.writeFileSync(path.join(dir, "README.md"), readme);
}

for (const m of MILESTONES) {
  writeMilestone(m);
  console.log(
    `${m.version}: ${m.tasks.length} tasks + acceptance → ${path.join(mdDir, m.version)}`,
  );
}

console.log("Done.");
