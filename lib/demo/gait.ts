// Gait-cycle model: joint-angle curves and body poses as functions of cycle percent (0-100).
// Tables are simplified textbook-style curves; per-astronaut `curveScale` varies amplitude.

type Table = [number, number][];

const HIP: Table = [[0, 30], [10, 27], [30, 6], [50, -10], [60, -6], [73, 15], [87, 30], [100, 30]];
const KNEE: Table = [[0, 5], [12, 18], [30, 8], [45, 8], [55, 30], [62, 42], [73, 60], [85, 35], [95, 8], [100, 5]];
const ANKLE: Table = [[0, 0], [8, -5], [12, -3], [30, 8], [45, 12], [55, -5], [62, -17], [73, -8], [87, 0], [100, 0]];
/** Absolute foot pitch from horizontal (deg, + toes up). */
const FOOT: Table = [[0, 15], [8, -2], [12, 0], [30, 0], [45, 5], [55, -20], [62, -40], [73, -15], [87, 5], [100, 15]];

function lerpTable(t: Table, p: number): number {
  const x = ((p % 100) + 100) % 100 || (p >= 100 ? 100 : 0);
  for (let i = 1; i < t.length; i++) {
    if (x <= t[i][0]) {
      const [x0, y0] = t[i - 1];
      const [x1, y1] = t[i];
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0 || 1);
    }
  }
  return t[t.length - 1][1];
}

export type CurveScale = { hip: number; knee: number; ankle: number };
export const NO_SCALE: CurveScale = { hip: 1, knee: 1, ankle: 1 };

export type JointAngles = { hip: number; knee: number; ankle: number };

export function jointAnglesAt(p: number, scale: CurveScale = NO_SCALE): JointAngles {
  return {
    hip: lerpTable(HIP, p) * scale.hip,
    knee: lerpTable(KNEE, p) * scale.knee,
    ankle: lerpTable(ANKLE, p) * scale.ankle,
  };
}

/** Chart rows for the gait-cycle plot, every 2% of the cycle. */
export function gaitCurveRows(scale: CurveScale = NO_SCALE) {
  const rows: { p: number; hip: number; knee: number; ankle: number }[] = [];
  for (let p = 0; p <= 100; p += 2) {
    const a = jointAnglesAt(p, scale);
    rows.push({ p, hip: Math.round(a.hip * 10) / 10, knee: Math.round(a.knee * 10) / 10, ankle: Math.round(a.ankle * 10) / 10 });
  }
  return rows;
}

export type GaitPhase = {
  key: string;
  label: string;
  /** Representative cycle percent for this pose. */
  p: number;
  /** Inclusive cycle range covered. */
  range: [number, number];
  support: "Stance" | "Swing";
  detail: string;
};

export const GAIT_PHASES: GaitPhase[] = [
  { key: "heel-strike", label: "Heel Strike", p: 0, range: [0, 2], support: "Stance", detail: "Initial contact. The heel touches the ground with the knee nearly extended and the hip flexed." },
  { key: "loading", label: "Loading", p: 12, range: [2, 12], support: "Stance", detail: "Loading response. Body weight is accepted and the knee flexes slightly to absorb shock." },
  { key: "mid-stance", label: "Mid-Stance", p: 31, range: [12, 31], support: "Stance", detail: "Single-limb support. The body passes over a flat foot while the hip extends." },
  { key: "terminal-stance", label: "Terminal Stance", p: 50, range: [31, 50], support: "Stance", detail: "The heel rises and the body moves ahead of the supporting foot." },
  { key: "pre-swing", label: "Pre-Swing / Toe-Off", p: 62, range: [50, 62], support: "Stance", detail: "Toe-off. Push-off ends and the knee flexes quickly as the limb unloads." },
  { key: "swing", label: "Swing", p: 80, range: [62, 98], support: "Swing", detail: "The limb swings forward. Peak knee flexion early, then extension ahead of the next contact." },
  { key: "heel-strike-2", label: "Heel Strike", p: 100, range: [98, 100], support: "Stance", detail: "Cycle ends with the next initial contact." },
];

