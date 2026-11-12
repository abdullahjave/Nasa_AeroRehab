import { BALANCE_PROTOCOLS, PRESSURE_PROTOCOLS, type BalanceInput, type BalanceProtocol, type PressureInput, type PressureProtocol, type WalkingInput } from "./types";
import { MOVEMENTS, PROTOCOLS, type FieldErrors, type Movement, type Protocol, type ProfileInput, type RecordedMission, type SessionInput, type Side, type Validated } from "./types";

// Server-side validation. The browser form shows these same messages next to the fields, but the API never trusts the browser.

export const ANGLE_MIN_DEG = -20;
export const ANGLE_MAX_DEG = 180;
export const TORQUE_MAX_NM = 1000;
export const ACTIVITY_MAX = 60;
const DAY_MS = 86_400_000;

/** Number from a number or a plain numeric string. "" / null / undefined -> null (missing). NaN for anything else. */
export function readNumber(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const t = v.trim();
    if (t === "") return null;
    return /^[+-]?(\d+\.?\d*|\.\d+)$/.test(t) ? Number(t) : Number.NaN;
  }
  return Number.NaN;
}

export type SessionValue = {
  astronautId: string;
  recordedAt: string; // ISO UTC
  activity: string;
  side: Side;
  movement: Movement;
  protocol: Protocol;
  minAngleDeg: number | null;
  maxAngleDeg: number | null;
  torqueNm: number | null;
};

/** "2026-11-10T09:30" (form) or a full ISO string -> ISO UTC. Form values are read as UTC. */
export function parseRecordedAt(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})?$/.test(t)) return null;
  const hasZone = /(Z|[+-]\d{2}:\d{2})$/.test(t);
  const d = new Date(hasZone ? t.replace(" ", "T") : `${t.replace(" ", "T")}${t.length === 16 ? ":00" : ""}Z`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Mission day (Day 1 = start date) for an ISO timestamp. */
export function missionDayOf(iso: string, mission: Pick<RecordedMission, "startDate">): number {
  const start = Date.parse(`${mission.startDate}T00:00:00Z`);
  return Math.floor((Date.parse(iso) - start) / DAY_MS) + 1;
}

/**
 * Validates one session. Units are fixed (angles in degrees, torque in Nm); an explicit different unit is an error.
 * min <= max is enforced when both angles are present. Nothing is estimated for a missing reading.
 */
export function validateSession(input: SessionInput, mission: RecordedMission, knownAstronautIds: readonly string[]): Validated<SessionValue> {
  const errors: FieldErrors = {};
  const astronautId = typeof input.astronautId === "string" ? input.astronautId : "";
  if (!knownAstronautIds.includes(astronautId)) errors.astronautId = "Choose an astronaut from the list.";

  const recordedAt = parseRecordedAt(input.recordedAt);
  if (!recordedAt) errors.recordedAt = "Enter the date and time, e.g. 2026-11-10 09:30 (UTC).";
  else {
    const day = missionDayOf(recordedAt, mission);
    if (day < 1 || day > mission.currentDay) errors.recordedAt = `The date must fall on mission Day 1 to ${mission.currentDay} (${mission.startDate} up to today's demo date).`;
  }

  const activity = typeof input.activity === "string" ? input.activity.trim().replace(/\s+/g, " ") : "";
  if (!activity) errors.activity = "Enter the activity, e.g. Knee mobility.";
  else if (activity.length > ACTIVITY_MAX) errors.activity = `Keep the activity to ${ACTIVITY_MAX} characters or fewer.`;

  if (input.side !== "left" && input.side !== "right") errors.side = "Choose left or right.";
  if (!(MOVEMENTS as readonly unknown[]).includes(input.movement)) errors.movement = "Choose a movement from the list.";
  if (!(PROTOCOLS as readonly unknown[]).includes(input.protocol)) errors.protocol = "Choose a measurement protocol from the list.";

  if (input.angleUnit !== undefined && input.angleUnit !== "deg") errors.minAngleDeg = "Angles must be in degrees (deg).";
  if (input.torqueUnit !== undefined && input.torqueUnit !== "Nm") errors.torqueNm = "Torque must be in newton-metres (Nm).";

  const angle = (key: "minAngleDeg" | "maxAngleDeg", label: string): number | null => {
    const n = readNumber(input[key]);
    if (n !== null && !Number.isFinite(n)) { errors[key] = `${label} must be a number in degrees (no units or text).`; return null; }
    if (n !== null && (n < ANGLE_MIN_DEG || n > ANGLE_MAX_DEG)) { errors[key] = `${label} must be between ${ANGLE_MIN_DEG}° and ${ANGLE_MAX_DEG}°.`; return null; }
    return n;
  };
  const min = angle("minAngleDeg", "Minimum angle");
  const max = angle("maxAngleDeg", "Maximum angle");
  if (!errors.minAngleDeg && !errors.maxAngleDeg && min !== null && max !== null && min > max) errors.maxAngleDeg = "The maximum angle must be greater than or equal to the minimum angle.";

  let torque = readNumber(input.torqueNm);
  if (torque !== null && !Number.isFinite(torque)) { if (!errors.torqueNm) errors.torqueNm = "Torque must be a number in Nm (no units or text)."; torque = null; }
  else if (torque !== null && (torque < 0 || torque > TORQUE_MAX_NM)) { errors.torqueNm = `Torque must be between 0 and ${TORQUE_MAX_NM} Nm.`; torque = null; }

  if (min === null && max === null && torque === null && !errors.minAngleDeg && !errors.maxAngleDeg && !errors.torqueNm) errors.minAngleDeg = "Enter at least one reading (minimum angle, maximum angle or torque).";

  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    value: { astronautId, recordedAt: recordedAt as string, activity, side: input.side as Side, movement: input.movement as Movement, protocol: input.protocol as Protocol, minAngleDeg: min, maxAngleDeg: max, torqueNm: torque },
  };
}

