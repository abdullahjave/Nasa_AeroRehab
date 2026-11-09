"use client";

import { useId, useState } from "react";
import KneeAnatomySvg from "./KneeAnatomySvg";
import { KNEE_IMG as K, rotateAboutPivot } from "@/lib/knee-render";
import type { Sensor } from "@/lib/demo";

// Knee view built from local renders of the supplied skeleton model (see tools/render and assets/ATTRIBUTIONS.md).
// Layers: femur (fixed), tibia + fibula (rotate with flexion), patella (rotates at ~45% of flexion).
// Fallbacks: layers -> static knee-side.webp -> original SVG illustration. The angle arc, sensor patches, LEDs and
// labels are a separate UI overlay drawn on top; nothing in the renders contains UI.

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
  const [mode, setMode] = useState<"layers" | "static" | "svg">("layers");

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
