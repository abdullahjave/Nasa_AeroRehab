# AeroRehab (Nasa_AeroRehab)

Rehabilitation analytics dashboard for a simulated astronaut mission (Artemis-II, Day 42). It has two data modes:
**Demo (simulated)**, fixtures in `lib/demo/` with no backend, and **Recorded (local)**, manual entries and imported sensor CSV files saved in a local SQLite database.
Simulated and recorded data are always labelled and never mixed.

Next.js (App Router) + TypeScript + Tailwind CSS v4 + Recharts + sql.js (SQLite). Local prototype: no sign-in and no real patient data.

## Pages
Ten routes: Overview, Joint Analytics, Gait Analysis, Load & Pressure, Stability & Balance, AI Insights, Rehabilitation, Reports,
Patient Management and Settings. Overview is a vertical page with the status card, today's tasks and measurement details.

## Quick start
```bash
npm install
npm run dev          # CSS watcher + Next.js on http://localhost:3000
```
Release/start command (after `npm run build`): `npm start` (http://localhost:3000).
Production check: `npm run build && npm start`. Quality gates: `npm test` (188 tests), `npx tsc --noEmit`, `npm run lint`, `npm run build`.

### Optional: AI explanations
The **Get Recommendation** button (Overview "Your Status" card and AI Insights) calls Gemini from the server only. Copy `.env.example` to
`.env.local` (ignored by Git) and set `GEMINI_API_KEY`; `GEMINI_MODEL` defaults to `gemini-3.5-flash`. Without a key, or if the service is slow or
down, the card shows **Built-in guidance** instead. Only the metric, units, values, mission day and body area are sent; never a name or record text.

## Demo walkthrough (about 5 minutes)
1. **Demo mode** (default): on **Overview**, read "Your Status" (Dr. Chen, Day 42: knee ROM 114 vs 121 baseline, -5.8%), open **Why am I seeing this?**,
   and press **Get Recommendation** (or see Built-in guidance). Try the astronaut and session pickers in the top bar.
2. Visit **Load & Pressure** (heatmap, timeline scrubbing, CoP trail) and **Stability & Balance** (sway path, 95% ellipse, replay).
3. **Reports**: pick a range, open **PDF Preview**, then **Save PDF** (browser print dialog).
4. Switch **Data** to **Recorded (local)**. In **Patient Management** add a pressure assessment (e.g. quiet standing, left 40 N, right 60 N),
   then **Import sensor CSV** and choose `fixtures/sensor-csv/pressure-synthetic.csv` (synthetic test data, see `fixtures/sensor-csv/README.md`).
   Preview it, **Save import**, then open **Load & Pressure** to scrub the imported frames. Values from the file carry an **Imported CSV** label.
5. In Recorded mode open **Reports**: only sections supported by saved records appear, and the Rehabilitation box appears only when rehab
   completions were saved in Recorded mode. Rehab completions are stored separately for Demo and Recorded.

### CSS workflow
Authored CSS lives in `styles/globals.src.css`. `scripts/build-css.mjs` compiles it with Tailwind's JavaScript
compiler into `app/globals.css` (generated, committed). It runs automatically before `dev` and `build`, and works
on machines where Tailwind's native binary is blocked.

## Assets
- `public/images/*.webp` are derived from the artwork supplied by the project owner. `assets/ATTRIBUTIONS.md` records what could be verified (several originals carry Google-signed AI-generation credentials) and what still awaits confirmation; confirm the licence terms before publishing.
- The old Sketchfab knee renders (Terrie, CC BY 4.0) are no longer in `public/images/`.
- `public/models/astronaut.glb`: creator, source and licence could not be identified (see `assets/ATTRIBUTIONS.md`). Confirm before publishing.
- Optional background video: add `public/videos/space-loop.mp4` (and `public/images/space-backdrop.webp` as poster).
  Without them the app uses a CSS starfield.

## Recorded mode and the local database (Backend Phase 1)

The app has two data modes, switched with **Data** in the top bar (the choice is remembered in the browser):

- **Demo (simulated)** is the original fixture-based demo. Nothing in it changes.
- **Recorded (local)** reads astronaut profiles and saved records from a local SQLite database: **knee sessions** (min/max angle, torque, baseline),
  **walking sessions** (distance, duration, steps), **pressure assessments** (left/right force and peak pressure) and **balance trials** (standing leg,
  protocol, duration, sway RMS). A pressure or balance record can also carry an imported **sensor CSV** (see below), which adds the foot heatmap,
  centre-of-pressure playback or sway path and replay from the saved samples. Overview, the detail pages and Reports show only what was saved or
  imported, each value labelled **Manual entry** or **Imported CSV**. It never falls back to demo values: anything not entered (IMU trace, live sensors,
  or samples for a manual-only record) shows as unavailable, for example "Sensor samples needed".

**Setup** (Node 20+; no native build step, the database engine is `sql.js`, SQLite compiled to WebAssembly):

```bash
npm install
npm run db:migrate   # create data/aerorehab.sqlite, apply migrations, seed 1 mission + 3 profiles (safe to repeat)
npm run db:status    # path, applied migrations, row counts
npm run db:reset     # delete the file and start again (all recorded data is lost)
npm run dev          # or: npm run build && npm start
```

- Database file: `data/aerorehab.sqlite` (ignored by Git). Override with `AEROREHAB_DB=/path/to/file.sqlite`.
- The server also migrates and seeds on first use, so `db:migrate` is optional.
- Add records in **Patient Management** (Recorded mode). Knee sessions take date and time (UTC), activity, knee side, movement, protocol, minimum and
  maximum knee angle in degrees, optional torque in Nm; walking, pressure and balance records have their own forms. ROM = maximum - minimum. Mark a session **Use as baseline**; later sessions for the same
  astronaut, side, movement and protocol are compared with it. Validation runs on the server.
- **AI Recommendation** works for Recorded sessions too, but only when you press the button. The server rebuilds the alert from the saved records and sends the AI service just the knee numbers, the app's status and the next-action label (no names, notes or dates).
- **Local prototype only.** There is no sign-in and no per-astronaut access control. Do not enter real patient data until authentication and
  access control exist.

## Sensor CSV import (Backend Phase 2C)

Attach a pressure or balance sensor recording to a saved **recorded** assessment: Patient Management > *Import sensor CSV*.
The server parses and validates the file, you see a preview, and **Save import** writes the import and all its samples in one transaction.
A rejected file writes nothing. The same file submitted twice is a no-op; a different file needs the explicit *Replace* tick.

**Migration.** Migration 4 (`sensor_csv_imports`) is additive: new tables `sensor_imports`, `pressure_sensors`, `pressure_samples`,
`balance_samples`. It is applied automatically the first time the server opens the database, or run `npm run db:migrate`. Existing
manual fields, knee, gait and walking records are not touched. No samples are ever seeded. Use a disposable database for tests:
`AEROREHAB_DB=/path/to/test.sqlite npm start`.

**Templates and limits** (details and synthetic fixtures: `fixtures/sensor-csv/README.md`). 2 MB, 60,000 pressure rows / 30,000 balance rows.

* Pressure: `time_ms,foot,sensor_id,pressure_kpa,area_cm2,x_mm,y_mm`. Foot-local frame, the same for both feet: origin heel centre, +y toes, +x medial.
  Blank pressure = missing (never 0); 0 is a real zero.
* Balance: `time_ms,ml_mm,ap_mm`. One trial frame, +ML right, +AP anterior. Both blank = missing sample. Side and protocol come from the saved trial.

**Which value does a summary use?** A manually entered value wins; a reading that was not entered by hand is filled from the imported CSV and labelled
*Imported CSV* (Overview, Load & Pressure, Stability & Balance, Reports). Both values stay visible on the detail pages. No Balance Index or fall-risk alert is
created from an import. The checks above were run on synthetic data; no real sensor export was supplied.

**Rehab completion storage.** Ticks are kept in the browser, separately per mode: `aerorehab.rehab.edits.demo.v1` and `aerorehab.rehab.edits.recorded.v1`
(per astronaut). Entries saved before the split (`aerorehab.rehab.edits.v1`) have no mode, so they are kept as read-only legacy data, still shown in Demo, excluded
from Recorded and Reports, and never deleted. Recorded > Rehabilitation offers an explicit **Import into Recorded**, which copies them without removing the originals.

## Alert history ("Mark as seen")
On **AI Insights**, each finding has **Mark as seen**, and an **Alert history** panel lists what was seen, newest first (this session or all sessions), each row with the
severity, values and source it had at that moment and an **Open this measurement** link to the exact session, knee side and time.

- Seen records that you saw a finding. It never resolves, hides or downgrades it: the live alert is always recomputed from the data.
- Marking unchanged data again does nothing. If the finding later reads differently (severity, values or source), the card says **Changed since you saw it**
  and shows both states; marking it again adds a new history entry.
- **Recorded** history is stored in SQLite (migration 5, `alert_acknowledgements`: astronaut, session, finding id, time and a severity/value/source snapshot built on the server from the
  saved records). **Demo** history is stored separately in this browser (`aerorehab.alerts.seen.demo.v1`). Each astronaut and mode is isolated. Overview only shows a read-only "Seen" chip.

## NASA Countermeasure Guide
**Rehabilitation** has a collapsed **NASA Countermeasure Guide** (ARED, COLBERT/T2, CEVIS): short plain-language notes, a strength / locomotion / aerobic filter, and a link to the NASA page behind
every statement (content and sources: `lib/countermeasures/content.ts`; all pages were read on 2026-11-12). It is educational only: it does not set exercise type, load or intensity, and it does not claim
what equipment is in use today. Its status note repeats NASA's dated wording only (a May 2024 article, page updated Feb 2025).

## Upgrading an existing database (migration 5)
Migrations are additive and applied automatically the first time the server opens the file, or with `npm run db:migrate`. The database is a single file (no WAL or
journal sidecar files: it is written through a temp file and an atomic rename), so a plain file copy is a consistent backup. Before upgrading:
```bash
# stop any running server first, then:
copy dataerorehab.sqlite dataackupserorehab-before-upgrade.sqlite     # Windows (use cp on macOS/Linux)
npm run db:migrate
npm run db:status
```
`data/` and every `*.sqlite` file are ignored by Git.

## What a status covers (and what it does not)
Alert rules evaluate **knee movement only**: range of motion against a personal baseline, plus movement events and sensor/data checks. **Walking pace, load & pressure and balance have no
alert rule**, so Overview and AI Insights list them as **Not assessed**, and a green "All Good" is labelled "for knee range of motion only". Their values are still shown, without a status.

## Release limitations
- **Not a clinical or flight tool.** Alerts use a demo rule, not clinically validated limits, and guidance is not clinician-reviewed. Do not use for medical decisions or enter real patient data: there is no sign-in or access control.
- **No live sensors.** Demo data is simulated. Recorded data is typed in by hand or imported from CSV files (an imported file, not a live feed). There is no device or live-sensor integration.
- **Local, single-user.** Data is in a local SQLite file and this browser's storage (Demo alert history and rehab ticks are per browser).
- **Assets awaiting licence confirmation** (see `assets/ATTRIBUTIONS.md`): `public/models/astronaut.glb` (no creator or licence found); the AI-generated images (Google-signed credentials, licence terms not stated);
  five supplied images and four videos with no embedded source or licence. Only the Sketchfab skeleton (CC BY 4.0, Terrie) is verified. Confirm before publishing or redistributing.
- **AI recommendations** need a server-side Gemini key and can fail or time out; the built-in guidance is always shown as the fallback.
