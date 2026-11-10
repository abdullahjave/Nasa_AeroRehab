"use client";

import { useId, useState } from "react";
import KneeAnatomySvg from "./KneeAnatomySvg";
import { KNEE_IMG as K, KNEE_PHOTO as P, rotateAboutPivot } from "@/lib/knee-render";
import type { Sensor } from "@/lib/demo";

// Knee view built from local renders of the supplied skeleton model (see tools/render and assets/ATTRIBUTIONS.md).
// Layers: femur (fixed), tibia + fibula (rotate with flexion), patella (rotates at ~45% of flexion).
// Fallbacks: layers -> static knee-side.webp -> original SVG illustration. The angle arc, sensor patches, LEDs and
// labels are a separate UI overlay drawn on top; nothing in the renders contains UI.

const PHOTO = "/images/knee-anatomy.webp";
const IMG = { femur: "/images/knee-femur.webp", tibia: "/images/knee-tibia.webp", patella: "/images/knee-patella.webp", side: "/images/knee-side.webp" };

// Clip and soften the render edges (the tibia swings out of frame at high flexion).
const EDGE_FADE = "linear-gradient(to right, transparent 0, #000 7%, #000 93%, transparent 100%)";

/** Ref callback: an <img> that failed before hydration never fires onError, so check it on attach. */
const failedEarly = (el: HTMLImageElement | null, fail: () => void) => {
  if (el && el.complete && el.naturalWidth === 0) queueMicrotask(fail);
};

function ledColor(s: Sensor | undefined) {
  if (!s || s.status === "offline") return "#64748b";
  return s.status === "low-battery" ? "#fbbf24" : "#34d399";
}
function ledText(s: Sensor | undefined) {
  if (!s || s.status === "offline") return "Offline";
  return s.status === "low-battery" ? "Low battery" : "Connected";
}

type Props = {
  /** Flexion in degrees. null shows the straight leg with the arc hidden. */
  angle: number | null;
  thigh?: Sensor;
  shank?: Sensor;
  className?: string;
  overlay?: boolean;
};

