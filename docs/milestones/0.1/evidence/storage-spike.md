# Storage compatibility spike (0.1-03)

**Date:** 2026-05-28  
**Milestone:** 0.1-03 — Spike: совместимость локального хранилища  
**Target:** `isDesktopOnly: false` (mobile + desktop Obsidian)

## Summary / recommendation

| Decision | Choice |
|----------|--------|
| **Primary v1 adapter (recommended)** | **sql.js** (SQLite WASM) with persistence via `app.vault.adapter` `readBinary` / `writeBinary` to `{vault}/.obsidian/plugins/trackdex-obsidian/index.sqlite` |
| **Fallback** | **IndexedDB** (native browser API, object store mirroring spike meta CRUD) — use only if sql.js fails on a target platform |
| **`isDesktopOnly` for v1** | **`false`** — confirmed on **desktop and Android** (see [Operator evidence](#operator-evidence)) |
| **Production wiring** | Deferred to **0.1-09**; spike behind `ENABLE_STORAGE_SPIKE` (default `false`) |

**Gate status:** **Closed for primary adapter (sql.js)** — automated Node checks pass; **desktop and Android** Obsidian manual smoke pass (CRUD + reload + verify, 2026-05-28). Ready for **0.1-05**.

---

## Repro steps

### Prerequisites

1. `npm install`
2. Set `ENABLE_STORAGE_SPIKE = true` in [`src/infrastructure/storage/candidates/spike-config.ts`](../../../src/infrastructure/storage/candidates/spike-config.ts)
3. `npm run build`
4. Deploy plugin to vault: `npm run deploy` or copy `main.js`, `manifest.json`, `styles.css` to `<vault>/.obsidian/plugins/trackdex-obsidian/`
5. Enable plugin in **Settings → Community plugins**

### Desktop (Obsidian)

1. Command palette → **Trackdex: Run storage spike smoke test** (`storage-spike-smoke`)
2. Note the Notice (marker timestamp + path to `index.sqlite`)
3. **Reload plugin** (disable/enable) or restart Obsidian
4. Command palette → **Trackdex: Verify storage spike (after reload)** (`storage-spike-verify`)
5. Confirm Notice: `Verify OK` with the same marker
6. On disk: confirm `<vault>/.obsidian/plugins/trackdex-obsidian/index.sqlite` exists and grows after step 1

### Android (Obsidian mobile)

Same steps 1–5 on Android with the same vault (Obsidian Sync or copied plugin folder). Record: crash/OOM, cold-open time, file size after CRUD.

### IndexedDB fallback (optional)

Command palette → **Trackdex: Run storage spike (IndexedDB fallback)** (`storage-spike-indexeddb`). Data lives in browser IndexedDB (`trackdex-storage-spike`), not `index.sqlite`.

### Automated (CI / dev machine)

```bash
npm run build          # ENABLE_STORAGE_SPIKE=false — must pass
npm test               # includes tests/storage-spike.test.mjs
npm run measure-bundle # after build; reports main.js vs sql.js add-on
```

Reset `ENABLE_STORAGE_SPIKE` to `false` before merging to keep production `main.js` lean.

---

## Operator evidence

### Android (Obsidian mobile) — **PASS** (2026-05-28)

| Step | Command | Result | Marker |
|------|---------|--------|--------|
| 1. CRUD + persist | `storage-spike-smoke` | Notice: `CRUD OK; persisted marker=…` | `1779978309530` |
| 2. Reload plugin | disable/enable or app restart | — | — |
| 3. Verify | `storage-spike-verify` | Notice: `Verify OK: marker=1779978309530` | **same** as step 1 |

**Interpretation:** The marker survived plugin reload → `index.sqlite` (or equivalent vault adapter path) round-trip works on Android WebView with inlined sql.js WASM. No crash/OOM observed in the provided session (map view remained usable between steps).

**Screenshots (operator):**

1. CRUD — ~18:25 local, map view + notice `Trackdex storage spike: CRUD OK; persisted marker=1779978309530`
2. Verify — ~18:27 local, notice `Trackdex storage verify: Verify OK: marker=1779978309530`

IndexedDB fallback was **not** needed (sql.js primary path passed).

### Desktop (Obsidian) — **PASS** (2026-05-28)

Same scenario as Android: `storage-spike-smoke` → reload plugin → `storage-spike-verify`.

| Step | Result |
|------|--------|
| CRUD + persist | `CRUD OK` with persisted marker (timestamp) |
| Reload plugin | — |
| Verify | `Verify OK` with **the same marker** as smoke step |

**Interpretation:** `index.sqlite` round-trip via `vault.adapter` works on desktop Electron runtime with the same spike build. Outcome analogous to Android (including shared marker when using the same vault).

IndexedDB fallback **not** required on desktop.

---

## Results matrix

| Criterion | sql.js + vault file | IndexedDB fallback | Notes |
|-----------|---------------------|--------------------|-------|
| Node CRUD | **PASS** | N/A (browser-only) | `tests/storage-spike.test.mjs` |
| Node persist (export/import) | **PASS** | N/A | Simulates `index.sqlite` round-trip |
| `npm run build` (spike off) | **PASS** | — | No `SQL_WASM_BASE64` in `main.js` |
| esbuild + WASM | **PASS** | — | WASM inlined via `trackdex:sql-wasm` esbuild plugin |
| Desktop Obsidian CRUD + reload | **PASS** | **Not run** | Analogous to Android; see [Operator evidence](#operator-evidence) |
| Android CRUD + reload | **PASS** | **Not run** | Marker `1779978309530` (screenshots); see [Operator evidence](#operator-evidence) |
| Bundle size (order of magnitude) | ~**+0.9 MB** minified | negligible add-on | See [Bundle](#bundle) |
| Persistence path | `.obsidian/plugins/trackdex-obsidian/index.sqlite` | `indexeddb://trackdex-storage-spike` | |
| Vault sync | Plugin data dir may sync with vault | IDB not in vault files | Documented in PRODUCT_SPEC |

---

## Bundle

Measured 2026-05-28 (`npm run build` then `npm run measure-bundle`):

| Artifact | Size |
|----------|------|
| Production `main.js` (`ENABLE_STORAGE_SPIKE=false`) | **~1.03 MB** (1 085 095 bytes) |
| sql.js + embedded WASM (isolated minified bundle) | **~0.87 MB** (915 931 bytes) |
| Raw `sql-wasm.wasm` on disk | **~0.62 MB** (652 953 bytes) |
| Rough estimate with spike enabled | **~1.9 MB** (main + sql.js add-on) |

**Approach:** esbuild plugin resolves `trackdex:sql-wasm` to a base64-inlined `getSqlWasmBinary()`; `initSqlJs({ wasmBinary })` avoids loading a separate `.wasm` file from the plugin folder (important for Obsidian mobile packaging).

---

## Persistence

| Item | Value |
|------|--------|
| **File** | `index.sqlite` |
| **Directory** | `{vault}/.obsidian/plugins/trackdex-obsidian/` |
| **API** | `plugin.app.vault.adapter.readBinary` / `writeBinary` |
| **Format** | SQLite binary (sql.js `db.export()` / `new SQL.Database(bytes)`) |
| **Spike table** | `_spike_meta(key, value)` — removed before 0.2 real schema |
| **Sync** | Plugin folder may be included in vault sync (Obsidian Sync, git, etc.); `index.sqlite` travels with plugin data. v1 does not auto-exclude; README should document size/sync (0.2). |

**Not used:** `plugin.loadData()` / `saveData()` for the index (JSON only, unsuitable for large binary DB).

---

## Rejected options

| Option | Reason |
|--------|--------|
| **better-sqlite3** / native **sqlite3** | Node/native bindings; not available in Obsidian mobile WebView |
| **Node `fs` / `child_process`** | Unavailable on mobile; violates vault-sandbox model |
| **Capacitor SQLite plugin** | Not exposed to community plugins |
| **sqlite3-wasm + OPFS / SharedArrayBuffer** | OPFS / SAB not reliable in Obsidian mobile (see [datacore#6](https://github.com/blacksmithgu/datacore/issues/6)); not pursued beyond brief review |
| **wa-sqlite OPFS VFS** | Same mobile OPFS constraints; higher complexity than sql.js + file export |
| **sql.js without file persist** | In-memory only — fails reload gate |

---

## Mobile API blocklist (infrastructure)

Do **not** use in storage adapters:

- Node: `fs`, `path`, `child_process`, `worker_threads`, `require('better-sqlite3')`
- Direct filesystem paths outside `app.vault.adapter`
- **OPFS / SharedArrayBuffer** as hard dependencies without file-based fallback
- Remote DB hosting or network persistence for the index

**Allowed:** `vault.adapter` binary I/O, `indexedDB`, `WebAssembly` via sql.js, in-memory processing with explicit persist/export.

---

## Risks for 0.2

1. **Full-database load/save:** sql.js loads entire `index.sqlite` into memory on open and rewrites on persist. Acceptable for spike; at ~2k tracks / ~500 MB source files, monitor memory and save latency on Android.
2. **Bundle size:** ~0.9 MB add-on when spike is enabled in production build — within typical Obsidian plugin range but should be tracked in 0.1-14 acceptance.
3. **Sync conflicts:** Two devices writing `index.sqlite` via sync can corrupt SQLite; v1 documents “reindex on new device” (CONCEPT) — no automatic merge.

---

## Open questions

- [x] Operator: confirm **Android** smoke — **PASS** 2026-05-28, marker `1779978309530`
- [x] Operator: confirm **desktop** smoke — **PASS** 2026-05-28 (same flow; matching marker)
- [x] IndexedDB fallback — not required (sql.js passed on desktop and Android)

---

## PoC code map

| File | Role |
|------|------|
| [`src/infrastructure/storage/candidates/spike-config.ts`](../../../src/infrastructure/storage/candidates/spike-config.ts) | `ENABLE_STORAGE_SPIKE` flag |
| [`src/infrastructure/storage/candidates/sql-js-spike-adapter.ts`](../../../src/infrastructure/storage/candidates/sql-js-spike-adapter.ts) | Primary adapter |
| [`src/infrastructure/storage/candidates/indexed-db-spike-adapter.ts`](../../../src/infrastructure/storage/candidates/indexed-db-spike-adapter.ts) | Fallback adapter |
| [`src/infrastructure/storage/candidates/register-storage-spike-command.ts`](../../../src/infrastructure/storage/candidates/register-storage-spike-command.ts) | Dev commands |
| [`tests/storage-spike.test.mjs`](../../../tests/storage-spike.test.mjs) | Automated CRUD/persist |
| [`scripts/build.mjs`](../../../scripts/build.mjs) | `sql-wasm-embed` esbuild plugin |

---

## Milestone checklist (0.1-03)

- [x] Reproducible steps (this document + spike commands)
- [x] Results per criterion (matrix above; manual cells marked)
- [x] Recommendation (sql.js primary, IndexedDB fallback, `isDesktopOnly: false` — **desktop + Android confirmed**)
- [x] Rejected variants listed
- [x] Spike does not break `npm run build` with default flag

**Blocks:** [0.1-05](../0.1-05-record-storage-decision.md) (record decision in TECHNICAL_DESIGN), [0.1-09](../0.1-09-storage-bootstrap-migrations-skeleton.md) (bootstrap adapter).
