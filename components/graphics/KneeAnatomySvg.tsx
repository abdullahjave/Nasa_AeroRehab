import { useId } from "react";
import type { Sensor } from "@/lib/demo";

// Original side-view knee illustration (femur, tibia, fibula, patella, menisci, ligaments).
// Drawn locally as SVG; no third-party asset. Facing right; flexion swings the shank backward.

export const KNEE_VIEW = { w: 300, h: 330 };
export const KNEE_ORIGIN = { x: 150, y: 165 };
export const SHANK_LEN = 140;

const rad = (d: number) => (d * Math.PI) / 180;

/** Global position of a point given in the shank-local frame (x anterior, y down). */
export function shankPoint(x: number, y: number, flexionDeg: number) {
  const t = rad(flexionDeg);
  return {
    x: KNEE_ORIGIN.x + x * Math.cos(t) - y * Math.sin(t),
    y: KNEE_ORIGIN.y + x * Math.sin(t) + y * Math.cos(t),
  };
}
export const thighPoint = (x: number, y: number) => ({ x: KNEE_ORIGIN.x + x, y: KNEE_ORIGIN.y + y });

/** Sensor patch centres (global) so the overlay can mark the exact same spots. */
export function imuAnchors(flexionDeg: number) {
  return { thigh: thighPoint(41, -80), shank: shankPoint(33, 58, flexionDeg) };
}

function ledColor(s: Sensor | undefined) {
  if (!s || s.status === "offline") return "#64748b";
  return s.status === "low-battery" ? "#fbbf24" : "#34d399";
}
function ledText(s: Sensor | undefined) {
  if (!s || s.status === "offline") return "Offline";
  return s.status === "low-battery" ? "Low battery" : "Connected";
}

type Props = {
  /** Flexion in degrees. null draws a straight leg and greys the shank. */
  angle: number | null;
  thigh?: Sensor;
  shank?: Sensor;
  className?: string;
  /** Draw the angle arc and sensor labels (separate overlay layer). */
  overlay?: boolean;
  /** Draw ligaments and cartilage glow for a more detailed anatomical look. */
  detailed?: boolean;
};

