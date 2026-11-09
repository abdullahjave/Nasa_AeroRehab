import { useId } from "react";
import { PRESSURE_MAX_KPA, PRESSURE_STOPS, ZONE_KEYS, pressureColor, peakPressure, type PressureZones, type ZoneKey } from "@/lib/demo";

// Left-foot sole outline (toes up, medial side on the right). The right foot mirrors it.
const SOLE =
  "M 40 80 C 36 100 30 125 36 150 C 40 175 36 200 44 225 C 52 250 82 250 88 226 C 92 205 84 185 82 165 C 80 145 90 130 96 108 C 100 92 96 78 84 74 C 70 70 52 70 40 80 Z";
const TOES = [
  { cx: 86, cy: 52, rx: 12, ry: 17, r: 8 },
  { cx: 66, cy: 44, rx: 7.5, ry: 12, r: 3 },
  { cx: 52, cy: 48, rx: 6.5, ry: 10.5, r: -2 },
  { cx: 41, cy: 55, rx: 6, ry: 9.5, r: -8 },
  { cx: 31, cy: 66, rx: 5.5, ry: 8.5, r: -14 },
];
const ZONE_POS: Record<ZoneKey, { x: number; y: number; r: number }> = {
  hallux: { x: 86, y: 52, r: 17 },
  toes: { x: 52, y: 50, r: 24 },
  mt1: { x: 84, y: 94, r: 19 },
  mt23: { x: 64, y: 90, r: 20 },
  mt45: { x: 44, y: 98, r: 18 },
  midfoot: { x: 52, y: 168, r: 22 },
  heel: { x: 66, y: 226, r: 28 },
};

function Foot({ zones, mirror, uid, label }: { zones: PressureZones | null; mirror: boolean; uid: string; label: string }) {
  const side = mirror ? "r" : "l";
  const available = zones !== null && ZONE_KEYS.some((k) => zones[k] !== null);
  const peak = zones ? peakPressure(zones) : null;
  const entries = zones
    ? ZONE_KEYS.flatMap((k) => (zones[k] === null ? [] : [{ k, v: zones[k] as number }])).sort((a, b) => a.v - b.v)
    : [];
  return (
    <svg viewBox="0 0 120 262" className="h-full w-full" role="img"
      aria-label={available ? `${label} foot pressure, peak ${peak} kilopascals` : `${label} foot pressure unavailable`}>
      <defs>
        <clipPath id={`${uid}-clip-${side}`}>
          <path d={SOLE} />
          {TOES.map((t, i) => <ellipse key={i} cx={t.cx} cy={t.cy} rx={t.rx} ry={t.ry} transform={`rotate(${t.r} ${t.cx} ${t.cy})`} />)}
        </clipPath>
        {entries.map((e) => (
          <radialGradient key={e.k} id={`${uid}-${side}-${e.k}`}>
            <stop offset="0" stopColor={pressureColor(e.v)} stopOpacity="1" />
            <stop offset="0.55" stopColor={pressureColor(e.v)} stopOpacity="0.75" />
            <stop offset="1" stopColor={pressureColor(e.v)} stopOpacity="0" />
          </radialGradient>
        ))}
        <filter id={`${uid}-blur`}><feGaussianBlur stdDeviation="2.5" /></filter>
      </defs>
      <g transform={mirror ? "translate(120 0) scale(-1 1)" : undefined}>
        <g clipPath={`url(#${uid}-clip-${side})`}>
          <rect x="0" y="0" width="120" height="262" fill={available ? pressureColor(0) : "#1e293b"} fillOpacity={available ? 0.55 : 0.6} />
          <g filter={`url(#${uid}-blur)`}>
            {entries.map((e) => {
              const z = ZONE_POS[e.k];
              return <circle key={e.k} cx={z.x} cy={z.y} r={z.r} fill={`url(#${uid}-${side}-${e.k})`} />;
            })}
          </g>
        </g>
        <g fill="none" stroke="#67e8f9" strokeOpacity="0.8" strokeWidth="1.2">
          <path d={SOLE} />
          {TOES.map((t, i) => <ellipse key={i} cx={t.cx} cy={t.cy} rx={t.rx} ry={t.ry} transform={`rotate(${t.r} ${t.cx} ${t.cy})`} />)}
        </g>
      </g>
      {!available && <text x="60" y="140" textAnchor="middle" fontSize="13" fill="#fde68a">Unavailable</text>}
    </svg>
  );
}

/** Colour legend that uses the same stops as the heatmap colours. Vertical, red at the top. */
export function PressureLegend({ className = "" }: { className?: string }) {
  const uid = useId().replace(/:/g, "");
  const ticks = [250, 200, 150, 100, 50, 0];
  return (
    <svg viewBox="0 0 46 190" className={className} role="img" aria-label="Pressure legend, 0 to 250 kilopascals, blue to red">
      <defs>
        <linearGradient id={`${uid}-lg`} x1="0" x2="0" y1="0" y2="1">
          {[...PRESSURE_STOPS].reverse().map((s) => (
            <stop key={s.kpa} offset={1 - s.kpa / PRESSURE_MAX_KPA} stopColor={s.color} />
          ))}
        </linearGradient>
      </defs>
      <rect x="2" y="8" width="10" height="170" rx="3" fill={`url(#${uid}-lg)`} stroke="#67e8f9" strokeOpacity="0.5" />
      {ticks.map((t) => (
        <g key={t}>
          <line x1="12" x2="16" y1={178 - (t / PRESSURE_MAX_KPA) * 170} y2={178 - (t / PRESSURE_MAX_KPA) * 170} stroke="#cbd5e1" />
          <text x="19" y={181 - (t / PRESSURE_MAX_KPA) * 170} fontSize="9" fill="#cbd5e1">{t}</text>
        </g>
      ))}
      <text x="2" y="5" fontSize="8" fill="#94a3b8">kPa</text>
    </svg>
  );
}

export default function Footprints({ left, right, className = "" }: { left: PressureZones | null; right: PressureZones | null; className?: string }) {
  const uid = useId().replace(/:/g, "");
  return (
    <div className={`flex items-stretch justify-center gap-2 ${className}`}>
      <div className="h-full w-[46%] max-w-[120px]"><Foot zones={left} mirror={false} uid={`${uid}a`} label="Left" /></div>
      <div className="h-full w-[46%] max-w-[120px]"><Foot zones={right} mirror uid={`${uid}b`} label="Right" /></div>
    </div>
  );
}