const text = (v: unknown, label: string, max: number, errors: FieldErrors, key: string): string | undefined => {
  if (v === undefined) return undefined;
  const t = typeof v === "string" ? v.trim().replace(/\s+/g, " ") : "";
  if (!t) { errors[key] = `${label} cannot be empty.`; return undefined; }
  if (t.length > max) { errors[key] = `${label} must be ${max} characters or fewer.`; return undefined; }
  return t;
};
const whole = (v: unknown, label: string, lo: number, hi: number, unit: string, errors: FieldErrors, key: string): number | undefined => {
  if (v === undefined) return undefined;
  const n = readNumber(v);
  if (n === null || !Number.isFinite(n) || !Number.isInteger(n)) { errors[key] = `${label} must be a whole number${unit ? ` in ${unit}` : ""}.`; return undefined; }
  if (n < lo || n > hi) { errors[key] = `${label} must be between ${lo} and ${hi}${unit ? ` ${unit}` : ""}.`; return undefined; }
  return n;
};

/** Validates a partial profile update. Unknown fields are ignored; only the listed fields can change. */
export function validateProfile(input: Record<string, unknown>): Validated<ProfileInput> {
  const errors: FieldErrors = {};
  const out: ProfileInput = {};
  const fullName = text(input.fullName, "Full name", 80, errors, "fullName"); if (fullName !== undefined) out.fullName = fullName;
  const displayName = text(input.displayName, "Short name", 30, errors, "displayName"); if (displayName !== undefined) out.displayName = displayName;
  const role = text(input.role, "Role", 60, errors, "role"); if (role !== undefined) out.role = role;
  const status = text(input.status, "Status", 40, errors, "status"); if (status !== undefined) out.status = status;
  const rehabFocus = text(input.rehabFocus, "Rehabilitation focus", 120, errors, "rehabFocus"); if (rehabFocus !== undefined) out.rehabFocus = rehabFocus;
  const age = whole(input.ageYears, "Age", 18, 99, "years", errors, "ageYears"); if (age !== undefined) out.ageYears = age;
  const height = whole(input.heightCm, "Height", 120, 230, "cm", errors, "heightCm"); if (height !== undefined) out.heightCm = height;
  const mass = whole(input.massKg, "Mass", 30, 200, "kg", errors, "massKg"); if (mass !== undefined) out.massKg = mass;
  if (input.affectedLimb !== undefined) {
    if (input.affectedLimb === "left" || input.affectedLimb === "right") out.affectedLimb = input.affectedLimb;
    else errors.affectedLimb = "Choose left or right.";
  }
  if (Object.keys(errors).length) return { ok: false, errors };
  if (Object.keys(out).length === 0) return { ok: false, errors: { form: "No profile fields to update." } };
  return { ok: true, value: out };
}

