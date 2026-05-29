# FIT parser feasibility spike (0.1-04)

**Date:** 2026-05-29  
**Milestone:** 0.1-04 — Spike: feasibility парсера FIT / FIT.GZ  
**Target:** `isDesktopOnly: false` (mobile + desktop Obsidian)

## Summary / recommendation

| Decision | Choice |
|----------|--------|
| **Primary v1 parser (recommended)** | **`fit-file-parser`** (npm) — ES module, maps cleanly to `ParsedTrack`, smaller bundle |
| **Alternate / reference** | **`@garmin-fit/sdk`** — official decoder; larger bundle; numeric sport enums need profile lookup in production |
| **`.fit.gz` strategy** | `DecompressionStream('gzip')` on raw vault bytes, then parse FIT binary (no Node `zlib` in plugin path) |
| **Gate status** | **Closed (0.1-06)** — go with constraints; recorded in `docs/TECHNICAL_DESIGN.md` §2.5; Obsidian manual smoke still pending before 0.4/release |
| **Production wiring** | Deferred to **0.4**; spike behind `ENABLE_FIT_PARSER_SPIKE` (default `false`) |

**Constraints for v1:** bundle adds ~0.13 MB (fit-file-parser) on top of current `main.js`; validate cold-parse time and memory on Android with real user FIT files before **0.4** / release (manual smoke plan below).

---

## Repro steps

### Prerequisites

1. `npm install`
2. Fixtures: `tests/fixtures/sample-activity.fit` and `sample-activity.fit.gz` (gz = gzip of the same file)
3. Automated: `npm test` (includes `tests/fit-parser-spike.test.mjs`)
4. Bundle: `npm run build` then `npm run measure-bundle`

### Obsidian manual smoke (operator)

1. Set `ENABLE_FIT_PARSER_SPIKE = true` in [`src/infrastructure/parsers/candidates/spike-config.ts`](../../../src/infrastructure/parsers/candidates/spike-config.ts)
2. `npm run build` and deploy plugin to vault
3. Copy a `.fit` or `.fit.gz` track into the vault (e.g. under `tracks/`). After rebuild, `.fit.gz` should appear in the file explorer (plugin registers `gz`; Obsidian only uses the last path segment as `TFile.extension`).
4. Command palette → **Trackdex: Run FIT parser spike (FIT-file-parser)** (`fit-spike-smoke`) — with no file open, picks the only FIT file or shows a picker when several exist
5. Note Notice: point count, lap count, parse ms
6. Repeat with **Trackdex: Run FIT parser spike (garmin sdk)** (`fit-spike-garmin-sdk`)
7. Reset `ENABLE_FIT_PARSER_SPIKE` to `false` before merge

### Mobile

Same steps 1–6 on Android/iOS with a small and a large FIT/FIT.GZ if available. Record: crash/OOM, parse time in Notice, any `DecompressionStream` failure.

---

## Results matrix

| Criterion | fit-file-parser | @garmin-fit/sdk | Notes |
|-----------|-----------------|-----------------|-------|
| Node `.fit` parse | **PASS** | **PASS** | 3228 GPS points, cycling session |
| Node `.fit.gz` (gzip → parse) | **PASS** | **PASS** | Same point count after decompress |
| Maps to `ParsedTrack` | **PASS** | **PASS** | points, segments (laps), bbox, sport, timestamps |
| HR in sample fixture | no | no | power + cadence present |
| Cold parse (~95 KB FIT) | ~29 ms | ~53 ms | Node 22, single run |
| esbuild isolated bundle | **~0.13 MB** | **~0.31 MB** | `npm run measure-bundle` |
| `npm run build` (spike off) | **PASS** | — | No parser deps in `main.js` |
| Desktop Obsidian (fit-file-parser) | **PASS** | — | Real vault `.fit.gz` (1323–4744 pts) |
| Android Obsidian (fit-file-parser) | **PASS** | — | Operator 2026-05-29 |
| Desktop/Android (garmin-sdk) | — | **FAIL (expected)** | Same vault files: `compressed timestamp messages are not currently supported` in `@garmin-fit/sdk` |
| Legacy MIT fixture only | **PASS** | **PASS** | `tests/fixtures/sample-activity.fit` (no compressed timestamps) |

---

## Bundle

Measured 2026-05-29 (`npm run build` then `npm run measure-bundle`):

