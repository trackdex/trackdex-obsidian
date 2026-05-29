# Trackdex — Implementation Plan (milestones 0.x)

## Planning principles

- Milestones are incremental and reviewable.
- Each milestone ends with a usable technical result and clear acceptance checks.
- Business logic is implemented behind abstractions first, concrete adapters second.
- Scope aligns with `docs/REQUIREMENTS.md`, `docs/PRODUCT_SPEC_V1.md`, and `docs/TECHNICAL_DESIGN.md`; `docs/CONCEPT.md` is historical context only.

## Task breakdown (по milestone)

Детальные задачи, зависимости и чеклисты приёмки — в `docs/milestones/` (формат как у [0.1](milestones/0.1/README.md)):

| Milestone | Статус задач | Задач |
|-----------|----------------|-------|
| [0.1 — Foundation](milestones/0.1/README.md) | **0.1-14 PASS** (2026-05-29) | 14 |
| [0.2 — Storage schema](milestones/0.2/README.md) | **0.2-12 PASS** (2026-05-29) | 12 |
| [0.3 — Scan engine](milestones/0.3/README.md) | TBD | 12 |
| [0.4 — Parsers & metrics](milestones/0.4/README.md) | TBD | 14 |
| [0.5 — Track view](milestones/0.5/README.md) | TBD | 8 |
| [0.6 — Sidebar catalog](milestones/0.6/README.md) | TBD | 10 |
| [0.7 — Places](milestones/0.7/README.md) | TBD | 10 |
| [0.8 — Note links](milestones/0.8/README.md) | TBD | 8 |
| [0.9 — Settings & UX](milestones/0.9/README.md) | TBD | 12 |
| [0.10 — Perf & release](milestones/0.10/README.md) | TBD | 11 |

Перегенерация каркаса (после правок определений): `node scripts/generate-milestone-tasks.mjs`.

## Milestone 0.1 — Foundation and project skeleton

Goal: establish architecture, contracts, plugin bootstrap, and close the storage compatibility decision before feature work depends on it.

Scope:
- Create layered folders/modules (`application`, `domain`, `infrastructure`, `ui`, `composition`).
- Implement DI container/bootstrap in `main.ts`.
- Define core interfaces (repositories, parser port, logger port, metrics port).
- Run storage compatibility spike for `isDesktopOnly: false`:
  - validate SQLite-compatible local storage as the preferred adapter on desktop and mobile Obsidian,
  - evaluate fallback local adapters only if SQLite cannot satisfy mobile constraints,
  - confirm esbuild bundling and persistence location,
  - reject implementations that rely on APIs unavailable in mobile Obsidian.
- Run FIT/FIT.GZ parser feasibility spike:
  - choose candidate parser/library or implementation path,
  - verify esbuild bundle compatibility and bundle-size impact,
  - validate desktop/mobile runtime compatibility,
  - parse representative `.fit` and `.fit.gz` fixtures into the intermediate model.
- Record final v1 storage adapter decision in `docs/TECHNICAL_DESIGN.md`.
- Record final FIT/FIT.GZ parser decision in `docs/TECHNICAL_DESIGN.md`; if feasibility fails, explicitly update v1 format scope before Milestone 0.4.
- Add chosen storage adapter bootstrap + migration framework skeleton (no full schema yet).
- Add command registration shell with stable command IDs.
- Add i18n foundation (EN/RU dictionaries and locale resolver).
- Remove or migrate legacy prototype settings/commands that conflict with v1 scope (`tracksFolder`, custom basemap tile URL, prototype scan command).

Deliverables:
- Compiling plugin with initialized container.
- Contract interfaces and stubs for all required services.
- Empty but registered views/commands.
- Storage adapter decision note with evidence from desktop/mobile smoke checks.
- FIT/FIT.GZ parser feasibility note with fixture results and bundle/mobile findings.

Done criteria:
- `npm run build` passes.
- Smoke test still passes.
- No direct storage-adapter imports outside infrastructure layer.
- Milestone 0.2 storage gate: **closed** in `docs/TECHNICAL_DESIGN.md` §2.1 (sql.js + `index.sqlite`, `isDesktopOnly: false`); 0.2 starts after 0.1-09 bootstrap skeleton lands.
- Milestone 0.4 FIT gate: **closed** in `docs/TECHNICAL_DESIGN.md` §2.5 (`fit-file-parser`, `.fit` + `.fit.gz` in v1 scope, `DecompressionStream` for gzip); production parser wiring is **0.4**.

