// Rehabilitation data model. Pure types (no React). Days are mission days; calendar dates are derived from them.

export type ExerciseId = "sit-to-stand" | "resisted-mini-squat" | "step-up" | "calf-raise" | "single-leg-balance";

export type Exercise = {
  id: ExerciseId;
  name: string;
  /** Fixture prescription, e.g. "3 sets x 12 reps". */
  prescription: string;
  info: string;
};

export type RehabProgram = {
  id: string;
  astronautId: string;
  name: string;
  startMissionDay: number;
  totalWeeks: number;
  /** Simulated plan status text (fixture, not calculated). */
  statusLabel: string;
  /** Weekdays without a session, 0 = Sunday ... 6 = Saturday. */
  restWeekdays: number[];
  exercises: ExerciseId[];
  /** Demo progress scores 0-100 (fixture; no documented scoring model). */
  progress: { mobility: number; strength: number; balance: number; endurance: number };
};

export type Assignment = {
  /** Unique per scheduled session: `${scheduledSessionId}:${exerciseId}`. */
  id: string;
  scheduledSessionId: string;
  exerciseId: ExerciseId;
  required: boolean;
};

export type ScheduledSession = {
  /** Reuses the existing session ID on days that have a full session record. */
  id: string;
  programId: string;
  missionDay: number;
  assignments: Assignment[];
};

/** Recorded duration of a session in minutes. null = not recorded (distinct from a recorded 0). */
export type DurationRecord = { scheduledSessionId: string; minutes: number | null };

/** assignmentId -> completed. Missing key = not completed. */
export type Completions = Record<string, boolean>;

/** Simulated recovery scores, dated by mission day (fixture). */
export type RecoveryScore = {
  missionDay: number;
  programWeek: number;
  recoveryIndex: number;
  readiness: number;
  muscleRecovery: number;
  jointReadiness: number;
  fatigueIndex: number;
};

export type Ratio = { kind: "value"; num: number; den: number; pct: number } | { kind: "unavailable"; reason: "no-scheduled-sessions" | "no-assignments" };
