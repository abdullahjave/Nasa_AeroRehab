# Data provenance and project status

Written from evidence in this repository only. Where the repository has no evidence, this file says so.

## Selected challenge
**Not yet confirmed.** No hackathon challenge name, number or track appears in the README, AGENTS.md, package.json or the source.
The project owner needs to supply it. Nothing in this file implies a particular challenge.

## 1. NASA educational references (links and wording only)
Used by the Rehabilitation **Spaceflight Exercise** equipment cards and the NASA Countermeasure Guide
(`lib/countermeasures/content.ts`). They are information with a source link. No NASA data is loaded or processed.
- https://www.nasa.gov/missions/station/iss-research/astronaut-exercise/
- https://www.nasa.gov/directorates/esdmd/hhp/astronaut-strength-conditioning-and-rehabilitation/
- https://www.nasa.gov/ochmo-tb-031-exercise-overview-2/
- https://ntrs.nasa.gov/citations/20060028227, /20090020693, /20230007815
- NASA image page `iss036e005384`

The cards say what each device (ARED, T2, CEVIS) is used for. They are not exercise assignments, and the app does not map
its sample exercises onto them.

## 2. Datasets actually used
**None.** No NASA or third-party dataset is imported, trained on or analysed. The app contains no machine-learning model
trained by this project. The optional AI explanation sends numbers and status to an external generative-AI service
(server-side key); it is not a model trained or validated here.

## 3. Synthetic fixtures (Demo mode)
- Astronauts Chen, Okafor and Alvarez, their sessions, gait, balance and pressure values: simulated, in `lib/demo/fixtures.ts`.
- Demo events ("Flexion plateau" and similar) are **seeded scenario events**, labelled as such. They are not detections.
- The Ground / Post-flight sample plan and its completion figures are simulated.
- `fixtures/sensor-csv/*.csv`: hand-written synthetic test files (see `fixtures/sensor-csv/README.md`). They are never loaded into
  the default database.

## 4. Manual records and CSV imports (Recorded mode)
- Entered by hand in Patient Management (labelled **Manual entry**), or imported from a sensor CSV file (labelled **Imported CSV**).
- Stored in a local SQLite file (`data/aerorehab.sqlite`, git-ignored). A recorded value is never filled from Demo data.
- Recorded mode has no assigned plan unless one is saved explicitly: "No plan assigned for this context."

## 5. Not claimed
- No live sensor or hardware connectivity (Demo sensors are simulated; Recorded data comes from typed entries or files).
- No clinical validation. Alert thresholds are demo rules, and guidance is not clinician-reviewed.
- No sign-in or access control. Do not enter real patient data.
- **No cloud persistence.** Recorded mode needs a writable local database file. On the public Vercel host, `GET /api/recorded`
  returned HTTP 500 ("The database could not be used") when checked on 2026-11-13, so Recorded mode is not available there.
  The app now says so instead of showing an empty database.
- 3D and image asset licences: see `assets/ATTRIBUTIONS.md` (several are unconfirmed).

## Deployment record
- Public site: `nasa-aero-rehab.vercel.app` (the other spelling in the audit, `nasaaero-rehab`, returns 404).
- The commit behind the public site is **not verified**. Confirm it in the Vercel dashboard.