export const initialsOf = (fullName: string) =>
  fullName.replace(/^(dr|cmdr|maj|col|capt|lt)\.?\s+/i, "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("") || "?";

export type WalkingValue = { astronautId: string; recordedAt: string; distanceM: number; durationS: number; steps: number | null; strideLengthM: number | null };
export const DISTANCE_MAX_M = 50_000;
export const DURATION_MAX_S = 86_400;
export const STEPS_MAX = 200_000;
export const STRIDE_MAX_M = 3;

/**
 * Validates one manual walking session. Distance is in metres, duration in seconds. Duration must be finite and above zero,
 * distance finite and not negative, and a step count (optional) a whole number of 0 or more. A blank step count stays
 * "not entered" (null); it is never turned into zero.
 */
export function validateWalking(input: WalkingInput, mission: RecordedMission, knownAstronautIds: readonly string[]): Validated<WalkingValue> {
  const errors: FieldErrors = {};
  const astronautId = typeof input.astronautId === "string" ? input.astronautId : "";
  if (!knownAstronautIds.includes(astronautId)) errors.astronautId = "Choose an astronaut from the list.";
  const recordedAt = parseRecordedAt(input.recordedAt);
  if (!recordedAt) errors.recordedAt = "Enter the date and time, e.g. 2026-11-10 09:30 (UTC).";
  else {
    const day = missionDayOf(recordedAt, mission);
    if (day < 1 || day > mission.currentDay) errors.recordedAt = `The date must fall on mission Day 1 to ${mission.currentDay} (${mission.startDate} up to today's demo date).`;
  }
  if (input.distanceUnit !== undefined && input.distanceUnit !== "m") errors.distanceM = "Distance must be in metres (m).";
  if (input.durationUnit !== undefined && input.durationUnit !== "s") errors.durationS = "Duration must be in seconds (s).";

  const distance = readNumber(input.distanceM);
  if (!errors.distanceM) {
    if (distance === null) errors.distanceM = "Enter the distance in metres.";
    else if (!Number.isFinite(distance)) errors.distanceM = "Distance must be a number in metres (no units or text).";
    else if (distance < 0) errors.distanceM = "Distance cannot be negative.";
    else if (distance > DISTANCE_MAX_M) errors.distanceM = `Distance must be ${DISTANCE_MAX_M} m or less.`;
  }
  const duration = readNumber(input.durationS);
  if (!errors.durationS) {
    if (duration === null) errors.durationS = "Enter the duration in seconds.";
    else if (!Number.isFinite(duration)) errors.durationS = "Duration must be a number in seconds (no units or text).";
    else if (duration <= 0) errors.durationS = "Duration must be greater than zero seconds.";
    else if (duration > DURATION_MAX_S) errors.durationS = `Duration must be ${DURATION_MAX_S} s (24 hours) or less.`;
  }
  let steps = readNumber(input.steps);
  if (steps !== null) {
    if (!Number.isFinite(steps) || !Number.isInteger(steps) || steps < 0) { errors.steps = "Step count must be a whole number of 0 or more."; steps = null; }
    else if (steps > STEPS_MAX) { errors.steps = `Step count must be ${STEPS_MAX} or less.`; steps = null; }
  }
  let stride = readNumber(input.strideLengthM);
  if (stride !== null) {
    if (!Number.isFinite(stride) || stride <= 0) { errors.strideLengthM = "Stride length must be a number of metres above zero."; stride = null; }
    else if (stride > STRIDE_MAX_M) { errors.strideLengthM = `Stride length must be ${STRIDE_MAX_M} m or less.`; stride = null; }
  }
  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, value: { astronautId, recordedAt: recordedAt as string, distanceM: distance as number, durationS: duration as number, steps, strideLengthM: stride } };
}

function checkWhen(input: { recordedAt?: unknown }, mission: RecordedMission, errors: FieldErrors): string | null {
  const recordedAt = parseRecordedAt(input.recordedAt);
  if (!recordedAt) { errors.recordedAt = "Enter the date and time, e.g. 2026-11-10 09:30 (UTC)."; return null; }
  const day = missionDayOf(recordedAt, mission);
  if (day < 1 || day > mission.currentDay) errors.recordedAt = `The date must fall on mission Day 1 to ${mission.currentDay} (${mission.startDate} up to today's demo date).`;
  return recordedAt;
}

/** Optional finite non-negative reading in [0, max]. Blank -> null (not measured). A typed 0 stays 0. */
function optionalReading(v: unknown, key: string, label: string, unit: string, max: number, errors: FieldErrors): number | null {
  const n = readNumber(v);
  if (n === null) return null;
  if (!Number.isFinite(n)) { errors[key] = `${label} must be a number in ${unit} (no units or text).`; return null; }
  if (n < 0) { errors[key] = `${label} cannot be negative.`; return null; }
  if (n > max) { errors[key] = `${label} must be ${max} ${unit} or less.`; return null; }
  return n;
}

export const FORCE_MAX_N = 20_000;
export const PEAK_MAX_KPA = 5_000;
export const SWAY_MAX_MM = 500;
export const TRIAL_MAX_S = 3_600;