export function phaseAt(p: number): GaitPhase {
  const x = Math.max(0, Math.min(100, p));
  return GAIT_PHASES.find((ph) => x >= ph.range[0] && x <= ph.range[1]) ?? GAIT_PHASES[0];
}

// ---------- body pose (side view, facing right) ----------

export type Pt = { x: number; y: number };
export type LegPose = { hip: Pt; knee: Pt; ankle: Pt; toe: Pt; heel: Pt };
export type BodyPose = {
  head: Pt; neck: Pt; shoulder: Pt; pelvis: Pt;
  near: LegPose; far: LegPose;
  armNear: { elbow: Pt; hand: Pt };
  armFar: { elbow: Pt; hand: Pt };
  ground: number;
};

const rad = (d: number) => (d * Math.PI) / 180;
const add = (a: Pt, d: Pt): Pt => ({ x: a.x + d.x, y: a.y + d.y });

function leg(hipPt: Pt, hipDeg: number, kneeDeg: number, footPitchDeg: number): LegPose {
  const L1 = 88;
  const L2 = 84;
  const knee = add(hipPt, { x: L1 * Math.sin(rad(hipDeg)), y: L1 * Math.cos(rad(hipDeg)) });
  const s = hipDeg - kneeDeg; // absolute shank angle from vertical
  const ankle = add(knee, { x: L2 * Math.sin(rad(s)), y: L2 * Math.cos(rad(s)) });
  const g = rad(footPitchDeg);
  const toe = add(ankle, { x: 30 * Math.cos(g), y: 9 - 30 * Math.sin(g) });
  const heel = add(ankle, { x: -12 * Math.cos(g), y: 9 + 12 * Math.sin(g) });
  return { hip: hipPt, knee, ankle, toe, heel };
}

/**
 * Full-body pose at cycle percent p. The near leg is at p, the far leg at p+50. The body is
 * translated vertically so the lowest foot point rests on the ground line.
 */
export function bodyPoseAt(p: number, scale: CurveScale = NO_SCALE): BodyPose {
  const pelvis0: Pt = { x: 100, y: 170 };
  const a = jointAnglesAt(p, scale);
  const b = jointAnglesAt(p + 50, scale);
  const near = leg(pelvis0, a.hip, a.knee, lerpTable(FOOT, p));
  const far = leg(pelvis0, b.hip, b.knee, lerpTable(FOOT, p + 50));
  const lowest = Math.max(near.toe.y, near.heel.y, far.toe.y, far.heel.y);
  const dy = 372 - lowest;
  const sh = (pt: Pt): Pt => ({ x: pt.x, y: pt.y + dy });
  const shLeg = (l: LegPose): LegPose => ({ hip: sh(l.hip), knee: sh(l.knee), ankle: sh(l.ankle), toe: sh(l.toe), heel: sh(l.heel) });
  const pelvis = sh(pelvis0);
  const neck = { x: pelvis.x + 4, y: pelvis.y - 78 };
  const shoulder = { x: neck.x, y: neck.y + 10 };
  const arm = (swingDeg: number) => {
    const upper = 46;
    const fore = 40;
    const elbow = add(shoulder, { x: upper * Math.sin(rad(swingDeg)), y: upper * Math.cos(rad(swingDeg)) });
    const hand = add(elbow, { x: fore * Math.sin(rad(swingDeg + 22)), y: fore * Math.cos(rad(swingDeg + 22)) });
    return { elbow, hand };
  };
  return {
    head: { x: neck.x + 3, y: neck.y - 20 },
    neck, shoulder, pelvis,
    near: shLeg(near), far: shLeg(far),
    armNear: arm(-0.7 * b.hip * 0.9),
    armFar: arm(-0.7 * a.hip * 0.9),
    ground: 372 + 9,
  };
}
