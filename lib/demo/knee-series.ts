import type { KneeSample } from "./types";

type Options = {
  count: number;
  intervalSec: number;
  peakDeg: number;
  minDeg: number;
  currentDeg: number;
  /** Seconds per exercise repetition. */
  repPeriodSec: number;
  /** Rep index (0-based) that carries the session peak. */
  peakRep: number;
  /** Deterministic phase offset so astronauts look different. */
  phase: number;
  /** Sample indices that are sensor dropouts (null). */
  dropouts?: number[];
};

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Deterministic knee-flexion series (no randomness). Each repetition is a smooth
 * extension -> flexion -> extension curve with a slowly varying amplitude. The series is
 * then pinned so its max equals `peakDeg`, its min equals `minDeg`, and its last sample
 * equals `currentDeg`, which keeps charts and summary cards in agreement.
 */
export function buildKneeSeries(o: Options): KneeSample[] {
  const span = o.peakDeg - o.minDeg;
  const out: KneeSample[] = [];
  let maxIdx = 0;
  let minIdx = 0;

  for (let i = 0; i < o.count; i++) {
    const t = i * o.intervalSec;
    const rep = t / o.repPeriodSec;
    const repIdx = Math.floor(rep);
    const x = rep - repIdx; // 0..1 within the rep
    const curve = 0.5 - 0.5 * Math.cos(2 * Math.PI * x); // 0 -> 1 -> 0
    // Amplitude drifts between 0.78 and 0.96 of the span; the peak rep reaches 1.
    const drift = 0.87 + 0.09 * Math.sin(repIdx * 0.9 + o.phase) - 0.04 * Math.cos(repIdx * 0.37 + o.phase * 2);
    const amp = repIdx === o.peakRep ? 1 : Math.min(drift, 0.97);
    const v = o.minDeg + span * amp * curve;
    out.push({ t, flexionDeg: round1(v) });
    if ((out[i].flexionDeg as number) > (out[maxIdx].flexionDeg as number)) maxIdx = i;
    if ((out[i].flexionDeg as number) < (out[minIdx].flexionDeg as number)) minIdx = i;
  }

  out[maxIdx] = { ...out[maxIdx], flexionDeg: o.peakDeg };
  out[minIdx] = { ...out[minIdx], flexionDeg: o.minDeg };

  // Ease the tail into the current angle so there is no visible jump.
  const last = out.length - 1;
  const prev = out[last - 1].flexionDeg as number;
  out[last - 1] = { ...out[last - 1], flexionDeg: round1((prev + o.currentDeg) / 2) };
  out[last] = { ...out[last], flexionDeg: o.currentDeg };

  for (const d of o.dropouts ?? []) if (out[d]) out[d] = { ...out[d], flexionDeg: null };
  return out;
}
