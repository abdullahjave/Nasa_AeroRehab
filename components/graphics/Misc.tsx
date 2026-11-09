import { useId } from "react";
import { pressureColor } from "@/lib/demo";

/** Stylised astronaut (original illustration). `earth` adds a planet limb behind. */
export function AstronautArt({ className = "", earth = false, label }: { className?: string; earth?: boolean; label?: string }) {
  const uid = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 220 200" className={className} role="img" aria-label={label ?? "Astronaut illustration"} preserveAspectRatio="xMidYMax slice">
      <defs>
        <radialGradient id={`${uid}-visor`} cx="0.35" cy="0.3" r="0.9">
          <stop offset="0" stopColor="#7dd3fc" />
          <stop offset="0.45" stopColor="#1d4ed8" />
          <stop offset="1" stopColor="#0b1330" />
        </radialGradient>
        <linearGradient id={`${uid}-suit`} x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#f1f5f9" />
          <stop offset="1" stopColor="#94a3b8" />
        </linearGradient>
        <radialGradient id={`${uid}-earth`} cx="0.5" cy="1" r="0.8">
          <stop offset="0.6" stopColor="#1e6fd9" />
          <stop offset="0.9" stopColor="#38bdf8" />
          <stop offset="1" stopColor="#bae6fd" />
        </radialGradient>
      </defs>
      {earth && <ellipse cx="170" cy="230" rx="190" ry="110" fill={`url(#${uid}-earth)`} opacity="0.9" />}
      {/* shoulders */}
      <path d="M 24 200 C 28 150 62 138 110 138 C 158 138 192 150 196 200 Z" fill={`url(#${uid}-suit)`} stroke="#cbd5e1" />
      <rect x="92" y="150" width="36" height="24" rx="5" fill="#334155" stroke="#38bdf8" strokeOpacity="0.6" />
      <circle cx="102" cy="162" r="3" fill="#34d399" />
      <circle cx="116" cy="162" r="3" fill="#38bdf8" />
      <rect x="40" y="170" width="22" height="9" rx="2" fill="#2563eb" />
      {/* helmet */}
      <circle cx="110" cy="84" r="58" fill={`url(#${uid}-suit)`} stroke="#e2e8f0" strokeWidth="2" />
      <ellipse cx="112" cy="86" rx="40" ry="35" fill={`url(#${uid}-visor)`} stroke="#0f172a" strokeWidth="3" />
      <ellipse cx="96" cy="72" rx="13" ry="8" fill="#ffffff" opacity="0.35" transform="rotate(-25 96 72)" />
      <rect x="86" y="140" width="48" height="10" rx="4" fill="#cbd5e1" />
    </svg>
  );
}

/** Small IMU chip graphic for the calibration panel. */
export function ImuChip({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 100" className={className} role="img" aria-label="IMU sensor module">
      {Array.from({ length: 6 }).map((_, i) => (
        <g key={i} stroke="#fcd34d" strokeWidth="3" strokeLinecap="round">
          <line x1={26 + i * 14} y1="14" x2={26 + i * 14} y2="24" />
          <line x1={26 + i * 14} y1="76" x2={26 + i * 14} y2="86" />
        </g>
      ))}
      {Array.from({ length: 5 }).map((_, i) => (
        <g key={i} stroke="#fcd34d" strokeWidth="3" strokeLinecap="round">
          <line x1="14" y1={26 + i * 12} x2="24" y2={26 + i * 12} />
          <line x1="96" y1={26 + i * 12} x2="106" y2={26 + i * 12} />
        </g>
      ))}
      <rect x="24" y="24" width="72" height="52" rx="5" fill="#0f2a4a" stroke="#38bdf8" strokeWidth="1.5" />
      <rect x="32" y="32" width="56" height="36" rx="3" fill="#06142a" stroke="#22d3ee" strokeOpacity="0.6" />
      <text x="60" y="52" textAnchor="middle" fontSize="12" fontWeight="700" fill="#e0f2fe">IMU</text>
      <text x="60" y="63" textAnchor="middle" fontSize="8" fill="#7dd3fc">v3.2</text>
    </svg>
  );
}