| Artifact | Size |
|----------|------|
| Production `main.js` (spike flags false) | **~1.49 MB** (1 557 673 bytes) |
| fit-file-parser (isolated minified) | **~0.13 MB** (141 177 bytes) |
| @garmin-fit/sdk (isolated minified) | **~0.31 MB** (324 808 bytes) |
| Rough estimate with FIT spike enabled | **~1.62 MB** (main + fit-file-parser) |

---

## Sample output (fit-file-parser → `ParsedTrack`)

```json
{
  "sportRaw": "cycling",
  "startedAtRaw": "2015-10-12T15:47:45.000Z",
  "pointCount": 3228,
  "segmentCount": 1,
  "bbox": {
    "south": 47.5708058103919,
    "west": 6.838337564840913,
    "north": 47.61832030490041,
    "east": 6.896195746958256
  },
  "firstPoint": {
    "lat": 47.58426488377154,
    "lon": 6.83858566917479,
    "elevationM": 375.2,
    "timestampRaw": "2015-10-12T15:47:45.000Z",
    "hrBpm": null,
    "powerW": 26,
    "cadenceRpm": 56,
    "speedMps": 4.945
  },
  "metrics": {
    "pointCount": 3228,
    "segmentCount": 1,
    "hasHr": false,
    "hasPower": true,
    "hasCadence": true,
    "parseMs": 29
  }
}
```

Aligns with [`ParsedTrack`](../../../src/domain/track/parsed-track.ts) / [`TrackParserPort`](../../../src/application/ports/parser-port.ts) from **0.1-02**. No port delta required.

---

## Fixtures

| File | Source |
|------|--------|
| `tests/fixtures/sample-activity.fit` | [jimmykane/fit-parser `examples/example.fit`](https://github.com/jimmykane/fit-parser/blob/master/examples/example.fit) (MIT) |
| `tests/fixtures/sample-activity.fit.gz` | gzip of the above (generated at spike time) |

---

## Rejected / deferred options

| Option | Reason |
|--------|--------|
| **Desktop-only native parser** | Violates mobile parity (`isDesktopOnly: false`) |
| **Defer FIT entirely for v1** | Possible if manual mobile smoke fails; REQUIREMENTS mark FIT/FIT.GZ as Must — needs **0.1-06** scope decision |
| **@garmin/fitsdk** (renamed package) | Not evaluated separately; `@garmin-fit/sdk` already deprecated on npm — migrate to `@garmin/fitsdk` before production if Garmin path chosen |

---

## PoC code map

| File | Role |
|------|------|
| [`src/infrastructure/parsers/candidates/spike-config.ts`](../../../src/infrastructure/parsers/candidates/spike-config.ts) | `ENABLE_FIT_PARSER_SPIKE` |
| [`src/infrastructure/parsers/candidates/fit-file-parser-candidate.ts`](../../../src/infrastructure/parsers/candidates/fit-file-parser-candidate.ts) | Primary candidate |
| [`src/infrastructure/parsers/candidates/garmin-sdk-candidate.ts`](../../../src/infrastructure/parsers/candidates/garmin-sdk-candidate.ts) | Alternate candidate |
| [`src/infrastructure/parsers/candidates/map-to-parsed-track.ts`](../../../src/infrastructure/parsers/candidates/map-to-parsed-track.ts) | Intermediate model mapping |
| [`src/infrastructure/parsers/candidates/gunzip.ts`](../../../src/infrastructure/parsers/candidates/gunzip.ts) | `.fit.gz` decompress |
| [`src/infrastructure/parsers/candidates/register-fit-parser-spike-command.ts`](../../../src/infrastructure/parsers/candidates/register-fit-parser-spike-command.ts) | Dev commands |
| [`tests/fit-parser-spike.test.mjs`](../../../tests/fit-parser-spike.test.mjs) | Automated fixture parse |

---

## Milestone checklist (0.1-04)

- [x] Two fixtures: `.fit` + `.fit.gz`
- [x] Two candidates documented (bundle, Node results; mobile manual planned)
- [x] Sample `ParsedTrack` JSON in this report
- [x] Recommendation: **go with constraints** (`fit-file-parser` primary)
- [x] Spike does not break `npm run build` with default flag

**Blocks:** ~~[0.1-06](../0.1-06-record-fit-parser-decision.md)~~ **done** — decision in TECHNICAL_DESIGN §2.5. Unblocks milestone **0.4** (production parser).