export type PressureValue = { astronautId: string; recordedAt: string; protocol: PressureProtocol; leftForceN: number | null; rightForceN: number | null; leftPeakKpa: number | null; rightPeakKpa: number | null };

/** Manual pressure assessment: optional left/right force (N) and optional left/right peak pressure (kPa). At least one reading is required. */
export function validatePressure(input: PressureInput, mission: RecordedMission, knownAstronautIds: readonly string[]): Validated<PressureValue> {
  const errors: FieldErrors = {};
  const astronautId = typeof input.astronautId === "string" ? input.astronautId : "";
  if (!knownAstronautIds.includes(astronautId)) errors.astronautId = "Choose an astronaut from the list.";
  const recordedAt = checkWhen(input, mission, errors);
  if (!(PRESSURE_PROTOCOLS as readonly unknown[]).includes(input.protocol)) errors.protocol = "Choose a protocol from the list.";
  if (input.forceUnit !== undefined && input.forceUnit !== "N") errors.leftForceN = "Force must be in newtons (N).";
  if (input.pressureUnit !== undefined && input.pressureUnit !== "kPa") errors.leftPeakKpa = "Pressure must be in kilopascals (kPa).";
  const e0 = Object.keys(errors).length;
  const lf = errors.leftForceN ? null : optionalReading(input.leftForceN, "leftForceN", "Left force", "N", FORCE_MAX_N, errors);
  const rf = optionalReading(input.rightForceN, "rightForceN", "Right force", "N", FORCE_MAX_N, errors);
  const lp = errors.leftPeakKpa ? null : optionalReading(input.leftPeakKpa, "leftPeakKpa", "Left peak pressure", "kPa", PEAK_MAX_KPA, errors);
  const rp = optionalReading(input.rightPeakKpa, "rightPeakKpa", "Right peak pressure", "kPa", PEAK_MAX_KPA, errors);
  if (Object.keys(errors).length === e0 && lf === null && rf === null && lp === null && rp === null) errors.leftForceN = "Enter at least one reading (force or peak pressure).";
  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, value: { astronautId, recordedAt: recordedAt as string, protocol: input.protocol as PressureProtocol, leftForceN: lf, rightForceN: rf, leftPeakKpa: lp, rightPeakKpa: rp } };
}

export type BalanceValue = { astronautId: string; recordedAt: string; protocol: BalanceProtocol; trialSide: Side; durationS: number; mlRmsMm: number | null; apRmsMm: number | null };

/** Manual balance trial: explicit side and protocol, observed duration > 0 s, optional instrument-reported ML and AP sway RMS in mm. */
export function validateBalance(input: BalanceInput, mission: RecordedMission, knownAstronautIds: readonly string[]): Validated<BalanceValue> {
  const errors: FieldErrors = {};
  const astronautId = typeof input.astronautId === "string" ? input.astronautId : "";
  if (!knownAstronautIds.includes(astronautId)) errors.astronautId = "Choose an astronaut from the list.";
  const recordedAt = checkWhen(input, mission, errors);
  if (!(BALANCE_PROTOCOLS as readonly unknown[]).includes(input.protocol)) errors.protocol = "Choose a protocol from the list.";
  if (input.trialSide !== "left" && input.trialSide !== "right") errors.trialSide = "Choose the trial side: left or right.";
  if (input.durationUnit !== undefined && input.durationUnit !== "s") errors.durationS = "Duration must be in seconds (s).";
  if (input.swayUnit !== undefined && input.swayUnit !== "mm") errors.mlRmsMm = "Sway must be in millimetres (mm).";
  const duration = readNumber(input.durationS);
  if (!errors.durationS) {
    if (duration === null) errors.durationS = "Enter the observed duration in seconds.";
    else if (!Number.isFinite(duration)) errors.durationS = "Duration must be a number in seconds (no units or text).";
    else if (duration <= 0) errors.durationS = "Duration must be greater than zero seconds.";
    else if (duration > TRIAL_MAX_S) errors.durationS = `Duration must be ${TRIAL_MAX_S} s or less.`;
  }
  const ml = errors.mlRmsMm ? null : optionalReading(input.mlRmsMm, "mlRmsMm", "ML sway RMS", "mm", SWAY_MAX_MM, errors);
  const ap = optionalReading(input.apRmsMm, "apRmsMm", "AP sway RMS", "mm", SWAY_MAX_MM, errors);
  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, value: { astronautId, recordedAt: recordedAt as string, protocol: input.protocol as BalanceProtocol, trialSide: input.trialSide as Side, durationS: duration as number, mlRmsMm: ml, apRmsMm: ap } };
}
