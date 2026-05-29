# Test fixtures

| File | Category | Description |
|------|----------|-------------|
| `sample-track.gpx` | valid | Representative GPX 1.1 track with name, sport, timestamps, elevation, HR, and two segments (milestone **0.4-02**). |
| `partial-track.gpx` | partial | Geometry-only GPX with two track points and no optional fields (milestone **0.4-12**). |
| `malformed-track.gpx` | invalid | GPX with invalid coordinates and no usable track points (milestone **0.4-02**). |
| `sample-activity.tcx` | valid | Minimal two-lap cycling TCX for parser tests (milestone **0.4-03**). |
| `partial-activity.tcx` | partial | Geometry-only TCX with two trackpoints and no timestamps or sensors (milestone **0.4-12**). |
| `malformed-activity.tcx` | invalid | TCX activity lap with no track points (milestone **0.4-12**). |
| `sample-activity.fit` | valid | Cycling activity sample from [fit-parser examples](https://github.com/jimmykane/fit-parser/blob/master/examples/example.fit) (MIT). |
| `partial-activity.fit` | partial | Synthetic geometry-only FIT with two GPS records (milestone **0.4-12**). |
| `malformed-activity.fit` | invalid | Non-FIT bytes for parse failure coverage (milestone **0.4-12**). |
| `sample-activity.fit.gz` | valid | gzip of `sample-activity.fit` for FIT.GZ tests. |
| `partial-activity.fit.gz` | partial | gzip of `partial-activity.fit` (milestone **0.4-12**). |
| `malformed-activity.fit.gz` | invalid | Invalid gzip payload (milestone **0.4-12**). |

Used by `tests/parsers/fixture-matrix.test.mjs` (milestone **0.4-12**), `tests/fit-parser-spike.test.mjs` (**0.1-04**), `tests/gpx-parser-port.test.mjs` (**0.4-02**), `tests/tcx-parser.test.mjs` (**0.4-03**), `tests/fit-parser.test.mjs` (**0.4-04**), and `tests/fit-gz-parser.test.mjs` (**0.4-05**).

Regenerate synthetic FIT fixtures with `node scripts/generate-partial-fit-fixtures.mjs`.