## Milestone 0.2 — Storage schema and indexing meta

Goal: get persistent storage ready for real indexing lifecycle.

Scope:
- Implement v1 logical storage schema and query indexes in the chosen adapter.
- Implement migration `v1` and meta repository.
- Persist/restore `first_scan_approved`, `scan_paused`, `last_run_interrupted`.
- Implement logging subsystem in `.obsidian/plugins/trackdex-obsidian/logs/` with rotation `5 x 1 MB`.

Deliverables:
- Working storage adapter repositories (CRUD baseline).
- Migration run on plugin startup.
- Rotating file logs with basic event records.

Done criteria:
- New vault initializes schema correctly.
- Existing DB upgrades through migration path.
- Reset index removes only service index data.
- Desktop and mobile storage smoke checks pass for create/read/update/delete and migration startup.
- README draft documents plugin data dir location, sync implications, and log rotation.

## Milestone 0.3 — Scan engine and file status pipeline

Goal: implement full/incremental scan mechanics and status transitions.

Scope:
- Vault recursive scanner with case-insensitive extension matching.
- Default excludes (`.obsidian`, `.trash`) + user exclude patterns.
- Queue with bounded concurrency and micro-batch yielding.
- File state machine (`pending/indexing/indexed/stale/error`).
- Event listeners for `create/modify/delete/rename`.
- First-scan consent UX state and interrupted-run banner flow.

Deliverables:
- Full scan command and incremental updates pipeline.
- Progress model for UI consumption.
- Reliable status persistence in DB.

Done criteria:
- Tracks discovered and statused correctly across lifecycle operations.
- Interrupted indexing is detected and recoverable through explicit action.
- UI remains responsive during scan on medium dataset.

## Milestone 0.4 — Parser normalization and computed metrics

Goal: parse supported formats into unified model and compute deterministic metrics.

Scope:
- Implement parser router and format parsers:
  - GPX
  - TCX
  - FIT (§2.5 — `fit-file-parser`)
  - FIT.GZ (§2.5 — gzip decompress + `fit-file-parser`)
- Normalize timestamps/timezones and raw values.
- Compute metrics (computed-only pipeline):
  - date, elapsed, distance, avg/max speed, elevation gain/loss (3m threshold),
  - optional HR/cadence/power.
- Aggregate multi-segment/multi-track files as one catalog record and persist segment metadata for the view.
- Persist data flags for missing fields.
- Polyline simplification + bbox generation.
- Retire FIT parser **spike** artifacts once production parsers are wired and tested:
  - remove **`@garmin-fit/sdk`** (rejected alternate — fails on compressed-timestamp FIT from recent Garmin exports; evidence in `docs/milestones/0.1/evidence/fit-parser-spike.md`);
  - remove `garmin-sdk-candidate`, `fit-spike-garmin-sdk` command, garmin bundle measure entry, and `src/types/garmin-fit-sdk.d.ts`;
  - keep **`fit-file-parser`** as the only FIT library in `package.json` (move from devDependency to runtime dependency when bundled in **0.4**);
  - fold or replace spike tests/commands for `fit-file-parser` with production parser fixture tests; set `ENABLE_FIT_PARSER_SPIKE` default `false` and delete spike-only modules when no longer needed.

Deliverables:
- Indexed tracks with complete computed metric fields.
- Error model for malformed files (`error_message` + details).

Done criteria:
- Parser fixture tests cover valid/partial/invalid files.
- FIT/FIT.GZ fixture tests are included when those formats remain in v1 scope.
- Same file produces stable metrics across reindex runs.
- Missing data is explicit, no fallback synthesis.
- No `@garmin-fit/sdk` (or `@garmin/fitsdk`) in `package.json`; FIT spike code path does not reference Garmin SDK.

## Milestone 0.5 — Track view (file open -> map + stats)

Goal: deliver first user-visible value for single track exploration.

Scope:
- Register custom view for track file extensions.
- Desktop layout: map left / stats right.
- Mobile layout: tabs map/stats.
- Fallback behavior when tiles/network unavailable.
- Attribution and legal text integration in view/settings.
- Display computed metrics only.
- Display segment list for multi-segment/multi-track files when segment metadata is available.

Deliverables:
- Opening a supported track file shows Track view.
- Core statistics panel wired to indexed data.

Done criteria:
- Explorer click opens custom view for all supported extensions.
- Offline/no-tile scenario still shows route geometry + clear notice.

## Milestone 0.6 — Sidebar catalog and filtering

Goal: make catalog usable for discovery and navigation.

