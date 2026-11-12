"use client";

import { useState } from "react";
import type { ExerciseId } from "@/lib/rehab";

type P = [number, number];
type Pose = { head: P; neck: P; hip: P; knee: P; ankle: P; toe: P; knee2: P; ankle2: P; toe2: P; elbow: P; hand: P; prop?: "box" | "step" | "low-step" | "band" | "pad" };

// Side-view fallback pictograms (original, local). Used when public/images/rehab/<id>.webp is missing.
const POSES: Record<ExerciseId, Pose> = {
  "sit-to-stand": { head: [57, 18], neck: [55, 28], hip: [42, 58], knee: [64, 62], ankle: [62, 86], toe: [72, 88], knee2: [62, 63], ankle2: [60, 86], toe2: [70, 88], elbow: [64, 40], hand: [76, 44], prop: "box" },
  "resisted-mini-squat": { head: [60, 14], neck: [59, 24], hip: [52, 54], knee: [70, 64], ankle: [62, 88], toe: [73, 90], knee2: [67, 65], ankle2: [59, 88], toe2: [70, 90], elbow: [70, 34], hand: [82, 36], prop: "band" },
  "step-up": { head: [58, 10], neck: [58, 20], hip: [57, 50], knee: [72, 60], ankle: [74, 72], toe: [84, 74], knee2: [52, 70], ankle2: [48, 90], toe2: [58, 92], elbow: [54, 36], hand: [56, 50], prop: "step" },
  "calf-raise": { head: [60, 8], neck: [60, 18], hip: [60, 48], knee: [61, 64], ankle: [62, 76], toe: [70, 82], knee2: [59, 64], ankle2: [60, 76], toe2: [68, 82], elbow: [58, 34], hand: [57, 48], prop: "low-step" },
  "single-leg-balance": { head: [60, 10], neck: [60, 20], hip: [60, 50], knee: [61, 68], ankle: [61, 86], toe: [70, 88], knee2: [74, 62], ankle2: [66, 74], toe2: [72, 78], elbow: [40, 26], hand: [26, 24], prop: "pad" },
};

function Pictogram({ id }: { id: ExerciseId }) {
  const p = POSES[id];
  const BODY = "rgba(56,189,248,0.32)";
  const EDGE = "#bae6fd";
  const limb = (a: P, b: P, w: number, dim = false) => (
    <g opacity={dim ? 0.55 : 1}>
      <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={BODY} strokeWidth={w} strokeLinecap="round" />
      <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={EDGE} strokeWidth="1.1" strokeLinecap="round" />
    </g>
  );
  return (
    <svg viewBox="0 0 120 100" className="h-full w-full" role="img" aria-label={`Fallback illustration of ${id.replace(/-/g, " ")}`}>
      <ellipse cx="62" cy="94" rx="40" ry="4" fill="#22d3ee" opacity="0.18" />
      {p.prop === "box" && <rect x="18" y="58" width="28" height="32" rx="2" fill="#0b2a52" stroke="#38bdf8" strokeOpacity="0.6" />}
      {p.prop === "step" && <rect x="62" y="74" width="40" height="18" rx="2" fill="#0b2a52" stroke="#38bdf8" strokeOpacity="0.6" />}
      {p.prop === "low-step" && <rect x="40" y="82" width="44" height="10" rx="2" fill="#0b2a52" stroke="#38bdf8" strokeOpacity="0.6" />}
      {p.prop === "pad" && <ellipse cx="62" cy="90" rx="26" ry="4" fill="none" stroke="#22d3ee" strokeOpacity="0.7" />}
      {p.prop === "box" && <path d="M 30 50 L 30 34 M 25 39 L 30 33 L 35 39" stroke="#67e8f9" strokeWidth="2" fill="none" strokeLinecap="round" />}
      {limb(p.hip, p.knee2, 9, true)}{limb(p.knee2, p.ankle2, 7, true)}{limb(p.ankle2, p.toe2, 4, true)}
      {limb(p.neck, p.hip, 15)}
      <circle cx={p.head[0]} cy={p.head[1]} r="7" fill={BODY} stroke={EDGE} strokeWidth="1.1" />
      {limb(p.hip, p.knee, 10)}{limb(p.knee, p.ankle, 8)}{limb(p.ankle, p.toe, 5)}
      {limb(p.neck, p.elbow, 6)}{limb(p.elbow, p.hand, 5)}
      {p.prop === "band" && <ellipse cx={(p.knee[0] + p.knee2[0]) / 2} cy={p.knee[1] + 1} rx="6" ry="3" fill="none" stroke="#34d399" strokeWidth="2.2" />}
      {[p.hip, p.knee, p.ankle].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="2.4" fill="#e0f7ff" />)}
    </svg>
  );
}

/** Exercise image: the WebP when present (checked at build time), otherwise the labelled fallback pictogram. */
export default function ExerciseVisual({ id, hasImage }: { id: ExerciseId; hasImage: boolean }) {
  const [failed, setFailed] = useState(false);
  if (hasImage && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={`/images/rehab/${id}.webp`} alt="" aria-hidden="true" className="h-full w-full object-contain object-bottom" onError={() => setFailed(true)}
        ref={(el) => { if (el && el.complete && el.naturalWidth === 0) queueMicrotask(() => setFailed(true)); }} />
    );
  }
  return (
    <div className="relative h-full w-full">
      <Pictogram id={id} />
      <span className="absolute bottom-0 left-0 rounded bg-black/50 px-1 text-[12px] text-slate-400">fallback</span>
    </div>
  );
}