export default function KneeAnatomy({ angle, thigh, shank, className = "", overlay = true }: Props) {
  const uid = useId().replace(/:/g, "");
  const [mode, setMode] = useState<"photo" | "layers" | "static" | "svg">("photo");

  if (mode === "photo") return <KneePhoto angle={angle} thigh={thigh} shank={shank} overlay={overlay} className={className} onFail={() => setMode("layers")} />;

  if (mode === "svg") {
    return <KneeAnatomySvg angle={angle} thigh={thigh} shank={shank} overlay={overlay} className={className} />;
  }

  const th = mode === "layers" ? (angle ?? 0) : 0;
  const ok = angle !== null && mode === "layers";
  const { pivot } = K;
  const thighP = K.thighPatch;
  const shankP = rotateAboutPivot(K.shankPatch, th);

  // Arc between the straight-leg line (down) and the shank axis.
  const R = 118;
  const t = (th * Math.PI) / 180;
  const arcStart = { x: pivot.x, y: pivot.y + R };
  const arcEnd = { x: pivot.x - R * Math.sin(t), y: pivot.y + R * Math.cos(t) };
  // Label sits on the free anterior (right) side of the straight-leg line so it never covers the shank patch.
  const mid = { x: pivot.x + 92, y: pivot.y + R + 34 };

  const layer = "pointer-events-none absolute inset-0 h-full w-full select-none";
  return (
    <div className={`relative aspect-[3/4] ${className}`}>
      {/* Layer 1: rendered anatomy */}
      <div className="absolute inset-0 overflow-hidden" style={{ maskImage: EDGE_FADE, WebkitMaskImage: EDGE_FADE }}>
      {mode === "layers" ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={IMG.femur} alt="" aria-hidden="true" className={layer} draggable={false} onError={() => setMode("static")} ref={(el) => failedEarly(el, () => setMode("static"))} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={IMG.tibia} alt="" aria-hidden="true" className={layer} draggable={false} onError={() => setMode("static")} ref={(el) => failedEarly(el, () => setMode("static"))}
            style={{ transform: `rotate(${th}deg)`, transformOrigin: "50% 50%" }} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={IMG.patella} alt="" aria-hidden="true" className={layer} draggable={false} onError={() => setMode("static")} ref={(el) => failedEarly(el, () => setMode("static"))}
            style={{ transform: `rotate(${th * K.patellaFollow}deg)`, transformOrigin: "50% 50%" }} />
        </>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={IMG.side} alt="" aria-hidden="true" className={layer} draggable={false} onError={() => setMode("svg")} ref={(el) => failedEarly(el, () => setMode("svg"))} />
      )}
      </div>

      {/* Layer 2: UI overlay, same coordinate system as the render */}
      {overlay && (
        <svg viewBox={`0 0 ${K.w} ${K.h}`} className="pointer-events-none absolute inset-0 h-full w-full" role="img"
          aria-label={ok ? `Side view of the knee at ${angle} degrees of flexion` : "Side view of the knee, angle unavailable"}>
          <defs>
            <radialGradient id={`${uid}-joint`} cx="0.5" cy="0.5" r="0.5">
              <stop offset="0" stopColor="#67e8f9" stopOpacity="0.55" />
              <stop offset="1" stopColor="#22d3ee" stopOpacity="0" />
            </radialGradient>
            <filter id={`${uid}-glow`} x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="4" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>
          {/* Joint-space glow (UI accent, not anatomy) */}
          <ellipse cx={pivot.x + 12} cy={pivot.y + 18} rx="70" ry="26" fill={`url(#${uid}-joint)`} />
          {/* straight-leg reference */}
          <line x1={pivot.x} y1={pivot.y} x2={pivot.x} y2={pivot.y + 270} stroke="#94a3b8" strokeOpacity="0.55" strokeDasharray="6 7" strokeWidth="2" />
          <circle cx={pivot.x} cy={pivot.y} r="6" fill="#041224" stroke="#22d3ee" strokeWidth="2.5" />
          {ok && (
            <>
              <path d={`M ${arcStart.x} ${arcStart.y} A ${R} ${R} 0 ${th > 180 ? 1 : 0} 1 ${arcEnd.x} ${arcEnd.y}`} fill="none" stroke="#22d3ee" strokeWidth="5" strokeLinecap="round" />
              <circle cx={arcEnd.x} cy={arcEnd.y} r="7" fill="#22d3ee" />
              <rect x={mid.x - 46} y={mid.y - 20} width="92" height="40" rx="20" fill="#041224" fillOpacity="0.88" stroke="#22d3ee" strokeOpacity="0.7" strokeWidth="2" />
              <text x={mid.x} y={mid.y + 9} textAnchor="middle" fontSize="26" fontWeight="700" fill="#67e8f9">{angle}&deg;</text>
            </>
          )}

          {/* thigh IMU patch + LED (fixed with the femur) */}
          <rect x={thighP.x - 15} y={thighP.y - 42} width="30" height="84" rx="10" fill="#0b1d36" fillOpacity="0.9" stroke="#38bdf8" strokeWidth="2.5" />
          <circle cx={thighP.x} cy={thighP.y} r="8" fill={ledColor(thigh)} filter={`url(#${uid}-glow)`} />
          {/* shank IMU patch (rotates with the tibia) + LED */}
          <g transform={`rotate(${th} ${pivot.x} ${pivot.y})`}>
            <rect x={K.shankPatch.x - 15} y={K.shankPatch.y - 38} width="30" height="76" rx="10" fill="#0b1d36" fillOpacity="0.9" stroke={ok ? "#38bdf8" : "#64748b"} strokeWidth="2.5" />
          </g>
          <circle cx={shankP.x} cy={shankP.y} r="8" fill={ledColor(shank)} filter={`url(#${uid}-glow)`} />

          {/* labels with leader lines */}
          <line x1="160" y1="118" x2={thighP.x - 15} y2={thighP.y - 10} stroke="#38bdf8" strokeOpacity="0.6" strokeWidth="2" />
          <text x="10" y="112" fontSize="23" fill="#e2e8f0">Thigh IMU</text>
          <circle cx="20" cy="136" r="7" fill={ledColor(thigh)} />
          <text x="36" y="144" fontSize="20" fill={ledColor(thigh)}>{ledText(thigh)}</text>

          <line x1="160" y1="662" x2={Math.min(shankP.x - 12, 330)} y2={shankP.y + 14} stroke="#38bdf8" strokeOpacity="0.6" strokeWidth="2" />
          <text x="10" y="676" fontSize="23" fill="#e2e8f0">Shank IMU</text>
          <circle cx="20" cy="700" r="7" fill={ledColor(shank)} />
          <text x="36" y="708" fontSize="20" fill={ledColor(shank)}>{ledText(shank)}</text>
        </svg>
      )}
    </div>
  );
}

