import { useId } from "react";
import { PRESSURE_MAX_KPA, PRESSURE_STOPS, pressureColor } from "@/lib/demo";
import { FOOT_SVG, blobRadius, footLocalToSvg, type PressureFrame, type ZoneKey, validateSample, zoneOfSensor } from "@/lib/pressure";

// Left-foot sole outline (toes up, medial side on the right). The right foot mirrors it.
/** Left-foot silhouette (toes included) traced from the supplied bare-foot sole outline (public/images/Barefoot_for Loadand presure.png),
 *  fitted to the same heel-centre origin and scale as the sensor layout in lib/pressure/layout.ts. */
const FOOT_PATH =
  "M 85.6 32.3 L 83.6 32.4 L 81.8 32.8 L 80.3 33.3 L 79.1 33.9 L 78.0 34.8 L 77.2 35.7 L 76.4 36.8 L 75.8 38.1 L 75.3 39.4 L 74.9 41.1 L 74.6 43.2 L 74.5 45.7 L 74.5 48.6 L 74.8 51.6 L 75.4 54.7 L 76.3 57.9 L 77.5 61.3 L 78.3 64.0 L 78.9 66.0 L 79.2 67.3 L 79.2 68.0 L 79.1 68.7 L 78.8 69.5 L 78.5 70.3 L 78.0 71.1 L 77.5 71.8 L 77.0 72.3 L 76.4 72.6 L 75.9 72.8 L 75.4 72.7 L 74.7 72.5 L 73.9 72.0 L 73.1 71.4 L 72.4 69.2 L 71.9 65.6 L 71.6 60.5 L 71.4 54.0 L 71.2 48.9 L 71.1 45.4 L 70.9 43.4 L 70.7 42.8 L 70.4 42.3 L 69.9 41.6 L 69.2 40.8 L 68.4 40.0 L 67.4 39.4 L 66.2 38.9 L 64.8 38.7 L 63.3 38.7 L 62.1 38.8 L 61.1 39.0 L 60.3 39.2 L 59.8 39.6 L 59.3 40.0 L 58.8 40.6 L 58.3 41.3 L 57.8 42.2 L 57.4 43.1 L 57.1 44.1 L 57.0 45.2 L 57.0 46.4 L 57.1 47.6 L 57.4 48.9 L 57.8 50.2 L 58.3 51.5 L 58.7 53.1 L 59.0 54.8 L 59.3 56.8 L 59.5 59.0 L 59.6 60.7 L 59.8 61.9 L 60.0 62.5 L 60.1 62.7 L 60.2 63.2 L 60.2 64.2 L 60.1 65.5 L 60.0 67.2 L 59.8 68.5 L 59.5 69.5 L 59.2 70.2 L 58.9 70.5 L 58.5 70.6 L 58.1 70.4 L 57.6 70.0 L 57.1 69.3 L 56.7 68.1 L 56.5 66.2 L 56.3 63.8 L 56.3 60.8 L 56.3 58.2 L 56.1 56.0 L 55.8 54.2 L 55.5 52.9 L 55.1 51.6 L 54.6 50.5 L 54.0 49.6 L 53.3 48.7 L 52.6 48.1 L 51.8 47.6 L 51.0 47.2 L 50.2 47.1 L 49.3 47.1 L 48.3 47.3 L 47.2 47.8 L 46.0 48.5 L 45.0 49.2 L 44.3 50.1 L 43.7 51.0 L 43.4 52.0 L 43.2 53.4 L 43.2 55.0 L 43.4 57.1 L 43.7 59.4 L 44.2 61.6 L 44.7 63.7 L 45.2 65.7 L 45.9 67.6 L 46.4 69.3 L 46.8 70.9 L 46.9 72.4 L 46.9 73.7 L 46.8 74.9 L 46.5 75.8 L 46.2 76.5 L 45.7 77.0 L 45.2 77.2 L 44.7 77.2 L 44.2 77.0 L 43.6 76.5 L 43.3 75.4 L 43.0 73.6 L 42.9 71.2 L 42.9 68.2 L 42.7 65.7 L 42.4 63.7 L 41.9 62.4 L 41.2 61.5 L 40.4 60.8 L 39.4 60.3 L 38.2 60.0 L 36.8 59.8 L 35.7 59.9 L 34.6 60.1 L 33.8 60.6 L 33.1 61.3 L 32.6 61.9 L 32.2 62.5 L 31.9 63.0 L 31.7 63.5 L 31.6 64.5 L 31.5 65.8 L 31.5 67.6 L 31.5 69.8 L 31.6 71.9 L 32.0 74.0 L 32.5 76.1 L 33.1 78.1 L 33.6 79.9 L 34.0 81.6 L 34.1 83.1 L 34.1 84.5 L 34.0 85.6 L 33.8 86.5 L 33.4 87.3 L 32.9 87.8 L 32.4 88.1 L 32.0 88.1 L 31.6 88.0 L 31.3 87.7 L 31.0 86.8 L 30.9 85.4 L 30.8 83.4 L 30.8 80.9 L 30.7 78.8 L 30.5 77.2 L 30.3 76.1 L 29.9 75.4 L 29.5 74.8 L 29.0 74.2 L 28.4 73.6 L 27.8 73.1 L 27.1 72.7 L 26.5 72.5 L 26.0 72.4 L 25.5 72.4 L 24.9 72.5 L 24.3 72.7 L 23.7 73.1 L 23.0 73.6 L 22.4 74.4 L 21.8 75.4 L 21.3 76.7 L 20.8 78.2 L 20.4 79.7 L 20.1 81.3 L 20.0 83.0 L 20.0 84.6 L 20.1 86.2 L 20.3 87.5 L 20.5 88.7 L 20.9 89.7 L 21.1 91.1 L 21.3 92.8 L 21.4 95.0 L 21.4 97.5 L 21.2 99.9 L 21.0 102.2 L 20.6 104.3 L 20.1 106.3 L 19.7 108.3 L 19.5 110.3 L 19.3 112.2 L 19.3 114.0 L 19.6 116.2 L 20.0 118.8 L 20.6 121.8 L 21.4 125.2 L 22.1 128.1 L 22.6 130.5 L 23.0 132.5 L 23.1 134.0 L 23.3 135.4 L 23.6 136.5 L 23.9 137.6 L 24.2 138.4 L 24.7 140.5 L 25.4 143.9 L 26.2 148.5 L 27.2 154.4 L 28.4 160.0 L 29.6 165.4 L 31.0 170.5 L 32.5 175.4 L 33.9 181.5 L 35.2 188.7 L 36.3 197.1 L 37.3 206.7 L 38.2 214.0 L 38.9 219.2 L 39.4 222.1 L 39.7 222.8 L 40.0 223.5 L 40.2 224.5 L 40.5 225.5 L 40.6 226.7 L 41.0 228.0 L 41.5 229.3 L 42.1 230.7 L 43.0 232.3 L 43.6 233.5 L 44.0 234.4 L 44.2 235.0 L 44.2 235.4 L 44.5 236.0 L 45.1 237.0 L 46.0 238.4 L 47.2 240.1 L 48.6 241.7 L 50.2 243.3 L 52.0 244.9 L 54.0 246.4 L 55.8 247.6 L 57.4 248.5 L 58.8 249.2 L 60.0 249.5 L 61.4 249.7 L 63.2 249.9 L 65.3 250.0 L 67.6 250.0 L 69.9 249.7 L 72.2 249.2 L 74.4 248.5 L 76.6 247.5 L 78.6 246.4 L 80.2 245.3 L 81.7 244.2 L 82.8 243.0 L 83.9 241.9 L 84.8 240.8 L 85.6 239.7 L 86.3 238.7 L 87.0 237.6 L 87.6 236.2 L 88.3 234.7 L 89.0 233.0 L 89.6 231.3 L 90.1 229.6 L 90.5 228.0 L 90.8 226.3 L 91.1 224.1 L 91.3 221.5 L 91.3 218.5 L 91.3 214.9 L 91.3 212.2 L 91.2 210.4 L 91.1 209.4 L 90.9 209.2 L 90.8 208.8 L 90.7 208.1 L 90.7 207.2 L 90.7 206.0 L 90.5 204.6 L 90.3 203.0 L 89.9 201.2 L 89.4 199.2 L 89.0 197.1 L 88.6 194.9 L 88.4 192.6 L 88.2 190.3 L 88.0 187.9 L 87.6 185.6 L 87.2 183.2 L 86.7 180.9 L 86.3 177.9 L 86.1 174.3 L 86.0 170.0 L 86.0 165.1 L 86.0 161.4 L 86.1 158.9 L 86.2 157.6 L 86.4 157.4 L 86.5 157.0 L 86.6 156.4 L 86.6 155.6 L 86.6 154.6 L 86.8 153.0 L 87.1 150.8 L 87.6 148.1 L 88.3 144.7 L 89.1 141.2 L 90.2 137.6 L 91.3 133.9 L 92.7 130.0 L 93.8 126.9 L 94.7 124.5 L 95.5 122.9 L 96.0 122.1 L 96.5 120.7 L 97.2 118.9 L 98.0 116.5 L 98.8 113.7 L 99.5 111.3 L 99.9 109.5 L 100.1 108.1 L 100.1 107.3 L 100.2 106.3 L 100.3 105.3 L 100.6 104.2 L 100.9 103.1 L 101.2 101.6 L 101.3 99.8 L 101.4 97.8 L 101.4 95.4 L 101.2 92.6 L 100.8 89.4 L 100.2 85.8 L 99.3 81.8 L 98.7 78.3 L 98.3 75.4 L 98.1 73.0 L 98.1 71.1 L 98.2 69.3 L 98.4 67.5 L 98.8 65.8 L 99.3 64.1 L 99.7 62.0 L 99.8 59.4 L 99.8 56.3 L 99.7 52.8 L 99.4 49.7 L 98.9 47.0 L 98.4 44.7 L 97.7 42.8 L 97.1 41.2 L 96.4 39.7 L 95.7 38.3 L 95.0 37.1 L 94.2 36.0 L 93.2 35.0 L 92.0 34.1 L 90.7 33.3 L 89.1 32.7 L 87.5 32.3 Z";

