# Synthetic sensor CSV fixtures

These files are **synthetic**. They were written by hand for testing the Phase 2C import and are not real sensor exports.
They are never loaded into the default database; the tests import them into a disposable in-memory database, and you can upload
them by hand from **Patient Management > Import sensor CSV** on a throw-away database.

| File | What it checks |
| --- | --- |
| `pressure-synthetic.csv` | 5 frames, 2 sensors per foot (10 cm² each). Frame 0: left 40 N, right 60 N (40% / 60%, 20 pp). Frame 2 has a blank right-heel reading (missing). Frame 3 has a measured 0 kPa. Frame 4 has no left-foot rows at all. |
| `balance-square.csv` | 5 samples on a 3 x 4 mm square path: path length 14 mm. |
| `balance-gap.csv` | 25 expected 100 ms slots, with one blank sample (t = 500) and two skipped slots (t = 1200, 1300). Coverage 22/25 = 88%. Three runs of 14, 17 and 35 mm = 66 mm; the path must not bridge the gaps. |

## Pressure CSV template (`AeroRehab pressure CSV v1`)

```
time_ms,foot,sensor_id,pressure_kpa,area_cm2,x_mm,y_mm
```

* `time_ms` elapsed milliseconds since the start of the assessment, ascending. Rows with the same value form one frame.
* `foot` `left` or `right`.
* `sensor_id` 1-24 of letters, digits, `_`, `-`. One id belongs to one foot and keeps its area and position in every row.
* `pressure_kpa` kilopascals, 0 to 5000. `0` is a measured zero. **Blank = missing reading.** A sensor with no row in a frame is also missing.
* `area_cm2` sensing area, above 0 and at most 100.
* `x_mm`, `y_mm` sensor centre in the **foot-local frame, identical for both feet**: origin at the centre of the heel, `+y` toward the toes,
  `+x` medial (toward the other foot), `-x` lateral. Millimetres. `x` within +-200, `y` from -100 to 400.

The right foot is drawn as the mirror image of the left, so a correct file has the big-toe sensors at positive `x` for BOTH feet.
A file whose two feet average on opposite sides of `x = 0` is rejected as mirrored or in a shared frame.

## Balance CSV template (`AeroRehab balance CSV v1`)

```
time_ms,ml_mm,ap_mm
```

* `time_ms` elapsed milliseconds since the start of the trial; unique and strictly increasing.
* `ml_mm` medio-lateral centre-of-pressure position, `+ML` toward the astronaut's right. Millimetres, within +-500.
* `ap_mm` antero-posterior position, `+AP` anterior (toward the toes). Millimetres, within +-500.
* Both coordinates share one trial frame (origin: centre of the plate area under the stance foot). Leave **both** blank for a missing sample.
* The standing leg and protocol come from the saved balance trial the file is attached to.
* Timestamps that skip more than 1.5 sampling intervals are a gap; paths and replay are never drawn across it. Statistics need at least 80% coverage.
