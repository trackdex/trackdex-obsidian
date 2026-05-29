# Test fixtures

| File | Description |
|------|-------------|
| `sample-activity.fit` | Cycling activity sample from [fit-parser examples](https://github.com/jimmykane/fit-parser/blob/master/examples/example.fit) (MIT). |
| `sample-activity.fit.gz` | gzip of `sample-activity.fit` for FIT.GZ spike tests. |
| `sample-track.gpx` | Representative GPX 1.1 track with name, sport, timestamps, elevation, HR, and two segments (milestone **0.4-02**). |
| `malformed-track.gpx` | GPX with invalid coordinates and no usable track points (milestone **0.4-02**). |
| `sample-activity.tcx` | Minimal two-lap cycling TCX for parser tests (milestone **0.4-03**). |

Used by `tests/fit-parser-spike.test.mjs` (milestone **0.1-04**), `tests/gpx-parser-port.test.mjs` (**0.4-02**), and `tests/tcx-parser.test.mjs` (**0.4-03**).
