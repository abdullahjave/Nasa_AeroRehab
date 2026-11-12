import { analyzeFrame, analyzeSession } from "../pressure/compute";
import type { FrameAnalysis, SessionAnalysis } from "../pressure/types";
import { summarizeTrial } from "../balance/compute";
import type { TrialSummary } from "../balance/types";
import { framesFromRows } from "./pressure";
import { samplesFromRows } from "./balance";
import type { BalanceRow, PressureRow, SensorGeometry } from "./types";

// The ONE place where saved import samples are turned into numbers. It only calls the existing calculation modules
// (lib/pressure/compute, lib/balance/compute). The screens, Overview and Reports all go through these helpers, so they cannot disagree.

export function analyzePressureRows(geometry: SensorGeometry[], rows: PressureRow[]) {
  const frames = framesFromRows(geometry, rows);
  const analyses: FrameAnalysis[] = frames.map(analyzeFrame);
  const session: SessionAnalysis = analyzeSession(analyses);
  return { frames, analyses, session };
}

export const summarizePressureRows = (geometry: SensorGeometry[], rows: PressureRow[]): SessionAnalysis => analyzePressureRows(geometry, rows).session;

export function analyzeBalanceRows(rows: BalanceRow[]) {
  const { samples, intervalMs, skippedSlots } = samplesFromRows(rows);
  const sampleRateHz = intervalMs > 0 ? 1000 / intervalMs : undefined;
  const summary: TrialSummary = summarizeTrial(samples, sampleRateHz);
  return { samples, intervalMs, sampleRateHz: sampleRateHz ?? 1, skippedSlots, summary };
}

export const summarizeBalanceRows = (rows: BalanceRow[]): TrialSummary => analyzeBalanceRows(rows).summary;
