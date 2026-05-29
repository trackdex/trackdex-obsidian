# Milestone 0.3 acceptance evidence

**Date:** 2026-05-29  
**Version:** 0.0.2 (`manifest.json`)  
**Result:** PASS

## Automated verification

Run on branch `milestone_0.3`:

```bash
npm run build   # exit 0 (tsc + esbuild + test:bundle 5 tests)
npm run lint    # exit 0
npm test        # exit 0 (133 unit tests)
```

Architecture gate: `tests/import-boundaries.test.mjs` (3 tests) — storage/parser npm packages confined to `src/infrastructure/**`.

## Task coverage (0.3-01 … 0.3-11)

| Task | Key tests / artifacts |
|------|----------------------|
| 0.3-01 | `tests/vault-scanner.test.mjs` |
| 0.3-02 | `tests/exclude-matcher.test.mjs` |
| 0.3-03 | `tests/work-queue.test.mjs` |
| 0.3-04 | `tests/file-status.test.mjs` |
| 0.3-05 | `tests/vault-index-events.test.mjs` |
| 0.3-06 | `tests/indexing-service.test.mjs` (approveFirstScan) |
| 0.3-07 | `tests/resume-after-interrupt.test.mjs`, `tests/views.test.mjs` (banner wiring) |
| 0.3-08 | `tests/full-scan.test.mjs` |
| 0.3-09 | `tests/incremental-index.test.mjs` |
| 0.3-10 | `tests/scan-progress.test.mjs` |
| 0.3-11 | `tests/indexing-service.test.mjs` (E2E vault scan → DB statuses) |

## Manual Obsidian smoke (operator)

Optional for automated gate; recommended before user-facing release:

1. Install built plugin (`main.js`, `manifest.json`, `styles.css`) into a test vault.
2. Enable plugin → open **Track catalog** sidebar → confirm first-scan consent appears; no scan until **Start indexing**.
3. Approve scan → confirm progress counters move; GPX/TCX/FIT files under vault get `pending` status in index.
4. Add/rename/delete a track file → confirm incremental status update (sidebar refresh or re-open).
5. Force-quit Obsidian mid-scan → reload → confirm interrupted banner; **Resume indexing** clears flag and restarts.
6. (Mobile) Repeat steps 2–5 on iOS or Android if available.

## Gate for 0.4

Scan pipeline enqueues parse jobs (`full-scan.test.mjs`, `incremental-index.test.mjs`); production parser implementation deferred to milestone 0.4.

## Manual smoke follow-ups (backlog)

Operator feedback after smoke test — tracked for **0.5 / 0.6 / 0.9**, not blocking 0.3 gate:

→ [manual-smoke-follow-ups.md](./manual-smoke-follow-ups.md)