/** Supplied knee illustration with the angle arc, IMU patches, LEDs and labels as a separate overlay. */
function KneePhoto({ angle, thigh, shank, overlay, className, onFail }: { angle: number | null; thigh?: Sensor; shank?: Sensor; overlay: boolean; className: string; onFail: () => void }) {
  const uid = useId().replace(/:/g, "");
  const ok = angle !== null;
  const { pivot } = P;
  const R = 138;
  const rad = (d: number) => (d * Math.PI) / 180;
  // Directions are degrees from straight down, positive toward the anterior (right) side.
  // Rounded so server and client render identical attribute strings (no hydration mismatch).
  const r3 = (n: number) => Math.round(n * 1000) / 1000;
  const at = (deg: number, r: number) => ({ x: r3(pivot.x + r * Math.sin(rad(deg))), y: r3(pivot.y + r * Math.cos(rad(deg))) });
  const a0 = P.femurAxisDeg;
  const a1 = a0 - (angle ?? 0);
  const s = at(a0, R);
  const e = at(a1, R);
  const axisEnd = at(a0, 330);
  const sweep = Math.min(angle ?? 0, 359);
  const mid = at(a0 - sweep / 2, R + 34);
  const badge = { x: 626, y: 760 };
  const tp = P.thighPatch;
  const sp = P.shankPatch;
  return (
    <div className={`relative aspect-[3/4] ${className}`}>
      <div className="absolute inset-0 overflow-hidden" style={{ maskImage: EDGE_FADE, WebkitMaskImage: EDGE_FADE }}>
        <div className="absolute inset-0" style={{ maskImage: "linear-gradient(to bottom, #000 0, #000 88%, transparent 100%)", WebkitMaskImage: "linear-gradient(to bottom, #000 0, #000 88%, transparent 100%)" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={PHOTO} alt="" aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full select-none" style={{ mixBlendMode: "screen" }} draggable={false}
            onError={onFail} ref={(el) => failedEarly(el, onFail)} />
        </div>
      </div>
      {overlay && (
        <svg viewBox={`0 0 ${P.w} ${P.h}`} className="pointer-events-none absolute inset-0 h-full w-full" role="img"
          aria-label={ok ? `Side view of the knee, measured flexion ${angle} degrees. The illustration is static; the arc shows the measurement.` : "Side view of the knee, angle unavailable"}>
          <defs>
            <filter id={`${uid}-glow`} x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="5" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>
          {/* straight-leg reference: the femur axis continued past the knee */}
          <line x1={pivot.x} y1={pivot.y} x2={axisEnd.x} y2={axisEnd.y} stroke="#94a3b8" strokeOpacity="0.7" strokeDasharray="8 9" strokeWidth="3" />
          <circle cx={pivot.x} cy={pivot.y} r="8" fill="#041224" stroke="#22d3ee" strokeWidth="3.5" />
          {ok && (
            <>
              <path d={`M ${s.x} ${s.y} A ${R} ${R} 0 ${sweep > 180 ? 1 : 0} 1 ${e.x} ${e.y}`} fill="none" stroke="#22d3ee" strokeWidth="6" strokeLinecap="round" />
              <circle cx={e.x} cy={e.y} r="9" fill="#22d3ee" />
              <line x1={mid.x + 8} y1={mid.y + 4} x2={badge.x - 46} y2={badge.y - 8} stroke="#22d3ee" strokeOpacity="0.5" strokeWidth="2" />
              <rect x={badge.x - 54} y={badge.y - 27} width="108" height="54" rx="27" fill="#041224" fillOpacity="0.9" stroke="#22d3ee" strokeOpacity="0.75" strokeWidth="2.5" />
              <text x={badge.x} y={badge.y + 12} textAnchor="middle" fontSize="34" fontWeight="700" fill="#67e8f9">{angle}&deg;</text>
            </>
          )}

          {/* thigh IMU patch on the femur, shank IMU patch on the tibia */}
          <g transform={`rotate(${tp.rotDeg} ${tp.x} ${tp.y})`}><rect x={tp.x - 20} y={tp.y - 56} width="40" height="112" rx="13" fill="#0b1d36" fillOpacity="0.88" stroke="#38bdf8" strokeWidth="3.5" /></g>
          <circle cx={tp.x} cy={tp.y} r="11" fill={ledColor(thigh)} filter={`url(#${uid}-glow)`} />
          <g transform={`rotate(${sp.rotDeg} ${sp.x} ${sp.y})`}><rect x={sp.x - 20} y={sp.y - 52} width="40" height="104" rx="13" fill="#0b1d36" fillOpacity="0.88" stroke="#38bdf8" strokeWidth="3.5" /></g>
          <circle cx={sp.x} cy={sp.y} r="11" fill={ledColor(shank)} filter={`url(#${uid}-glow)`} />

          {/* labels with leader lines, in the empty right-hand margin */}
          <line x1="548" y1="112" x2={tp.x + 24} y2={tp.y - 20} stroke="#38bdf8" strokeOpacity="0.6" strokeWidth="2.5" />
          <text x="552" y="96" fontSize="30" fill="#e2e8f0">Thigh IMU</text>
          <circle cx="562" cy="128" r="9" fill={ledColor(thigh)} />
          <text x="580" y="136" fontSize="26" fill={ledColor(thigh)}>{ledText(thigh)}</text>

          <line x1="556" y1="930" x2={sp.x + 26} y2={sp.y + 30} stroke="#38bdf8" strokeOpacity="0.6" strokeWidth="2.5" />
          <text x="560" y="954" fontSize="30" fill="#e2e8f0">Shank IMU</text>
          <circle cx="570" cy="984" r="9" fill={ledColor(shank)} />
          <text x="588" y="992" fontSize="26" fill={ledColor(shank)}>{ledText(shank)}</text>
        </svg>
      )}
    </div>
  );
}