export default function KneeAnatomySvg({ angle, thigh, shank, className = "", overlay = true, detailed = true }: Props) {
  const uid = useId().replace(/:/g, "");
  const th = angle ?? 0;
  const ok = angle !== null;
  const { x: kx, y: ky } = KNEE_ORIGIN;
  const anchors = imuAnchors(th);

  // Overlay geometry
  const R = 70;
  const arcStart = { x: kx, y: ky + R };
  const arcEnd = { x: kx - R * Math.sin(rad(th)), y: ky + R * Math.cos(rad(th)) };
  const mid = { x: kx - (R + 22) * Math.sin(rad(th / 2)), y: ky + (R + 22) * Math.cos(rad(th / 2)) };

  return (
    <div className={`relative ${className}`}>
      {/* Layer 1: anatomy illustration (no UI inside) */}
      <svg viewBox={`0 0 ${KNEE_VIEW.w} ${KNEE_VIEW.h}`} className="block h-full w-full" role="img"
        aria-label={ok ? `Side view of the knee at ${angle} degrees of flexion` : "Side view of the knee, angle unavailable"}>
        <defs>
          <linearGradient id={`${uid}-skin`} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#16304f" stopOpacity="0.85" />
            <stop offset="1" stopColor="#0d2036" stopOpacity="0.55" />
          </linearGradient>
          <linearGradient id={`${uid}-bone`} x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor="#eef6ff" />
            <stop offset="0.55" stopColor="#b6cdea" />
            <stop offset="1" stopColor="#6f8fb8" />
          </linearGradient>
          <radialGradient id={`${uid}-cart`} cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#67e8f9" stopOpacity="0.9" />
            <stop offset="1" stopColor="#22d3ee" stopOpacity="0" />
          </radialGradient>
          <filter id={`${uid}-glow`} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        <g transform={`translate(${kx} ${ky})`}>
          {/* Soft tissue: thigh (quadriceps front, hamstrings back) */}
          <path d="M -40 -150 C -44 -110 -42 -60 -36 -10 C -34 12 -28 30 -10 38 L 30 38 C 44 28 48 10 48 -10 C 52 -60 50 -110 42 -150 Z"
            fill={`url(#${uid}-skin)`} stroke="#38bdf8" strokeOpacity="0.5" strokeWidth="1.2" />
          {detailed && [-22, -6, 10, 26].map((x) => (
            <path key={x} d={`M ${x} -140 C ${x + 6} -90 ${x + 6} -50 ${x + 10} -10`} fill="none" stroke="#38bdf8" strokeOpacity="0.14" />
          ))}

          {/* Femur */}
          <path d="M -12 -150 L 13 -150 C 14 -108 15 -78 23 -48 C 31 -26 36 -4 30 14 C 22 32 -12 40 -30 26 C -42 10 -38 -20 -24 -44 C -15 -72 -13 -104 -12 -150 Z"
            fill={`url(#${uid}-bone)`} stroke="#e0f2fe" strokeWidth="1.2" />
          {/* Condyle contour highlight */}
          <path d="M -26 8 C -14 30 14 30 26 12" fill="none" stroke="#ffffff" strokeOpacity="0.55" strokeWidth="1.6" />

          {/* Shank rotates with flexion */}
          <g transform={`rotate(${th})`}>
            <path d={`M -38 14 C -48 50 -42 90 -22 ${SHANK_LEN - 12} L 22 ${SHANK_LEN - 12} C 30 100 34 60 40 18 Z`}
              fill={`url(#${uid}-skin)`} stroke={ok ? "#38bdf8" : "#64748b"} strokeOpacity="0.5" strokeWidth="1.2" />
            {/* Fibula */}
            <rect x="-24" y="36" width="9" height={SHANK_LEN - 52} rx="4.5" fill={`url(#${uid}-bone)`} opacity="0.85" stroke="#e0f2fe" strokeOpacity="0.7" />
            {/* Tibia with tuberosity, tapering to the ankle */}
            <path d={`M -28 22 C -10 17 16 17 32 22 L 32 32 C 32 46 28 62 25 78 C 22 98 16 ${SHANK_LEN - 30} 14 ${SHANK_LEN - 12} C 14 ${SHANK_LEN - 2} 2 ${SHANK_LEN + 2} -8 ${SHANK_LEN - 4} C -12 ${SHANK_LEN - 20} -8 100 -14 76 C -18 58 -24 46 -28 34 Z`}
              fill={`url(#${uid}-bone)`} stroke="#e0f2fe" strokeWidth="1.2" />
            {/* Foot (soft tissue) */}
            <path d={`M -22 ${SHANK_LEN - 12} C -26 ${SHANK_LEN + 8} -10 ${SHANK_LEN + 16} 20 ${SHANK_LEN + 14} C 44 ${SHANK_LEN + 12} 52 ${SHANK_LEN + 4} 44 ${SHANK_LEN - 4} L 20 ${SHANK_LEN - 12} Z`}
              fill={`url(#${uid}-skin)`} stroke={ok ? "#38bdf8" : "#64748b"} strokeOpacity="0.5" strokeWidth="1.2" />
            {/* Menisci */}
            <path d="M -26 20 C -14 14 -2 14 2 20 C -6 26 -18 26 -26 20 Z" fill="#22d3ee" fillOpacity="0.55" />
            <path d="M 4 20 C 12 14 24 14 30 20 C 22 26 10 26 4 20 Z" fill="#22d3ee" fillOpacity="0.55" />
            {/* Patellar tendon (shank side) */}
            <path d="M 30 30 C 36 44 34 62 28 78" fill="none" stroke="#fde68a" strokeOpacity="0.7" strokeWidth="2" />
          </g>

          {detailed && (
            <g>
              {/* Cruciate ligaments */}
              <path d={`M -6 -4 L ${shankPoint(10, 22, th).x - kx} ${shankPoint(10, 22, th).y - ky}`} stroke="#fda4af" strokeOpacity="0.85" strokeWidth="2.4" strokeLinecap="round" />
              <path d={`M 8 -2 L ${shankPoint(-8, 22, th).x - kx} ${shankPoint(-8, 22, th).y - ky}`} stroke="#fcd34d" strokeOpacity="0.8" strokeWidth="2.4" strokeLinecap="round" />
              {/* Cartilage contact glow */}
              <ellipse cx={shankPoint(2, 18, th).x - kx} cy={shankPoint(2, 18, th).y - ky} rx="30" ry="14" fill={`url(#${uid}-cart)`} />
            </g>
          )}

          {/* Patella tracks on the front of the joint, about half the flexion angle */}
          <g transform={`rotate(${th * 0.45})`}>
            <ellipse cx="38" cy="4" rx="9" ry="17" fill={`url(#${uid}-bone)`} stroke="#e0f2fe" strokeWidth="1.2" />
          </g>
          {/* Quadriceps tendon */}
          <path d={`M 34 -12 C 32 -40 30 -60 28 -86`} stroke="#fde68a" strokeOpacity="0.55" strokeWidth="2" fill="none" transform={`rotate(${th * 0.12})`} />

          {/* IMU patches (part of the suit) with LEDs */}
          <rect x="34" y="-100" width="15" height="40" rx="5" fill="#0b1d36" stroke="#38bdf8" strokeWidth="1.4" />
          <g transform={`rotate(${th})`}>
            <rect x="26" y="40" width="15" height="36" rx="5" fill="#0b1d36" stroke={ok ? "#38bdf8" : "#64748b"} strokeWidth="1.4" />
          </g>
        </g>

        {/* LEDs: drawn in global space so they sit exactly on the patches */}
        <circle cx={anchors.thigh.x} cy={anchors.thigh.y} r="4.5" fill={ledColor(thigh)} filter={`url(#${uid}-glow)`} />
        <circle cx={anchors.shank.x} cy={anchors.shank.y} r="4.5" fill={ledColor(shank)} filter={`url(#${uid}-glow)`} />
      </svg>

      {/* Layer 2: UI overlay (angle arc, axes, sensor labels), separate from the illustration */}
      {overlay && (
        <svg viewBox={`0 0 ${KNEE_VIEW.w} ${KNEE_VIEW.h}`} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
          <line x1={kx} y1={ky} x2={kx} y2={ky + 130} stroke="#94a3b8" strokeOpacity="0.5" strokeDasharray="3 4" />
          {ok && (
            <>
              <path d={`M ${arcStart.x} ${arcStart.y} A ${R} ${R} 0 ${th > 180 ? 1 : 0} 1 ${arcEnd.x} ${arcEnd.y}`} fill="none" stroke="#22d3ee" strokeWidth="3" strokeLinecap="round" />
              <circle cx={arcEnd.x} cy={arcEnd.y} r="4" fill="#22d3ee" />
              <rect x={mid.x - 26} y={mid.y - 11} width="52" height="22" rx="11" fill="#041224" fillOpacity="0.85" stroke="#22d3ee" strokeOpacity="0.6" />
              <text x={mid.x} y={mid.y + 5} textAnchor="middle" fontSize="14" fontWeight="600" fill="#67e8f9">{angle}&deg;</text>
            </>
          )}
          {/* Sensor labels with leader lines */}
          <line x1="96" y1="62" x2={anchors.thigh.x} y2={anchors.thigh.y} stroke="#38bdf8" strokeOpacity="0.5" />
          <text x="6" y="58" fontSize="12" fill="#e2e8f0">Thigh IMU</text>
          <circle cx="12" cy="72" r="3.5" fill={ledColor(thigh)} />
          <text x="20" y="76" fontSize="10.5" fill={ledColor(thigh)}>{ledText(thigh)}</text>

          <line x1="96" y1="292" x2={anchors.shank.x} y2={anchors.shank.y} stroke="#38bdf8" strokeOpacity="0.5" />
          <text x="6" y="288" fontSize="12" fill="#e2e8f0">Shank IMU</text>
          <circle cx="12" cy="302" r="3.5" fill={ledColor(shank)} />
          <text x="20" y="306" fontSize="10.5" fill={ledColor(shank)}>{ledText(shank)}</text>
        </svg>
      )}
    </div>
  );
}