/** One sensor as drawn. kpa === null means the sensor is missing (Unavailable); 0 is a measured value. */
export type SensorView = { id: string; zone: ZoneKey; xMm: number; yMm: number; areaCm2: number; kpa: number | null };
export type Trace = { points: { x: number; y: number }[]; current: { x: number; y: number } | null };

/** Sensors of one foot from a frame. Invalid samples are shown as missing, never as 0. */
export function sensorViews(frame: PressureFrame, side: "left" | "right"): SensorView[] {
  return frame.samples
    .filter((s) => s.side === side)
    .map((s) => ({
      id: s.sensorId,
      zone: zoneOfSensor(s.sensorId),
      xMm: s.positionMm.x,
      yMm: s.positionMm.y,
      areaCm2: s.areaCm2,
      kpa: s.status === "ok" && validateSample(s) === null ? (s.pressureKpa as number) : null,
    }));
}

/** Per-sensor maximum over frames (the session peak map). A sensor that never measured stays missing. */
export function peakSensorViews(frames: PressureFrame[], side: "left" | "right"): SensorView[] {
  const out = new Map<string, SensorView>();
  for (const f of frames) {
    for (const v of sensorViews(f, side)) {
      const prev = out.get(v.id);
      if (!prev) out.set(v.id, { ...v });
      else if (v.kpa !== null && (prev.kpa === null || v.kpa > prev.kpa)) prev.kpa = v.kpa;
    }
  }
  return [...out.values()];
}

