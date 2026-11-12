// Types shared by the local database layer, the API and the UI for "recorded" data (Backend Phase 1).
// Recorded data is separate from the simulated demo fixtures in lib/demo. It is local to this prototype.

export type Side = "left" | "right";
export const MOVEMENTS = ["knee-flexion-extension"] as const;
export type Movement = (typeof MOVEMENTS)[number];
export const PROTOCOLS = ["active-knee-flexion", "loaded-knee-flexion"] as const;
export type Protocol = (typeof PROTOCOLS)[number];
export type MeasurementSource = "manual";

export const PROTOCOL_LABEL: Record<Protocol, string> = {
  "active-knee-flexion": "Active knee flexion (unloaded)",
  "loaded-knee-flexion": "Loaded knee flexion",
};

export type RecordedMission = { id: string; name: string; startDate: string; totalDays: number; /** The fixed demo "today" (mission day). */ currentDay: number };

export type RecordedProfile = {
  id: string;
  missionId: string;
  fullName: string;
  displayName: string;
  crewCode: string;
  status: string;
  role: string;
  ageYears: number;
  heightCm: number;
  massKg: number;
  rehabFocus: string;
  affectedLimb: Side;
  initials: string;
};

/** One saved knee session. Readings are nullable: a manual entry may have only some of them. */
export type RecordedSession = {
  id: string;
  astronautId: string;
  /** ISO 8601 UTC, e.g. "2026-11-10T09:30:00.000Z". */
  recordedAt: string;
  activity: string;
  side: Side;
  movement: Movement;
  protocol: Protocol;
  source: MeasurementSource;
  minAngleDeg: number | null;
  maxAngleDeg: number | null;
  torqueNm: number | null;
  updatedAt: string;
};

/** One saved manual walking session (totals only). Nullable fields are "not entered", which is different from zero. */
export type RecordedWalking = {
  id: string;
  astronautId: string;
  recordedAt: string;
  source: MeasurementSource;
  distanceM: number;
  durationS: number;
  steps: number | null;
  /** A real stride measurement, only when the user entered one. Never derived from distance and steps. */
  strideLengthM: number | null;
  updatedAt: string;
};

/** What the pages read: the saved record plus values calculated once (unrounded). */
export type WalkingSessionView = RecordedWalking & { missionDay: number; label: string; startedAt: string; speedMs: number | null; cadenceSpm: number | null };

export type WalkingInput = {
  astronautId?: unknown; recordedAt?: unknown; distanceM?: unknown; durationS?: unknown; steps?: unknown; strideLengthM?: unknown;
  distanceUnit?: unknown; durationUnit?: unknown;
};

export const PRESSURE_PROTOCOLS = ["quiet-standing", "walking-trial"] as const;
export type PressureProtocol = (typeof PRESSURE_PROTOCOLS)[number];
export const PRESSURE_PROTOCOL_LABEL: Record<PressureProtocol, string> = { "quiet-standing": "Quiet standing", "walking-trial": "Walking trial" };
export const BALANCE_PROTOCOLS = ["single-leg-stance-eyes-open", "single-leg-stance-eyes-closed"] as const;
export type BalanceProtocol = (typeof BALANCE_PROTOCOLS)[number];
export const BALANCE_PROTOCOL_LABEL: Record<BalanceProtocol, string> = { "single-leg-stance-eyes-open": "Single-leg stance, eyes open", "single-leg-stance-eyes-closed": "Single-leg stance, eyes closed" };

/** One saved manual pressure assessment. Force (N) and peak pressure (kPa) are separate readings; null = not measured (0 is a real zero). */
export type RecordedPressure = {
  id: string; astronautId: string; recordedAt: string; protocol: PressureProtocol; source: MeasurementSource;
  leftForceN: number | null; rightForceN: number | null; leftPeakKpa: number | null; rightPeakKpa: number | null; updatedAt: string;
};
/** One saved manual balance trial. ML / AP sway RMS are instrument-reported values that were typed in. */
export type RecordedBalance = {
  id: string; astronautId: string; recordedAt: string; protocol: BalanceProtocol; trialSide: Side; source: MeasurementSource;
  durationS: number; mlRmsMm: number | null; apRmsMm: number | null; updatedAt: string;
};

/** csvImport = the sensor CSV attached to this assessment (metadata and calculated summary), or null for a manual-only record. */
export type PressureAssessmentView = RecordedPressure & { missionDay: number; label: string; startedAt: string; shares: import("./assessments").LoadShares; csvImport: import("../import/types").RecordedImport | null };
export type BalanceAssessmentView = RecordedBalance & { missionDay: number; label: string; startedAt: string; resultantRmsMm: number | null; csvImport: import("../import/types").RecordedImport | null };

export type PressureInput = { astronautId?: unknown; recordedAt?: unknown; protocol?: unknown; leftForceN?: unknown; rightForceN?: unknown; leftPeakKpa?: unknown; rightPeakKpa?: unknown; forceUnit?: unknown; pressureUnit?: unknown };
export type BalanceInput = { astronautId?: unknown; recordedAt?: unknown; protocol?: unknown; trialSide?: unknown; durationS?: unknown; mlRmsMm?: unknown; apRmsMm?: unknown; durationUnit?: unknown; swayUnit?: unknown };

export type RecordedBaseline = { astronautId: string; side: Side; movement: Movement; protocol: Protocol; sessionId: string };

export type RecordedSnapshot = {
  mission: RecordedMission;
  astronauts: RecordedProfile[];
  sessions: RecordedSession[];
  baselines: RecordedBaseline[];
  walkingSessions: RecordedWalking[];
  pressureAssessments: RecordedPressure[];
  balanceAssessments: RecordedBalance[];
  /** Sensor CSV imports (metadata + calculated summary). The samples themselves are fetched per assessment. */
  sensorImports: import("../import/types").RecordedImport[];
  /** "Mark as seen" history for recorded alerts (append-only). */
  alertAcks: import("../alerts/ack").AckEntry[];
};

/** Fields the user may edit on a profile. */
export type ProfileInput = Partial<Pick<RecordedProfile, "fullName" | "displayName" | "status" | "role" | "ageYears" | "heightCm" | "massKg" | "rehabFocus" | "affectedLimb">>;

/** Raw session form input (strings from the form or numbers from an API client). */
export type SessionInput = {
  astronautId?: unknown;
  recordedAt?: unknown;
  activity?: unknown;
  side?: unknown;
  movement?: unknown;
  protocol?: unknown;
  minAngleDeg?: unknown;
  maxAngleDeg?: unknown;
  torqueNm?: unknown;
  /** Optional explicit units. Anything other than degrees / Nm is rejected. */
  angleUnit?: unknown;
  torqueUnit?: unknown;
};

export type FieldErrors = Record<string, string>;
export type Validated<T> = { ok: true; value: T } | { ok: false; errors: FieldErrors };