/** Orientation gizmo: X/Y/Z axes rotated by roll/pitch/yaw (degrees), orthographic. */
export function OrientationGizmo({ roll, pitch, yaw, className = "" }: { roll: number; pitch: number; yaw: number; className?: string }) {
  const r = (d: number) => (d * Math.PI) / 180;
  const [cr, sr, cp, sp, cy, sy] = [Math.cos(r(roll)), Math.sin(r(roll)), Math.cos(r(pitch)), Math.sin(r(pitch)), Math.cos(r(yaw)), Math.sin(r(yaw))];
  // R = Rz(yaw) * Ry(pitch) * Rx(roll)
  const m = [
    [cy * cp, cy * sp * sr - sy * cr, cy * sp * cr + sy * sr],
    [sy * cp, sy * sp * sr + cy * cr, sy * sp * cr - cy * sr],
    [-sp, cp * sr, cp * cr],
  ];
  // View tilt so the Z axis is visible.
  const view = (v: number[]) => {
    const x = v[0];
    const y = v[1] * 0.85 - v[2] * 0.5;
    return { x: 50 + x * 34, y: 50 - y * 34 };
  };
  const axes = [
    { n: "X", c: "#22d3ee", v: [m[0][0], m[1][0], m[2][0]] },
    { n: "Y", c: "#f472b6", v: [m[0][1], m[1][1], m[2][1]] },
    { n: "Z", c: "#a3e635", v: [m[0][2], m[1][2], m[2][2]] },
  ];
  return (
    <svg viewBox="0 0 100 100" className={className} role="img" aria-label={`Sensor orientation roll ${roll.toFixed(0)}, pitch ${pitch.toFixed(0)}, yaw ${yaw.toFixed(0)} degrees`}>
      <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(148,163,184,0.25)" />
      {axes.map((a) => {
        const e = view(a.v);
        return (
          <g key={a.n}>
            <line x1="50" y1="50" x2={e.x} y2={e.y} stroke={a.c} strokeWidth="2.5" strokeLinecap="round" />
            <text x={e.x + (e.x >= 50 ? 4 : -9)} y={e.y + 3} fontSize="9" fontWeight="700" fill={a.c}>{a.n}</text>
          </g>
        );
      })}
      <circle cx="50" cy="50" r="2.5" fill="#fff" />
    </svg>
  );
}

/** Front view of the knee with data-driven cartilage pressure (MPa), same colour scale as the footprints. */
export function JointLoadKnee({ medial, lateral, patellofemoral, className = "" }: { medial: number; lateral: number; patellofemoral: number; className?: string }) {
  const uid = useId().replace(/:/g, "");
  const col = (mpa: number) => pressureColor((mpa / 4) * 250);
  const blobs = [
    { id: "m", x: 40, y: 92, r: 22, v: medial },
    { id: "l", x: 84, y: 92, r: 20, v: lateral },
    { id: "p", x: 62, y: 56, r: 17, v: patellofemoral },
  ];
  return (
    <svg viewBox="0 0 124 190" className={className} role="img" aria-label={`Knee cartilage pressure: medial ${medial}, lateral ${lateral}, patellofemoral ${patellofemoral} megapascals`}>
      <defs>
        <linearGradient id={`${uid}-bone`} x1="0" x2="1">
          <stop offset="0" stopColor="#7f9cc4" /><stop offset="0.5" stopColor="#dbeafe" /><stop offset="1" stopColor="#7f9cc4" />
        </linearGradient>
        {blobs.map((b) => (
          <radialGradient key={b.id} id={`${uid}-${b.id}`}>
            <stop offset="0" stopColor={col(b.v)} /><stop offset="0.6" stopColor={col(b.v)} stopOpacity="0.7" /><stop offset="1" stopColor={col(b.v)} stopOpacity="0" />
          </radialGradient>
        ))}
        <filter id={`${uid}-bl`}><feGaussianBlur stdDeviation="2" /></filter>
      </defs>
      {/* femur */}
      <path d="M 44 4 L 80 4 C 82 30 84 50 96 70 C 106 92 100 110 86 112 L 62 106 L 38 112 C 22 110 18 92 28 70 C 40 50 42 30 44 4 Z" fill={`url(#${uid}-bone)`} stroke="#e0f2fe" />
      {/* tibia + fibula */}
      <path d="M 26 118 C 40 112 84 112 98 118 L 96 134 C 88 150 82 170 80 188 L 44 188 C 42 170 36 150 28 134 Z" fill={`url(#${uid}-bone)`} stroke="#e0f2fe" />
      <rect x="100" y="126" width="12" height="62" rx="6" fill={`url(#${uid}-bone)`} opacity="0.85" />
      {/* patella */}
      <ellipse cx="62" cy="58" rx="15" ry="20" fill="#c7d9f0" fillOpacity="0.5" stroke="#e0f2fe" />
      {/* menisci */}
      <path d="M 28 114 C 34 106 52 106 58 114 C 50 122 36 122 28 114 Z" fill="#22d3ee" fillOpacity="0.35" />
      <path d="M 68 114 C 74 106 92 106 98 114 C 90 122 76 122 68 114 Z" fill="#22d3ee" fillOpacity="0.35" />
      <g filter={`url(#${uid}-bl)`}>
        {blobs.map((b) => <circle key={b.id} cx={b.x} cy={b.y} r={b.r} fill={`url(#${uid}-${b.id})`} />)}
      </g>
    </svg>
  );
}
