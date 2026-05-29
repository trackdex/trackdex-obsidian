# Application ports

Stable interfaces for infrastructure adapters. Domain types live under `src/domain/`.

## Milestone readiness

| Port | Required for 0.2 (storage/indexing) | 0.1 stub (0.1-08) |
|------|--------------------------------------|-------------------|
| `TrackRepository` | upsert, find, delete, status, list, rename | no-op / empty |
| `PlaceRepository` | upsert, relations CRUD | no-op / empty |
| `NoteLinkRepository` | upsert, list, delete | no-op / empty |
| `IndexMetaRepository` | get, update | defaults from `DEFAULT_INDEX_META` |
| `TrackParserPort` | — (0.4+ parser work) | `not implemented` Result |
| `LoggerPort` | — | no-op or console |
| `PerfMetricsPort` | — | no-op |
| `ClockPort` | timezone normalization | `Date.now` delegate |

Optional repository methods (`countByStatus`) may return stub zeros until queries exist.
