// Types for sensor CSV imports (Backend Phase 2C). Plain JSON-friendly shapes shared by the server, the API and the screens.
import type { SessionAnalysis } from "../pressure/types";
import type { TrialSummary } from "../balance/types";
import type { CsvIssue } from "./csv";

export type ImportKind = "pressure" | "balance";

/** One geometry row of a pressure import: where a sensor is and how large it is, in the foot-local frame. */
export type SensorGeometry = { foot: "left" | "right"; sensorId: string; areaCm2: number; xMm: number; yMm: number };

/** One stored pressure reading. pressureKpa null = the file had a blank value (missing). 0 is a real zero. */
export type PressureRow = { timeMs: number; foot: "left" | "right"; sensorId: string; pressureKpa: number | null };

/** One stored balance sample. Both null = a blank row (missing). */
export type BalanceRow = { timeMs: number; mlMm: number | null; apMm: number | null };

/** What the preview shows before anything is saved (and what the detail pages show after). */
export type PressurePreview = {
  kind: "pressure";
  rowCount: number;
  frameCount: number;
  startMs: number;
  endMs: number;
  /** Median spacing between frames, ms. */
  intervalMs: number;
  sensorCount: { left: number; right: number };
  /** Frames in which at least one sensor of a reported foot has no reading (blank or absent row). */
  incompleteFrames: number;
  blankReadings: number;
  absentReadings: number;
  /** Frames in which a foot had no readings at all. */
  missingFootFrames: { left: number; right: number };
  /** Frames where both feet are complete: the only frames that can give a bilateral load share. */
  bilateralFrames: number;
  /** Foot-local frame check result in words (for the preview). */
  orientation: string;
};

export type BalancePreview = {
  kind: "balance";
  rowCount: number;
  validSamples: number;
  missingSamples: number;
  /** Placeholder slots for timestamps skipped inside a gap (so coverage and gaps are explicit). */
  skippedSlots: number;
  startMs: number;
  endMs: number;
  observedDurationS: number;
  intervalMs: number;
  coverage: number;
  /** Intervals without valid samples, in seconds since the first sample. */
  gaps: { fromS: number; toS: number }[];
};

export type ImportPreview = PressurePreview | BalancePreview;

/** Stored import metadata (no samples). Shown on detail pages, in Overview and in Reports to identify the origin of a reading. */
export type ImportMeta = {
  id: string;
  kind: ImportKind;
  assessmentId: string;
  astronautId: string;
  fileName: string;
  importedAt: string;
  template: string;
  preview: ImportPreview;
  /** Side and protocol of the saved assessment that the file was attached to (balance). */
  context: { side?: "left" | "right"; protocol: string };
};

/** Values calculated from the saved samples with the shared calculation modules. Never stored: recomputed when read. */
export type ImportSummary =
  | { kind: "pressure"; session: SessionAnalysis }
  | { kind: "balance"; trial: TrialSummary };

export type RecordedImport = ImportMeta & { summary: ImportSummary };

export type ParseFailure = { ok: false; issues: CsvIssue[]; hidden: number };
