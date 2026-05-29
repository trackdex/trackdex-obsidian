# FIT parser bundle impact (0.4-04)

**Date:** 2026-05-29  
**Task:** 0.4-04 — production `fit-parser.ts` wired into `createDefaultParserRouter()`

## Measurement

Run after `npm run build`:

```bash
npm run measure-bundle
```

| Artifact | Size |
|----------|------|
| Production `main.js` (with FIT parser) | **~1.22 MB** (1 277 491 bytes) |
| `fit-file-parser` (isolated minified) | **~0.13 MB** (141 177 bytes) |
| Prior baseline without FIT in bundle (0.1 spike doc) | ~1.49 MB |

FIT parser code is bundled into `main.js` via esbuild; `fit-file-parser` moved from `devDependencies` to `dependencies`.

## Notes

- Increment vs pre-0.4-04 `main.js` is smaller than the isolated library size because esbuild tree-shakes and minifies the combined bundle.
- `@garmin-fit/sdk` remains dev-only (spike reference); production `main.js` must not include it.
- Residual manual mobile smoke per §2.5 still applies before release.
