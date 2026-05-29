# Trackdex — Technical Design (v1)

## 1. Purpose and scope

This document defines the technical architecture and implementation plan for Trackdex v1 (Obsidian plugin), based on:
- `docs/REQUIREMENTS.md` — normative source of truth for v1 product requirements,
- `docs/PRODUCT_SPEC_V1.md` — task-ready product slice with acceptance criteria,
- `docs/IMPLEMENTATION_PLAN.md` — milestone sequencing,
- `docs/CONCEPT.md` — historical context only and may contain outdated ideas.

Scope covers MVP requirements for:
- vault-wide indexing of track files (`.gpx`, `.tcx`, `.fit`, `.fit.gz`),
- custom track view (map + stats),
- sidebar catalog (date/place/sport groupings),
- places and note links,
- deterministic computed metrics,
- indexing UX, logs, settings, and i18n.

Out-of-scope items remain as defined in requirements.

## 2. Key decisions and gates

1. **Storage implementation (closed 0.1-05):** **v1 storage adapter = sql.js** (SQLite in WebAssembly) with vault-backed file persistence. Evidence: [`docs/milestones/0.1/evidence/storage-spike.md`](milestones/0.1/evidence/storage-spike.md). See [§2.1](#21-v1-local-storage-decision-0105) for persistence path, fallback, sync, and mobile policy. Milestone **0.2** may proceed on this adapter; production wiring is **0.1-09** (bootstrap) then **0.2** (schema/migrations).
2. **Storage access model:** business logic depends on repository interfaces only; sql.js and any fallback engine are infrastructure adapters behind repository ports — no direct sql.js imports outside `src/infrastructure/storage/**`.
3. **Metrics source in UI v1:** only `computed` metrics are displayed.
4. **Log rotation:** hardcoded `5 files x 1 MB`.
5. **FIT/FIT.GZ parser (closed 0.1-06):** **v1 in scope** — `.fit` and `.fit.gz` (case-insensitive). Primary library **`fit-file-parser`** (npm); `.fit.gz` via `DecompressionStream('gzip')` then FIT binary parse. Evidence: [`docs/milestones/0.1/evidence/fit-parser-spike.md`](milestones/0.1/evidence/fit-parser-spike.md). See [§2.5](#25-v1-fitfitgz-parser-decision-0106) for bundle impact, constraints, alternate rejected path, and production wiring (**0.4**). Milestone **0.4** may proceed on this parser path.
6. **Technical design file location:** `docs/TECHNICAL_DESIGN.md`.

### 2.1 v1 local storage (decision 0.1-05)

| Item | Decision |
|------|----------|
| **v1 storage adapter** | **sql.js** (`SQL.Database`), SQLite-compatible logical schema from §6 |
| **Persistence** | `{vault}/.obsidian/plugins/trackdex-obsidian/index.sqlite` via `app.vault.adapter.readBinary` / `writeBinary` (`db.export()` on save, load bytes on open) |
| **WASM bundling** | Inlined WASM binary at build time (`trackdex:sql-wasm` esbuild plugin); `initSqlJs({ wasmBinary })` — no separate `.wasm` asset in the plugin folder (required for mobile packaging) |
| **Not used for index** | `plugin.loadData()` / `saveData()` (JSON-only, unsuitable for large binary DB) |
| **Fallback adapter** | **IndexedDB** object-store adapter — **only** if sql.js fails on a target platform during bootstrap or smoke checks; spike did not require it on desktop or Android |
| **`manifest.json` `isDesktopOnly`** | **`false`** — unchanged; desktop and Android operator smoke passed CRUD + reload + verify ([storage spike evidence](milestones/0.1/evidence/storage-spike.md#operator-evidence)) |
| **v1 scope (0.2+)** | Full logical schema (§6), migrations, repositories; same load/export persist model as spike until profiling says otherwise |

**Sync implications (v1):** `index.sqlite` lives under the plugin data directory and may sync with the vault (Obsidian Sync, git, etc.). v1 does not auto-exclude the file from sync. Document size and sync conflict risk in README (0.2): concurrent writes to `index.sqlite` on two devices can corrupt SQLite; v1 policy is reindex on a new device / single-writer expectation (see `docs/CONCEPT.md`), not automatic merge.

**Rejected for v1** (see spike): native `better-sqlite3` / Node `fs`, Capacitor SQLite, OPFS / SharedArrayBuffer–only stacks, in-memory-only sql.js without file persist.

**Mobile API blocklist (storage adapters):** no Node `fs`/`path`/`child_process`, no paths outside `vault.adapter`, no OPFS/SAB as hard dependencies, no remote DB. Allowed: `vault.adapter` binary I/O, `indexedDB`, WebAssembly via sql.js.

**Risks carried into 0.2:** full-database load/save in memory (~bundle add-on ~0.9 MB minified when sql.js is in `main.js`); monitor memory and save latency on Android at scale; track bundle size in 0.1-14 acceptance.

**PoC / bootstrap map:** spike code under `src/infrastructure/storage/candidates/` (`ENABLE_STORAGE_SPIKE`, default `false`); production facade `storage-adapter.ts` + `migrations.ts` in **0.1-09**.

### 2.5 v1 FIT/FIT.GZ parser (decision 0.1-06)

| Item | Decision |
|------|----------|
| **v1 format scope** | **In scope** — `.fit` and `.fit.gz` remain Must formats (aligned with `docs/REQUIREMENTS.md` / `docs/PRODUCT_SPEC_V1.md`) |
| **Primary parser library** | **`fit-file-parser`** (npm) — ES module; maps to `ParsedTrack` via infrastructure adapter |
| **`.fit.gz` decompress** | `DecompressionStream('gzip')` on raw vault bytes, then parse FIT binary — no Node `zlib` / `fs` in plugin path ([`gunzip.ts`](../src/infrastructure/parsers/candidates/gunzip.ts) spike) |
| **Production modules (0.4)** | `fit-parser.ts` + `fit-gz-parser.ts` (or shared decompress helper) behind `parser-router.ts`; domain/application use `TrackParserPort` only |
| **Alternate (not v1 primary)** | **`@garmin-fit/sdk`** — larger bundle (~0.31 MB isolated vs ~0.13 MB); numeric sport enums need profile lookup; spike reference only — **remove in milestone 0.4** after production `fit-file-parser` wiring (fails on compressed-timestamp FIT; see `docs/IMPLEMENTATION_PLAN.md` §0.4) |
| **`manifest.json` `isDesktopOnly`** | **`false`** — unchanged; parser path must not rely on desktop-only APIs |
| **Gate status** | **Go with constraints** — Node fixture parse PASS for both candidates; Obsidian desktop/mobile manual smoke **not run** at spike time (see constraints below) |

**Bundle impact (measured 2026-05-29, spike evidence):**

| Artifact | Size |
|----------|------|
| Production `main.js` (FIT spike off) | ~1.49 MB |
| `fit-file-parser` (isolated minified) | ~0.13 MB |
| Rough estimate with FIT parser in `main.js` | ~1.62 MB (main + fit-file-parser) |

**Spike validation (automated):** `tests/fixtures/sample-activity.fit` and `sample-activity.fit.gz` → `ParsedTrack` (3228 GPS points, laps, bbox, sport, timestamps); cold parse ~29 ms (fit-file-parser, Node 22, ~95 KB FIT). No `TrackParserPort` contract change required (**0.1-02**).

**Constraints carried into 0.4 / release:**

- Run Obsidian manual smoke on desktop and Android (commands `fit-spike-smoke` / `fit-spike-garmin-sdk` with `ENABLE_FIT_PARSER_SPIKE`) before treating mobile parse time/memory as baselined.
- Re-check bundle size when wiring production parser (`npm run measure-bundle`).
- HR may be absent on some FIT files (fixture had power/cadence only); UI must tolerate missing optional fields per data flags.

**Rejected / deferred (spike):**

| Option | Reason |
|--------|--------|
| **Exclude FIT/FIT.GZ from v1** | Not chosen — automated feasibility PASS; Must formats unchanged |
| **Desktop-only native parser** | Violates mobile parity |
| **`@garmin-fit/sdk` as primary** | ~2.4× larger isolated bundle; fit-file-parser sufficient for `ParsedTrack` mapping |
| **Node `zlib` for `.fit.gz`** | Unavailable / undesirable in mobile Obsidian plugin path |

**Mobile API blocklist (parser adapters):** no Node `fs`/`zlib`/`child_process`, no dynamic native deps, no paths outside vault adapter for file bytes. Allowed: `ArrayBuffer` / `Uint8Array` from vault, `DecompressionStream`, bundled JS parser.

**Risks carried into 0.4:** manual mobile smoke gap; large user FIT files on Android (memory, parse latency); `DecompressionStream` availability on oldest mobile WebViews (fail gracefully with parse error).

**PoC / production map:** spike under `src/infrastructure/parsers/candidates/` (`ENABLE_FIT_PARSER_SPIKE`, default `false`); production `fit-parser.ts`, `fit-gz-parser.ts`, `parser-router.ts` in **0.4** (not **0.1**).

## 3. Architecture overview

Plugin follows layered architecture with strict dependency direction:

- **UI layer**
  - Obsidian views, sidebar, settings tab, commands, progress panel.
  - Uses application services only.
- **Application layer**
  - Orchestrates indexing pipeline, reindex workflows, query/read models.
  - Contains use-cases and state machines.
- **Domain layer**
  - Pure business logic: metric computation, geometry matching rules, normalization, status transitions.
  - No direct dependency on Obsidian APIs, storage adapters, parser libraries, or map library.
- **Infrastructure layer**
  - Storage adapter, file parsers (GPX/TCX/FIT/FIT.GZ), Obsidian event adapters, logging, map tile adapter.

Dependency rule: `UI -> Application -> Domain`, while Infrastructure is injected into Application via interfaces.

## 4. Proposed module structure

```text
src/
  main.ts
  composition/
    container.ts
  application/
    services/
      indexing-service.ts
      place-reindex-service.ts
      link-index-service.ts
      track-query-service.ts
    workflows/
      first-scan-consent.ts
      resume-after-interrupt.ts
    ports/
      repositories.ts
      parser-port.ts
      logger-port.ts
      clock-port.ts
      metrics-port.ts
  domain/
    track/
      track-entity.ts
      track-status.ts
      compute-metrics.ts
      timezone-normalization.ts
    place/
      place-entity.ts
      geometry.ts
      match-track-to-place.ts
    links/
      note-track-link.ts
    shared/
      result.ts
      errors.ts
  infrastructure/
    storage/
      storage-adapter.ts
      migrations.ts
      repositories/
        track-repository.ts
        place-repository.ts
        link-repository.ts
        index-meta-repository.ts
      candidates/
        sqlite-wasm-storage-adapter.ts
        indexed-db-storage-adapter.ts
    parsers/
      parser-feasibility.ts
      gpx-parser.ts
      tcx-parser.ts
      fit-parser.ts
      fit-gz-parser.ts
      parser-router.ts
    obsidian/
      vault-events-adapter.ts
      metadata-link-adapter.ts
      commands-registry.ts
    logging/
      rotating-file-logger.ts
    map/
      tile-provider.ts
      map-view-adapter.ts
  ui/
    views/
      track-view.ts
      tracks-sidebar-view.ts
    settings/
      settings-tab.ts
    components/
      indexing-progress.ts
      empty-state-first-scan.ts
      status-badges.ts
    i18n/
      en.ts
      ru.ts
```

`main.ts` remains thin: bootstrap DI container, register commands/views/events, load settings, dispose resources on unload.

## 5. Core interfaces (abstractions)

Application and domain logic must depend on interfaces:

- `TrackRepository`
  - CRUD/upsert for track index entries.
  - status updates (`pending/indexing/indexed/stale/error`).
  - query for sidebar and track view.
- `PlaceRepository`
  - upsert places from notes, validation/error status.
  - relation operations to `track_places`.
- `NoteLinkRepository`
  - upsert links from markdown notes to track files.
- `IndexMetaRepository`
  - `schemaVersion`, `firstScanApproved`, `scanPaused`, `lastFullScanAt`, interrupted run marker.
- `TrackParserPort`
  - parse file into normalized intermediate model.
- `LoggerPort`
  - structured logging with levels.
- `PerfMetricsPort`
  - write measurement events/counters/timers.

Concrete storage repositories are adapter implementations of these ports backed by **sql.js** (§2.1). **IndexedDB** remains a documented fallback adapter only if sql.js cannot be initialized on a platform; it is not the primary v1 path.

FIT/FIT.GZ parsers are infrastructure implementations of `TrackParserPort` backed by **`fit-file-parser`** (§2.5). `.fit.gz` adapters decompress with **`DecompressionStream('gzip')`** before parse. Parser libraries are bundled via esbuild (no dynamic native/Node-only deps). Production wiring and fixture matrix expansion are milestone **0.4**; feasibility gate is **closed (0.1-06)** with residual manual mobile smoke noted in §2.5.

## 6. Data model (logical schema v1)

Schema reflects logical model from requirements; computed-only metrics are persisted in dedicated fields. Table names below describe the canonical logical model. If the selected storage engine is not SQL, it must preserve equivalent records, keys, indexes/query paths, and migration semantics.

### 6.1 Tables

1. `tracks`
   - `path TEXT PRIMARY KEY`
   - `mtime_ms INTEGER NOT NULL`
   - `sha256 TEXT NULL` (optional change fingerprint only; duplicate-detection UX remains out of scope)
   - `status TEXT NOT NULL CHECK status IN (...)`
   - `error_message TEXT NULL`
   - `error_details TEXT NULL`
   - `title_from_file TEXT NULL`
   - `started_at_utc TEXT NULL`
   - `ended_at_utc TEXT NULL`
   - `started_at_raw TEXT NULL`
   - `ended_at_raw TEXT NULL`
   - `timezone_source TEXT NOT NULL` (`explicit|indexing_local|unknown`)
   - `timezone_offset_min INTEGER NULL`
   - `duration_sec REAL NULL`
   - `distance_m REAL NULL`
   - `elevation_gain_m REAL NULL`
   - `elevation_loss_m REAL NULL`
   - `avg_speed_mps REAL NULL`
   - `max_speed_mps REAL NULL`
   - `sport_raw TEXT NULL`
   - `sport_normalized TEXT NULL`
   - `bbox_json TEXT NULL`
   - `polyline_simplified_json TEXT NULL`
   - `segments_json TEXT NULL`
   - `data_flags_json TEXT NOT NULL`
   - `hr_avg REAL NULL`
   - `hr_max REAL NULL`
   - `power_avg REAL NULL`
   - `cadence_avg REAL NULL`
   - Indexes: `(status)`, `(started_at_utc)`, `(sport_normalized)`.

2. `places`
   - `note_path TEXT PRIMARY KEY`
   - `geometry_kind TEXT NOT NULL`
   - `geometry_json TEXT NOT NULL`
   - `bbox_json TEXT NULL`
   - `is_valid INTEGER NOT NULL`
   - `error_message TEXT NULL`
   - Index: `(is_valid)`.

3. `track_places`
   - `track_path TEXT NOT NULL`
   - `place_note_path TEXT NOT NULL`
   - `last_visit_at_utc TEXT NULL`
   - PK `(track_path, place_note_path)`.
   - Indexes `(place_note_path, last_visit_at_utc)`.

4. `note_track_links`
   - `note_path TEXT NOT NULL`
   - `track_path TEXT NOT NULL`
   - `link_text TEXT NOT NULL`
   - PK `(note_path, track_path, link_text)`.
   - Indexes `(track_path)`, `(note_path)`.

5. `index_meta`
   - single-row KV or normalized key/value schema.
   - Required keys: `schema_version`, `first_scan_approved`, `scan_paused`, `last_full_scan_at_utc`, `last_run_interrupted`.

### 6.2 Migration policy

- Use explicit migration scripts with monotonic `schema_version`.
- On plugin load: run pending migrations inside transaction.
- On migration failure: surface clear error in UI; plugin should remain non-destructive.
- Milestone 0.1 must validate that the selected adapter supports these migration semantics on both desktop and mobile.

## 7. Indexing and processing design

## 7.1 First scan and lifecycle

1. Plugin start:
   - load settings + meta.
   - if `first_scan_approved=false`: show first-scan empty state.
2. User confirms first scan:
   - set `first_scan_approved=true`.
   - enqueue full scan job.
3. Future starts:
   - if not paused: incremental listeners active.
   - if previous run interrupted: show banner/button "check and continue".

## 7.2 Scanning strategy

- Vault recursive discovery for supported extensions, case-insensitive.
- Default excludes: `.obsidian/**`, `.trash/**`.
- Additional user excludes: glob/ignore-like vault-relative patterns.
- Event-driven incrementals: `create`, `modify`, `delete`, `rename`.
- Work queue with bounded concurrency (default `2` desktop, `1` mobile).
- Micro-batches with yield to event loop to keep UI responsive.

## 7.3 File state machine

`pending -> indexing -> indexed`
`pending/indexing -> error`
`indexed -> stale -> indexing`

Deletion flow: remove row and all relations for deleted track path.
Rename flow: update path atomically when possible, otherwise delete+reinsert with relation remap.

## 7.4 Parser pipeline

Per file:
1. mark `indexing`.
2. parse by extension router.
3. normalize to unified intermediate model.
4. compute deterministic metrics (domain services).
5. simplify polyline for map rendering.
6. persist row as `indexed` with flags OR `error` with details.

Broken/unparseable file is kept visible in catalog with `error`.

## 8. Metrics and normalization (computed-only)

Rules implemented in domain services:

- `track_date`: first point timestamp / start time by format.
- `elapsed_sec`: last timestamp - first timestamp.
- `distance_m`: sum of segment distances between consecutive points.
- `avg_speed_mps`: `distance / elapsed` when elapsed > 0.
- `max_speed_mps`: from samples if present, else derived from point deltas if feasible.
- Multi-segment/multi-track files are normalized as one catalog record; metrics aggregate across all segments and `segments_json` preserves segment metadata needed for the view.
- `elevation_gain/loss`:
  - for each adjacent pair, `delta_h`,
  - include in gain only if `delta_h >= 3m`,
  - include in loss only if `delta_h <= -3m` using absolute.
- optional fields (HR/cadence/power) only when present.
- missing fields represented via `data_flags_json`; no fake fallback values.

`file_metrics_json` is omitted from v1 display pipeline (stored only if future compatibility needed, optional).

## 9. Timezone model

- If source has explicit timezone/offset:
  - keep raw timestamp string,
  - store normalized UTC,
  - `timezone_source=explicit`.
- If source lacks timezone:
  - interpret as local at indexing moment,
  - store raw + computed UTC + indexing offset,
  - `timezone_source=indexing_local`.
- UI always renders in current local timezone and shows timezone source/offset metadata.

No manual timezone override in v1.

## 10. Places and geometry matching

## 10.1 Place source

Place is note with frontmatter:
- `trackdex-type: place`
- `trackdex-geometry` with `kind` in `point|circle|rectangle|polygon`.

Invalid YAML/geometry:
- place row marked invalid with error message,
- not used in `track_places`.

## 10.2 Geometry rules

v1 rule: track belongs to place if **at least one track point** is inside geometry.

Supported:
- `point` (+ default or explicit radius),
- `circle`,
- `rectangle` (south/west/north/east),
- `polygon` (single outer ring only, no holes).

Implementation detail:
- prefilter by bbox intersection first,
- then exact point-in-geometry checks.

## 10.3 Reindex strategy

- Auto reindex on place note change (debounced).
- Manual command "Reindex places" recalculates all `track_places`.
- When place marker removed, corresponding relations are deleted.

## 11. Note link indexing

- Scan markdown notes through Obsidian metadata/link APIs.
- Resolve links with native Obsidian resolution.
- Persist many-to-many relations in `note_track_links`.
- Refresh on `.md` changes; avoid full rescan when incremental event is enough.

## 12. UI and command integration

## 12.1 Views

- `TrackView`:
  - desktop split: map left, stats right,
  - mobile tabs: map/stats,
  - graceful map fallback without tiles.
- `TracksSidebarView`:
  - group by date/place/sport,
  - sort by date/distance/duration,
  - filter by status/error, sport, place, date range,
  - month/year/custom range aggregates for distance and elapsed hours with sport filter,
  - badges for status/errors/missing fields.

## 12.2 Commands (stable IDs)

- `scan-or-resume-indexing`
- `reindex-places`
- `make-current-note-place`
- `edit-current-place-geometry`
- `pause-indexing`
- `reset-rebuild-index`

Display names can be localized; IDs remain stable.

## 12.3 Settings

- Units metric/imperial.
- Exclude patterns.
- Default POI radius.
- Pause/resume indexing.
- Reset/rebuild index with confirmation.
- Legal/privacy section for tiles/network/attribution.

## 13. Logging and diagnostics

- Local rotating log files in `.obsidian/plugins/trackdex-obsidian/logs/`.
- Rotation policy hardcoded: **5 files x 1 MB**.
- No automatic upload/telemetry.
- Error UI shows short message + expandable technical details.
- Logs and index files live under the plugin data directory and may be included in vault sync depending on the user's sync tool/settings. v1 does not automatically exclude them from sync; README documents the location and size controls.

Suggested log events:
- scan start/end,
- file parse start/end/error,
- batch timing,
- place reindex timing,
- link reindex timing,
- migration start/end/error.

## 14. Performance targets and measurement plan

Targets are set as realistic engineering thresholds for v1 and can be tuned after baseline runs.

## 14.1 Acceptance targets (SLO-like for v1)

Test dataset profile:
- 2,000 track files,
- total track file size ~500 MB,
- 10,000 markdown notes,
- 500 place notes.

Targets:
1. Full initial indexing on desktop (mid-range laptop): **<= 20 min**.
2. Incremental reindex single modified track: **p95 <= 3 s** from vault event to `indexed`.
3. Place full reindex (500 places, 2,000 tracks): **<= 90 s**.
4. Markdown links incremental update for one note: **p95 <= 500 ms**.
5. Plugin startup overhead (without first full scan): **<= 1.5 s** until UI ready.
6. UI responsiveness during indexing:
   - no continuous main-thread block > 100 ms.
7. Memory envelope:
   - desktop steady-state indexing process overhead **<= 300 MB** plugin-related peak,
   - mobile target **<= 180 MB** plugin-related peak.

These are engineering thresholds, not strict user-visible SLA. Desktop targets are v1 release gates. Mobile targets remain aspirational until FIT parser manual mobile baseline exists (§2.5 — automated Node baseline only as of **0.1-06**); **storage** mobile feasibility is confirmed (sql.js + `index.sqlite` on desktop and Android, 0.1-03 spike).

## 14.2 How actual values are measured

Implement lightweight internal performance instrumentation:

- `perf_runs` structured log records:
  - `run_id`, `operation`, `started_at`, `ended_at`, `duration_ms`, `items_count`, `success`, optional context.
- `perf_counters`:
  - files scanned, files parsed, parse errors, places reindexed, links updated.
- Sampling for event latency:
  - record timestamp on vault event reception and on indexed persistence.
- Optional debug command:
  - "Export performance report" generates JSON summary with p50/p95/p99.

Comparison method:
1. Execute benchmark scenarios on reference dataset.
2. Export report JSON.
3. Compare observed p95/total durations to thresholds in `14.1`.
4. Mark each target `PASS/FAIL`.

Recommended artifacts:
- `docs/perf-baseline-v1.json` (generated, not hand-edited),
- short markdown summary in release prep.

## 15. Testing strategy

1. **Unit tests (domain)**
   - distance/elevation/time calculations.
   - timezone normalization.
   - geometry predicates.
2. **Integration tests (application + storage adapter)**
   - indexing state transitions,
   - migration behavior,
   - incremental update flows.
3. **Parser fixture tests**
   - GPX/TCX/FIT/FIT.GZ valid, partial, malformed.
   - multi-segment aggregation.
   - FIT/FIT.GZ parser compatibility fixtures from the feasibility gate.
4. **UI smoke tests**
   - open track view by click,
   - sidebar grouping/filtering,
   - first-scan consent UX.
5. **Performance baseline tests**
   - scenario runs with performance report generation.

## 16. Delivery plan (phased)

1. Foundation:
   - interfaces, DI container, storage decision recorded (0.1-05), storage adapter bootstrap + migrations skeleton (0.1-09), FIT parser feasibility spike, FIT decision (0.1-06), parser implementation in later milestones.
2. Indexing core:
   - scanner, queue, statuses, first-scan flow.
3. Parsers + computed metrics:
   - GPX/TCX/FIT/FIT.GZ normalization and domain metrics.
4. UI:
   - track view, sidebar, progress panel, settings.
5. Places + links:
   - frontmatter parsing, geometry matching, note link indexing.
6. Hardening:
   - logging rotation, error details, performance instrumentation.
7. Test and polish:
   - i18n EN/RU, compatibility checks desktop/mobile.

## 17. Risks and mitigations (implementation)

- **Large-vault performance drift**
  - mitigate with bounded concurrency, batching, cached derived fields.
- **Parser variability across formats**
  - normalize through strict intermediate model + fixture matrix.
- **Mobile constraints**
  - mobile-specific concurrency defaults and memory guards.
- **Map provider instability**
  - degrade gracefully to geometry-only rendering without tiles.
- **Abstraction erosion**
  - enforce lint/code review rule: domain/application must not import storage adapters or parser libs directly.

## 18. Definition of done for technical implementation

Technical implementation is considered done when:
- all Must requirements from `docs/REQUIREMENTS.md` are implemented,
- architecture layering and repository abstraction are respected,
- the selected storage engine is only used behind infrastructure adapters and is verified on desktop/mobile,
- computed-only metrics are displayed in UI,
- performance report can be generated and compared to thresholds,
- automated tests cover critical domain and integration paths,
- no violations of privacy/offline/read-only principles.