type FootProps = {
  sensors: SensorView[] | null;
  mirror: boolean;
  uid: string;
  label: string;
  mode: "heat" | "outline";
  markers: boolean;
  trace?: Trace;
};

function Foot({ sensors, mirror, uid, label, mode, markers, trace }: FootProps) {
  const side = mirror ? "r" : "l";
  const W = FOOT_SVG.w;
  const mx = (x: number) => (mirror ? W - x : x);
  const map = (xMm: number, yMm: number) => {
    const p = footLocalToSvg(xMm, yMm);
    return { x: mx(p.x), y: p.y };
  };
  const list = sensors ?? [];
  const measured = list.filter((s) => s.kpa !== null);
  const allMissing = list.length === 0 || measured.length === 0;
  const blobs = [...measured].sort((a, b) => (a.kpa as number) - (b.kpa as number));
  const missing = list.filter((s) => s.kpa === null);
  const peak = measured.length ? Math.max(...measured.map((s) => s.kpa as number)) : null;
  const heat = mode === "heat";

  return (
    <svg viewBox={`0 0 ${W} ${FOOT_SVG.h}`} className="h-full w-full" role="img"
      aria-label={allMissing ? `${label} foot: Unavailable` : heat ? `${label} foot pressure, peak ${peak} kilopascals` : `${label} foot outline`}>
      <defs>
        {/* clipPath may only contain shapes, so the mirror transform goes on the clipPath itself */}
        <clipPath id={`${uid}-clip-${side}`} transform={mirror ? `translate(${W} 0) scale(-1 1)` : undefined}>
          <path d={FOOT_PATH} />
        </clipPath>
        <pattern id={`${uid}-hatch`} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="5" height="5" fill="#334155" fillOpacity="0.55" />
          <line x1="0" y1="0" x2="0" y2="5" stroke="#94a3b8" strokeWidth="1.6" strokeOpacity="0.8" />
        </pattern>
        {blobs.map((b) => (
          <radialGradient key={b.id} id={`${uid}-${b.id}`}>
            <stop offset="0" stopColor={pressureColor(b.kpa as number)} stopOpacity="1" />
            <stop offset="0.55" stopColor={pressureColor(b.kpa as number)} stopOpacity="0.75" />
            <stop offset="1" stopColor={pressureColor(b.kpa as number)} stopOpacity="0" />
          </radialGradient>
        ))}
        <filter id={`${uid}-blur`}><feGaussianBlur stdDeviation="2.5" /></filter>
      </defs>

      {/* body: sole fill (heat) clipped to the silhouette */}
      <g clipPath={`url(#${uid}-clip-${side})`}>
        {heat && (
          <>
            <rect x="0" y="0" width={W} height={FOOT_SVG.h} fill={allMissing ? `url(#${uid}-hatch)` : pressureColor(0)} fillOpacity={allMissing ? 1 : 0.55} />
            <g filter={`url(#${uid}-blur)`}>
              {blobs.map((b) => {
                const p = map(b.xMm, b.yMm);
                return <circle key={b.id} cx={p.x} cy={p.y} r={blobRadius(b.areaCm2)} fill={`url(#${uid}-${b.id})`} />;
              })}
            </g>
            {/* missing sensors are hatched, clearly different from a blue measured zero */}
            {!allMissing && missing.map((m) => {
              const p = map(m.xMm, m.yMm);
              return <circle key={m.id} cx={p.x} cy={p.y} r={blobRadius(m.areaCm2) * 0.95} fill={`url(#${uid}-hatch)`} />;
            })}
          </>
        )}
        {!heat && <rect x="0" y="0" width={W} height={FOOT_SVG.h} fill="#0b2a52" fillOpacity="0.5" />}
      </g>
      <g transform={mirror ? `translate(${W} 0) scale(-1 1)` : undefined} fill="none" stroke="#67e8f9" strokeOpacity="0.8" strokeWidth="1.2">
        <path d={FOOT_PATH} />
      </g>

      {/* sensor markers: filled dot = measured > 0, ring with "0" = measured zero, dashed ring with x = missing */}
      {markers && list.map((s) => {
        const p = map(s.xMm, s.yMm);
        if (s.kpa === null) {
          return (
            <g key={s.id}>
              <circle cx={p.x} cy={p.y} r="5.2" fill="#0f172a" fillOpacity="0.7" stroke="#cbd5e1" strokeWidth="1" strokeDasharray="2 1.6" />
              <path d={`M ${p.x - 2.4} ${p.y - 2.4} L ${p.x + 2.4} ${p.y + 2.4} M ${p.x + 2.4} ${p.y - 2.4} L ${p.x - 2.4} ${p.y + 2.4}`} stroke="#fde68a" strokeWidth="1.3" />
            </g>
          );
        }
        if (s.kpa === 0) {
          return (
            <g key={s.id}>
              <circle cx={p.x} cy={p.y} r="5.2" fill="#0b1d4a" stroke="#93c5fd" strokeWidth="1.2" />
              <text x={p.x} y={p.y + 2.4} textAnchor="middle" fontSize="6.5" fontWeight="700" fill="#bfdbfe">0</text>
            </g>
          );
        }
        return <circle key={s.id} cx={p.x} cy={p.y} r="2.4" fill="#fff" fillOpacity="0.92" stroke="#041224" strokeWidth="0.8" />;
      })}

      {/* CoP trace in the same foot-local mapping */}
      {trace && trace.points.length > 1 && (
        <>
          <polyline points={trace.points.map((q) => { const p = map(q.x, q.y); return `${p.x},${p.y}`; }).join(" ")}
            fill="none" stroke="#fde047" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" opacity="0.95" />
          {(() => { const p = map(trace.points[0].x, trace.points[0].y); return <circle cx={p.x} cy={p.y} r="3.6" fill="#34d399" stroke="#041224" strokeWidth="1" />; })()}
        </>
      )}
      {trace?.current && (() => {
        const p = map(trace.current.x, trace.current.y);
        return <g><circle cx={p.x} cy={p.y} r="6.5" fill="none" stroke="#22d3ee" strokeWidth="2.2" /><circle cx={p.x} cy={p.y} r="2.6" fill="#22d3ee" /></g>;
      })()}

      {allMissing && <text x={W / 2} y="140" textAnchor="middle" fontSize="13" fontWeight="600" fill="#fde68a">Unavailable</text>}
    </svg>
  );
}

