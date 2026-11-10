import { SENSOR_LAYOUT, ZONE_KEYS, sensorId } from "./layout";
import type { FootSide, PressureFrame, PressureSample, ZoneKey } from "./types";

/**
 * Parameters of one simulated recording. This is the ONLY place where simulated load and pressure level are
 * defined; shares, peaks and CoP are all derived from the generated samples by compute.ts.
 */
export type PressureSpec = {
  /** Offsets the deterministic waveforms so astronauts and sessions differ. */
  seed: number;
  durationSec: number;
  sampleRateHz: number;
  /** Peak pressure (kPa) each sensor can reach during the task. */
  peaksKpa: Record<FootSide, Record<ZoneKey, number>>;
  /** Mean fraction of the weight carried by the left foot (before shaping), 0-1. */
  leftBias: number;
  /** Amplitude of the slow left/right weight shift, 0-0.3. */
  shiftAmp: number;
  /** Sensor dropouts. Omit zone for the whole foot, omit times for the whole recording. */
  dropouts?: { side: FootSide; zone?: ZoneKey; fromSec?: number; toSec?: number }[];
};

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Deterministic "weight-shift" recording (no randomness): the weight moves slowly between the feet while the
 * centre of load rocks heel <-> forefoot. Toe sensors reach exactly 0 kPa when the toes unload, which is a
 * measured zero and not a missing reading.
 */
export function buildRecording(spec: PressureSpec): PressureFrame[] {
  const n = Math.round(spec.durationSec * spec.sampleRateHz);
  const frames: PressureFrame[] = [];
  const wShift = (2 * Math.PI) / 7.5;
  const wSway = (2 * Math.PI) / 11;
  const maxL = spec.leftBias + spec.shiftAmp;
  const maxR = 1 - spec.leftBias + spec.shiftAmp;

  for (let i = 0; i < n; i++) {
    const tSec = i / spec.sampleRateHz;
    const timestampMs = Math.round((i * 1000) / spec.sampleRateHz);
    const wl = spec.leftBias + spec.shiftAmp * Math.sin(wShift * tSec + spec.seed);
    const scale: Record<FootSide, number> = { left: wl / maxL, right: (1 - wl) / maxR };
    const lean = Math.sin(wSway * tSec + spec.seed * 1.7); // -1 forefoot loaded ... +1 heel loaded
    const toeOff = 0.5 + 0.5 * lean;
    const zoneFactor: Record<ZoneKey, number> = {
      heel: 0.65 + 0.35 * lean,
      midfoot: 0.9 + 0.1 * Math.cos(wSway * tSec + spec.seed),
      mt1: 0.65 - 0.35 * lean,
      mt23: 0.65 - 0.35 * lean,
      mt45: 0.65 - 0.35 * lean,
      hallux: Math.max(0, 1 - 0.9 * toeOff),
      toes: Math.max(0, 1 - 1.2 * toeOff), // exactly 0 when leaning back
    };

    const samples: PressureSample[] = [];
    for (const side of ["left", "right"] as const) {
      ZONE_KEYS.forEach((zone, zi) => {
        const lay = SENSOR_LAYOUT[zone];
        const dropped = (spec.dropouts ?? []).some(
          (d) => d.side === side && (d.zone === undefined || d.zone === zone) && tSec >= (d.fromSec ?? 0) && tSec <= (d.toSec ?? Infinity),
        );
        const ripple = 1 + 0.02 * Math.sin(7 * tSec + zi + spec.seed);
        const raw = spec.peaksKpa[side][zone] * scale[side] * zoneFactor[zone] * ripple;
        const kpa = round1(Math.min(spec.peaksKpa[side][zone], Math.max(0, raw)));
        samples.push({
          timestampMs,
          sensorId: sensorId(side, zone),
          side,
          pressureKpa: dropped ? null : kpa,
          areaCm2: lay.areaCm2,
          positionMm: { x: lay.x, y: lay.y },
          status: dropped ? "missing" : "ok",
        });
      });
    }
    frames.push({ timestampMs, samples });
  }
  return frames;
}
