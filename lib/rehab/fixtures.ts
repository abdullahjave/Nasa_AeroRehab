import type { Exercise, ExerciseId, RehabProgram } from "./types";

// Deterministic demo fixtures for the rehabilitation module. Values are simulated.

export const EXERCISES: Record<ExerciseId, Exercise> = {
  "sit-to-stand": { id: "sit-to-stand", name: "Sit-to-Stand", prescription: "3 sets × 12 reps", info: "Stand up from a box without using the hands, then sit back down slowly." },
  "resisted-mini-squat": { id: "resisted-mini-squat", name: "Resisted Mini Squat", prescription: "3 sets × 15 reps", info: "Shallow squat with a band above the knees; keep knees in line with the toes." },
  "step-up": { id: "step-up", name: "Step-Up", prescription: "3 sets × 10 reps / leg", info: "Step onto a low platform with the training leg and control the step down." },
  "calf-raise": { id: "calf-raise", name: "Calf Raise", prescription: "3 sets × 20 reps", info: "Rise onto the toes on a step edge, pause, and lower slowly." },
  "single-leg-balance": { id: "single-leg-balance", name: "Single-Leg Balance", prescription: "4 × 30 s / leg", info: "Stand on one leg on a stable surface; use a support if needed." },
};

export const PROGRAMS: RehabProgram[] = [
  {
    id: "prog-chen-p3", astronautId: "astro-chen", name: "Phase 3 · Strength & Mobility", startMissionDay: 1, totalWeeks: 8,
    statusLabel: "On schedule (demo)", restWeekdays: [0],
    exercises: ["sit-to-stand", "resisted-mini-squat", "step-up", "calf-raise"],
    progress: { mobility: 92, strength: 78, balance: 70, endurance: 74 },
  },
  {
    id: "prog-okafor-p2", astronautId: "astro-okafor", name: "Phase 2 · Mobility", startMissionDay: 8, totalWeeks: 10,
    statusLabel: "Slightly behind (demo)", restWeekdays: [0, 3],
    exercises: ["sit-to-stand", "resisted-mini-squat", "calf-raise"],
    progress: { mobility: 64, strength: 52, balance: 48, endurance: 58 },
  },
  {
    id: "prog-alvarez-p3", astronautId: "astro-alvarez", name: "Phase 3 · Balance & Strength", startMissionDay: 1, totalWeeks: 8,
    statusLabel: "On schedule (demo)", restWeekdays: [0],
    exercises: ["single-leg-balance", "calf-raise", "step-up", "sit-to-stand"],
    progress: { mobility: 86, strength: 74, balance: 80, endurance: 77 },
  },
];

/** Seeded misses before the demo date (whole session or single assignment), per astronaut. */
export const SEEDED_MISSES: Record<string, { day: number; exercise?: ExerciseId }[]> = {
  "astro-chen": [{ day: 23 }, { day: 37, exercise: "step-up" }],
  "astro-okafor": [{ day: 16 }, { day: 29 }, { day: 38, exercise: "calf-raise" }],
  "astro-alvarez": [{ day: 12 }],
};

/** Completed on the demo date (Day 42) before any local edits. */
export const DEMO_DAY_DONE: Record<string, ExerciseId[]> = {
  "astro-chen": ["sit-to-stand", "resisted-mini-squat"],
  "astro-okafor": ["sit-to-stand"],
  "astro-alvarez": [],
};

/** Days whose duration was not recorded, and days with a recorded 0 (e.g. logged without a timer). */
export const DURATION_GAPS: Record<string, { missing: number[]; zero: number[] }> = {
  "astro-chen": { missing: [], zero: [] },
  "astro-okafor": { missing: [39], zero: [] },
  "astro-alvarez": { missing: [], zero: [38] },
};

/** Linking AI Insights findings to an exercise: only explicit matches per astronaut open an exercise. */
export const INSIGHT_EXERCISE_MATCH: Record<string, Partial<Record<"reduced-rom" | "scenario-event" | "data-gap", ExerciseId>>> = {
  "astro-chen": { "reduced-rom": "resisted-mini-squat" },
  "astro-okafor": { "reduced-rom": "sit-to-stand" },
};