/** Colour legend that uses the same stops as the heatmap colours. Fixed 0-250 kPa, so colours never rescale. */
export function PressureLegend({ className = "" }: { className?: string }) {
  const uid = useId().replace(/:/g, "");
  const ticks = [250, 200, 150, 100, 50, 0];
  return (
    <svg viewBox="0 0 52 190" className={className} role="img" aria-label="Pressure legend, 0 to 250 kilopascals, blue to red, fixed scale">
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
          <text x="19" y={181 - (t / PRESSURE_MAX_KPA) * 170} fontSize="9" fill="#cbd5e1">{t === 250 ? "≥250" : t}</text>
        </g>
      ))}
      <text x="2" y="5" fontSize="8" fill="#94a3b8">kPa</text>
    </svg>
  );
}

type Props = {
  left: SensorView[] | null;
  right: SensorView[] | null;
  mode?: "heat" | "outline";
  markers?: boolean;
  traces?: { left?: Trace; right?: Trace };
  className?: string;
};

export default function Footprints({ left, right, mode = "heat", markers = false, traces, className = "" }: Props) {
  const uid = useId().replace(/:/g, "");
  return (
    <div className={`flex items-stretch justify-center gap-2 ${className}`}>
      <div className="h-full w-[46%] max-w-[170px]"><Foot sensors={left} mirror={false} uid={`${uid}a`} label="Left" mode={mode} markers={markers} trace={traces?.left} /></div>
      <div className="h-full w-[46%] max-w-[170px]"><Foot sensors={right} mirror uid={`${uid}b`} label="Right" mode={mode} markers={markers} trace={traces?.right} /></div>
    </div>
  );
}