Scope:
- Sidebar “Tracks” implementation.
- Groupings:
  - date tree (year -> month -> day),
  - place,
  - sport.
- Sorting and key filters (including errors/unindexed visibility).
- Aggregates for distance and elapsed hours by month/year/custom range with sport filter.
- Row fields and badges:
  - date, distance, duration, elevation, places, sport, status.

Deliverables:
- Interactive sidebar with grouping modes.
- Navigation from sidebar item to track view.

Done criteria:
- Grouping and filtering work on mixed dataset.
- Aggregates match computed track metrics and respect sport/date filters.
- No-date/no-sport/error cases are explicitly represented.

## Milestone 0.7 — Places (frontmatter geometry + relations)

Goal: implement place model and track-to-place linking.

Scope:
- Parse place notes (`trackdex-type: place` + geometry).
- Validate `point/circle/rectangle/polygon` (single outer ring).
- Geometry matcher:
  - bbox prefilter,
  - precise point-in-geometry.
- Commands:
  - make current note a place,
  - edit current place geometry (v1 modal/YAML-assisted flow),
  - reindex places.
- Debounced auto-reindex on place note updates.
- Invalid place handling in UI/index.

Deliverables:
- Persisted places and `track_places` relations with `last_visit_at`.

Done criteria:
- Place changes propagate to relations correctly.
- Invalid YAML/geometry never crashes pipeline and is marked visibly.

## Milestone 0.8 — Note links and many-to-many relations

Goal: integrate Obsidian-native links between notes and track files.

Scope:
- Markdown link indexing from `.md` notes.
- Native Obsidian resolution for ambiguous links.
- Persist/update `note_track_links`.
- Show related notes in track UI and catalog indicator.

Deliverables:
- Reliable many-to-many link graph note <-> track.

Done criteria:
- Link updates react to note changes incrementally.
- Valid link forms (wikilink, markdown-link, alias/embed/path variants) are covered by tests.

## Milestone 0.9 — Settings, controls, and UX hardening

Goal: complete operational controls and polish user flows.

Scope:
- Full settings tab:
  - units,
  - exclude patterns,
  - default POI radius,
  - pause/resume indexing,
  - reset/rebuild index with confirmation,
  - legal/privacy block.
- Progress panel bottom-right.
- Error details UI (short reason + expandable technical details).
- EN/RU localization pass for visible strings and commands.

Deliverables:
- Complete MVP control surface in settings and commands.

Done criteria:
- All required settings operational without restart where feasible.
- Reset index flow is explicit and safe.

## Milestone 0.10 — Performance baseline and release readiness

Goal: verify thresholds, stabilize quality, and prepare MVP release.

Scope:
- Add performance instrumentation (timers/counters/event latency).
- Add “export performance report” debug command.
- Run baseline dataset and compare against thresholds from tech design.
- Final test sweep:
  - unit,
  - integration,
  - parser fixtures,
  - smoke.
- README updates (algorithms, privacy/network, known limits).
- Remove or document any remaining legacy prototype settings that are not part of v1.
- Manifest/versions/release checklist prep.

Deliverables:
- `PASS/FAIL` performance report for defined thresholds.
- Release-ready MVP candidate.

Done criteria:
- Must requirements validated.
- No critical regressions in core flows.
- Documented known limitations for mobile and large vault scenarios.

## Cross-milestone quality gates

- Architecture gate:
  - application/domain layers cannot import concrete storage/parser libs.
- Safety gate:
  - track files are never modified by plugin.
- UX gate:
  - absent data is explicit; no invented defaults.
- Reliability gate:
  - malformed files remain visible with diagnostics.

## Suggested execution cadence

- 0.1-0.3: platform and indexing backbone.
- 0.4-0.6: user-facing core value (metrics + catalog + view).
- 0.7-0.9: Obsidian-native linking/place intelligence + product completeness.
- 0.10: hardening, perf verification, release packaging.

## Optional backlog after 0.10

- **Compressed GPX/TCX (`.gpx.gz`, `.tcx.gz`)** — decompress adapter, extension routing, vault scan, index + track view map/stats. Smoke follow-up from 0.5 (2026-05-29); PRODUCT_SPEC REQ-001; currently excluded in v1 domain (`track-file-name.ts`). Planned after core catalog (0.6) or alongside parser hardening (0.10).
- Moving time and avg-by-moving-time.
- Tile cache and provider UI switching.
- Visual place geometry editor on map.
- Duplicate detection by SHA-256.
- Sport alias customization.
- Heatmap and advanced analytics.
