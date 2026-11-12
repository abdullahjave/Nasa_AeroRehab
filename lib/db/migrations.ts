// Ordered, append-only migrations for the local SQLite database. Applied once each and recorded in schema_migrations,
// so running them again does nothing. Never edit a migration that has shipped: add a new one.

export type Migration = { version: number; name: string; sql: string };

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: "init",
    sql: `
CREATE TABLE mission (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  start_date  TEXT NOT NULL CHECK (start_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  total_days  INTEGER NOT NULL CHECK (total_days > 0),
  -- The prototype's fixed "today" (the same demo date the exercise plan uses). Sessions cannot be dated after it.
  current_day INTEGER NOT NULL CHECK (current_day BETWEEN 1 AND total_days)
);

CREATE TABLE astronauts (
  id            TEXT PRIMARY KEY,
  mission_id    TEXT NOT NULL REFERENCES mission(id),
  full_name     TEXT NOT NULL CHECK (length(full_name) BETWEEN 1 AND 80),
  display_name  TEXT NOT NULL CHECK (length(display_name) BETWEEN 1 AND 30),
  crew_code     TEXT NOT NULL UNIQUE,
  status        TEXT NOT NULL,
  role          TEXT NOT NULL,
  age_years     INTEGER NOT NULL CHECK (age_years BETWEEN 18 AND 99),
  height_cm     INTEGER NOT NULL CHECK (height_cm BETWEEN 120 AND 230),
  mass_kg       INTEGER NOT NULL CHECK (mass_kg BETWEEN 30 AND 200),
  rehab_focus   TEXT NOT NULL,
  affected_limb TEXT NOT NULL CHECK (affected_limb IN ('left','right')),
  initials      TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE TABLE sessions (
  id            TEXT PRIMARY KEY,
  astronaut_id  TEXT NOT NULL REFERENCES astronauts(id) ON DELETE CASCADE,
  recorded_at   TEXT NOT NULL,
  activity      TEXT NOT NULL CHECK (length(activity) BETWEEN 1 AND 60),
  side          TEXT NOT NULL CHECK (side IN ('left','right')),
  movement      TEXT NOT NULL CHECK (movement IN ('knee-flexion-extension')),
  protocol      TEXT NOT NULL CHECK (protocol IN ('active-knee-flexion','loaded-knee-flexion')),
  source        TEXT NOT NULL CHECK (source IN ('manual')),
  min_angle_deg REAL CHECK (min_angle_deg IS NULL OR (min_angle_deg BETWEEN -20 AND 180)),
  max_angle_deg REAL CHECK (max_angle_deg IS NULL OR (max_angle_deg BETWEEN -20 AND 180)),
  torque_nm     REAL CHECK (torque_nm IS NULL OR (torque_nm BETWEEN 0 AND 1000)),
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  CHECK (min_angle_deg IS NULL OR max_angle_deg IS NULL OR min_angle_deg <= max_angle_deg)
);
CREATE INDEX sessions_by_astronaut ON sessions (astronaut_id, recorded_at);

-- One explicitly chosen baseline session per astronaut, knee side, movement and protocol.
CREATE TABLE baselines (
  astronaut_id TEXT NOT NULL REFERENCES astronauts(id) ON DELETE CASCADE,
  side         TEXT NOT NULL CHECK (side IN ('left','right')),
  movement     TEXT NOT NULL,
  protocol     TEXT NOT NULL,
  session_id   TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  PRIMARY KEY (astronaut_id, side, movement, protocol)
);
`,
  },
  {
    version: 2,
    name: "walking_sessions",
    // Additive: a new table only. Existing profiles, knee sessions and baselines are not touched.
    sql: `
CREATE TABLE walking_sessions (
  id              TEXT PRIMARY KEY,
  astronaut_id    TEXT NOT NULL REFERENCES astronauts(id) ON DELETE CASCADE,
  recorded_at     TEXT NOT NULL,
  source          TEXT NOT NULL CHECK (source IN ('manual')),
  distance_m      REAL NOT NULL CHECK (distance_m >= 0 AND distance_m <= 50000),
  duration_s      REAL NOT NULL CHECK (duration_s > 0 AND duration_s <= 86400),
  steps           INTEGER CHECK (steps IS NULL OR (steps >= 0 AND steps <= 200000)),
  stride_length_m REAL CHECK (stride_length_m IS NULL OR (stride_length_m > 0 AND stride_length_m <= 3)),
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);
CREATE INDEX walking_by_astronaut ON walking_sessions (astronaut_id, recorded_at);
`,
  },
  {
    version: 3,
    name: "pressure_and_balance_assessments",
    // Additive: two new tables only. Existing profiles, knee sessions, baselines and walking sessions are not touched.
    sql: `
CREATE TABLE pressure_assessments (
  id              TEXT PRIMARY KEY,
  astronaut_id    TEXT NOT NULL REFERENCES astronauts(id) ON DELETE CASCADE,
  recorded_at     TEXT NOT NULL,
  protocol        TEXT NOT NULL CHECK (protocol IN ('quiet-standing','walking-trial')),
  source          TEXT NOT NULL CHECK (source IN ('manual')),
  left_force_n    REAL CHECK (left_force_n IS NULL OR (left_force_n >= 0 AND left_force_n <= 20000)),
  right_force_n   REAL CHECK (right_force_n IS NULL OR (right_force_n >= 0 AND right_force_n <= 20000)),
  left_peak_kpa   REAL CHECK (left_peak_kpa IS NULL OR (left_peak_kpa >= 0 AND left_peak_kpa <= 5000)),
  right_peak_kpa  REAL CHECK (right_peak_kpa IS NULL OR (right_peak_kpa >= 0 AND right_peak_kpa <= 5000)),
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  CHECK (left_force_n IS NOT NULL OR right_force_n IS NOT NULL OR left_peak_kpa IS NOT NULL OR right_peak_kpa IS NOT NULL)
);
CREATE INDEX pressure_by_astronaut ON pressure_assessments (astronaut_id, recorded_at);

CREATE TABLE balance_assessments (
  id              TEXT PRIMARY KEY,
  astronaut_id    TEXT NOT NULL REFERENCES astronauts(id) ON DELETE CASCADE,
  recorded_at     TEXT NOT NULL,
  protocol        TEXT NOT NULL CHECK (protocol IN ('single-leg-stance-eyes-open','single-leg-stance-eyes-closed')),
  trial_side      TEXT NOT NULL CHECK (trial_side IN ('left','right')),
  source          TEXT NOT NULL CHECK (source IN ('manual')),
  duration_s      REAL NOT NULL CHECK (duration_s > 0 AND duration_s <= 3600),
  ml_rms_mm       REAL CHECK (ml_rms_mm IS NULL OR (ml_rms_mm >= 0 AND ml_rms_mm <= 500)),
  ap_rms_mm       REAL CHECK (ap_rms_mm IS NULL OR (ap_rms_mm >= 0 AND ap_rms_mm <= 500)),
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);
CREATE INDEX balance_by_astronaut ON balance_assessments (astronaut_id, recorded_at);
`,
  },
  {
    version: 4,
    name: "sensor_csv_imports",
    // Additive: new tables only. Manual pressure and balance fields, knee sessions, walking sessions and profiles are not touched.
    // One import per assessment (replacing it deletes the old rows in the same transaction). Samples are deleted with their import.
    sql: `
CREATE TABLE sensor_imports (
  id                     TEXT PRIMARY KEY,
  astronaut_id           TEXT NOT NULL REFERENCES astronauts(id) ON DELETE CASCADE,
  kind                   TEXT NOT NULL CHECK (kind IN ('pressure','balance')),
  pressure_assessment_id TEXT REFERENCES pressure_assessments(id) ON DELETE CASCADE,
  balance_assessment_id  TEXT REFERENCES balance_assessments(id) ON DELETE CASCADE,
  file_name              TEXT NOT NULL CHECK (length(file_name) BETWEEN 1 AND 120),
  content_sha256         TEXT NOT NULL CHECK (length(content_sha256) = 64),
  template               TEXT NOT NULL,
  context_json           TEXT NOT NULL,
  preview_json           TEXT NOT NULL,
  imported_at            TEXT NOT NULL,
  CHECK ((kind = 'pressure' AND pressure_assessment_id IS NOT NULL AND balance_assessment_id IS NULL)
      OR (kind = 'balance'  AND balance_assessment_id  IS NOT NULL AND pressure_assessment_id IS NULL))
);
CREATE UNIQUE INDEX sensor_imports_one_pressure ON sensor_imports (pressure_assessment_id) WHERE pressure_assessment_id IS NOT NULL;
CREATE UNIQUE INDEX sensor_imports_one_balance ON sensor_imports (balance_assessment_id) WHERE balance_assessment_id IS NOT NULL;
CREATE INDEX sensor_imports_by_astronaut ON sensor_imports (astronaut_id);

-- Geometry of an imported pressure file: one row per sensor, in the foot-local frame (mm; origin heel centre, +y anterior, +x medial).
CREATE TABLE pressure_sensors (
  import_id TEXT NOT NULL REFERENCES sensor_imports(id) ON DELETE CASCADE,
  foot      TEXT NOT NULL CHECK (foot IN ('left','right')),
  sensor_id TEXT NOT NULL,
  area_cm2  REAL NOT NULL CHECK (area_cm2 > 0 AND area_cm2 <= 100),
  x_mm      REAL NOT NULL,
  y_mm      REAL NOT NULL,
  PRIMARY KEY (import_id, foot, sensor_id)
) WITHOUT ROWID;

-- One stored reading. pressure_kpa NULL = the file had a blank value (missing). 0 is a measured zero.
CREATE TABLE pressure_samples (
  import_id    TEXT NOT NULL REFERENCES sensor_imports(id) ON DELETE CASCADE,
  time_ms      REAL NOT NULL CHECK (time_ms >= 0),
  foot         TEXT NOT NULL CHECK (foot IN ('left','right')),
  sensor_id    TEXT NOT NULL,
  pressure_kpa REAL CHECK (pressure_kpa IS NULL OR (pressure_kpa >= 0 AND pressure_kpa <= 5000)),
  PRIMARY KEY (import_id, time_ms, foot, sensor_id)
) WITHOUT ROWID;

-- One stored balance sample. Both coordinates NULL = a blank (missing) sample; one without the other is not allowed.
CREATE TABLE balance_samples (
  import_id TEXT NOT NULL REFERENCES sensor_imports(id) ON DELETE CASCADE,
  time_ms   REAL NOT NULL CHECK (time_ms >= 0),
  ml_mm     REAL CHECK (ml_mm IS NULL OR (ml_mm >= -500 AND ml_mm <= 500)),
  ap_mm     REAL CHECK (ap_mm IS NULL OR (ap_mm >= -500 AND ap_mm <= 500)),
  CHECK ((ml_mm IS NULL) = (ap_mm IS NULL)),
  PRIMARY KEY (import_id, time_ms)
) WITHOUT ROWID;
`,
  },
  {
    version: 5,
    name: "alert_acknowledgements",
    // Additive: one new table. "Mark as seen" history for RECORDED alerts only (Demo keeps its own history in the browser).
    // Append-only: a row records that a finding was seen and what it said at that moment. Alerts themselves are never stored,
    // resolved, hidden or downgraded; they are recomputed from the data. Repeating an acknowledgement of unchanged data adds nothing.
    sql: `
CREATE TABLE alert_acknowledgements (
  id               TEXT PRIMARY KEY,
  astronaut_id     TEXT NOT NULL REFERENCES astronauts(id) ON DELETE CASCADE,
  session_id       TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  alert_id         TEXT NOT NULL CHECK (length(alert_id) BETWEEN 1 AND 160),
  finding_id       TEXT,
  acknowledged_at  TEXT NOT NULL,
  fingerprint      TEXT NOT NULL,
  severity         TEXT NOT NULL CHECK (severity IN ('good','attention','action','neutral')),
  severity_label   TEXT NOT NULL,
  title            TEXT NOT NULL,
  metric           TEXT NOT NULL,
  value_json       TEXT,
  source_json      TEXT,
  session_label    TEXT NOT NULL,
  mission_day      INTEGER NOT NULL,
  scenario         TEXT
);
CREATE INDEX alert_acks_by_finding ON alert_acknowledgements (astronaut_id, session_id, alert_id, acknowledged_at);
`,
  },
];
