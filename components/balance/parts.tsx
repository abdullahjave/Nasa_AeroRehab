"use client";

import { useId, useState } from "react";
import { validSegments, type BMetric, type BalanceSample, type SwayEllipse, type TrialSide } from "@/lib/balance";

const RANGES = [3, 6, 9, 12, 15, 18, 24, 30, 45, 60];
const r3 = (n: number) => Math.round(n * 1000) / 1000;

/**
 * Postural sway path. ML on X, AP on Y, same mm-per-pixel on both axes (square plot, symmetric range).
 * The full trace is dim, the replayed part is bright; markers show start, end and the current sample.
 */
export function SwayPlot({ samples, ellipse, idx, sampleRateHz }: { samples: BalanceSample[]; ellipse: BMetric<SwayEllipse>; idx: number; sampleRateHz: number }) {
  const valid = samples.filter((s) => s.status === "ok" && s.mlMm !== null && s.apMm !== null);
  let extent = 0;
  for (const s of valid) extent = Math.max(extent, Math.abs(s.mlMm as number), Math.abs(s.apMm as number));
  if (ellipse.kind === "value") extent = Math.max(extent, Math.abs(ellipse.value.cx) + ellipse.value.a, Math.abs(ellipse.value.cy) + ellipse.value.a);
  const R = RANGES.find((r) => r >= extent * 1.05) ?? 60;
  const step = R / 3;
  const P = 250;
  const X0 = 40;
  const Y0 = 8;
  const mx = (x: number) => X0 + ((x + R) / (2 * R)) * P;
  const my = (y: number) => Y0 + ((R - y) / (2 * R)) * P;
  const k = P / (2 * R);
  const segs = validSegments(samples, 1000 / sampleRateHz);
  const playedT = samples[idx]?.timestampMs ?? 0;
  const pts = (seg: BalanceSample[]) => seg.map((s) => `${mx(s.mlMm as number).toFixed(1)},${my(s.apMm as number).toFixed(1)}`).join(" ");
  const first = valid[0];
  const last = valid[valid.length - 1];
  const cur = samples[idx];
  const curOk = cur && cur.status === "ok" && cur.mlMm !== null;
  const ticks = [-3, -2, -1, 0, 1, 2, 3].map((i) => i * step);

  return (
    <svg viewBox="0 0 300 296" className="h-auto w-full max-w-[360px]" role="img"
      aria-label={`Sway path, medio-lateral versus antero-posterior, plus or minus ${R} millimetres on both axes`}>
      <rect x={X0} y={Y0} width={P} height={P} fill="#020b1c" fillOpacity="0.5" stroke="rgba(148,163,184,0.35)" />
      {ticks.map((t) => (
        <g key={t}>
          <line x1={mx(t)} x2={mx(t)} y1={Y0} y2={Y0 + P} stroke={t === 0 ? "rgba(148,163,184,0.45)" : "rgba(148,163,184,0.16)"} strokeDasharray={t === 0 ? undefined : "3 3"} />
          <line x1={X0} x2={X0 + P} y1={my(t)} y2={my(t)} stroke={t === 0 ? "rgba(148,163,184,0.45)" : "rgba(148,163,184,0.16)"} strokeDasharray={t === 0 ? undefined : "3 3"} />
          <text x={mx(t)} y={Y0 + P + 13} textAnchor="middle" fontSize="9.5" fill="#cbd5e1">{Number(t.toFixed(1))}</text>
          <text x={X0 - 5} y={my(t) + 3} textAnchor="end" fontSize="9.5" fill="#cbd5e1">{Number(t.toFixed(1))}</text>
        </g>
      ))}
      <text x={X0 + P / 2} y={Y0 + P + 27} textAnchor="middle" fontSize="10" fill="#e2e8f0">ML (mm)</text>
      <text x="10" y={Y0 + P / 2} textAnchor="middle" fontSize="10" fill="#e2e8f0" transform={`rotate(-90 10 ${Y0 + P / 2})`}>AP (mm)</text>

      {ellipse.kind === "value" && (
        // Attribute values are rounded so server and browser floating-point output match during hydration.
        <ellipse cx={r3(mx(ellipse.value.cx))} cy={r3(my(ellipse.value.cy))} rx={r3(ellipse.value.a * k)} ry={r3(ellipse.value.b * k)}
          transform={`rotate(${r3((-ellipse.value.angleRad * 180) / Math.PI)} ${r3(mx(ellipse.value.cx))} ${r3(my(ellipse.value.cy))})`}
          fill="none" stroke="#e2e8f0" strokeOpacity="0.85" strokeWidth="1.4" strokeDasharray="5 4" />
      )}
      {segs.map((seg, i) => <polyline key={`a${i}`} points={pts(seg)} fill="none" stroke="#22d3ee" strokeOpacity="0.28" strokeWidth="1.1" strokeLinejoin="round" />)}
      {segs.map((seg, i) => {
        const played = seg.filter((s) => s.timestampMs <= playedT);
        return played.length > 1 ? <polyline key={`b${i}`} points={pts(played)} fill="none" stroke="#22d3ee" strokeWidth="1.5" strokeLinejoin="round" /> : null;
      })}
      {first && <circle cx={r3(mx(first.mlMm as number))} cy={r3(my(first.apMm as number))} r="4.5" fill="#34d399" stroke="#041224" strokeWidth="1.2" />}
      {last && <circle cx={r3(mx(last.mlMm as number))} cy={r3(my(last.apMm as number))} r="4.5" fill="#fbbf24" stroke="#041224" strokeWidth="1.2" />}
      {curOk && (
        <g>
          <circle cx={r3(mx(cur.mlMm as number))} cy={r3(my(cur.apMm as number))} r="7" fill="none" stroke="#fff" strokeWidth="2" />
          <circle cx={r3(mx(cur.mlMm as number))} cy={r3(my(cur.apMm as number))} r="2.4" fill="#fff" />
        </g>
      )}
    </svg>
  );
}

const RADAR = [
  ["staticBalance", "Static Balance"],
  ["dynamicBalance", "Dynamic Balance"],
  ["vestibular", "Vestibular Control"],
  ["proprioception", "Proprioception"],
  ["trunk", "Trunk Stability"],
  ["reactive", "Reactive Balance"],
] as const;
export type Profile = Record<(typeof RADAR)[number][0], number>;

/** Six-axis cyan radar, clockwise from the top. */
export function StabilityRadar({ profile }: { profile: Profile | null }) {
  const cx = 130;
  const cy = 128;
  const R = 70;
  const pt = (i: number, f: number) => {
    const a = ((-90 + i * 60) * Math.PI) / 180;
    return [r3(cx + R * f * Math.cos(a)), r3(cy + R * f * Math.sin(a))] as const;
  };
  const ring = (f: number) => RADAR.map((_, i) => pt(i, f).join(",")).join(" ");
  return (
    <svg viewBox="0 0 260 246" className="h-auto w-full max-w-[320px]" role="img"
      aria-label={profile ? `Stability profile demo scores: ${RADAR.map(([k, l]) => `${l} ${profile[k]}`).join(", ")}` : "Stability profile unavailable"}>
      {[0.25, 0.5, 0.75, 1].map((f) => <polygon key={f} points={ring(f)} fill="none" stroke="rgba(148,163,184,0.28)" />)}
      {RADAR.map((_, i) => <line key={i} x1={cx} y1={cy} x2={pt(i, 1)[0]} y2={pt(i, 1)[1]} stroke="rgba(148,163,184,0.25)" />)}
      {profile && (
        <>
          <polygon points={RADAR.map(([k], i) => pt(i, profile[k] / 100).join(",")).join(" ")} fill="rgba(34,211,238,0.22)" stroke="#22d3ee" strokeWidth="2" />
          {RADAR.map(([k], i) => { const [x, y] = pt(i, profile[k] / 100); return <circle key={k} cx={x} cy={y} r="3" fill="#22d3ee" />; })}
        </>
      )}
      {RADAR.map(([k, l], i) => {
        const [x, y0] = pt(i, i === 0 || i === 3 ? 1.32 : 1.22);
        const y = i === 0 ? y0 - 14 : y0;
        const words = l.split(" ");
        const anchor = i === 0 || i === 3 ? "middle" : i < 3 ? "start" : "end";
        return (
          <text key={k} x={x} y={y - (words.length > 1 ? 4 : 0) + (i === 3 ? 6 : 0)} textAnchor={anchor} fontSize="9.5" fill="#cbd5e1">
            {words.map((w, j) => <tspan key={j} x={x} dy={j ? 11 : 0}>{w}</tspan>)}
            {profile && <tspan x={x} dy="11" fill="#e2e8f0" fontWeight="600">{profile[k]}</tspan>}
          </text>
        );
      })}
      {!profile && <text x={cx} y={cy + 4} textAnchor="middle" fontSize="11" fill="#fde68a">Unavailable</text>}
    </svg>
  );
}

/** Fallback single-leg stance figure (front view). Used because public/images/astronaut-balance.webp is missing. */
export function BalancePoseFallback({ side, className = "" }: { side: TrialSide; className?: string }) {
  const uid = useId().replace(/:/g, "");
  const BODY = "rgba(56,189,248,0.3)";
  const EDGE = "#bae6fd";
  // Drawn standing on the astronaut's left leg (screen right in a front view); mirrored for the right leg.
  const mirror = side === "right";
  const limb = (x1: number, y1: number, x2: number, y2: number, w: number) => (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={BODY} strokeWidth={w} strokeLinecap="round" />
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={EDGE} strokeWidth="1.4" strokeLinecap="round" opacity="0.85" />
    </g>
  );
  return (
    <svg viewBox="0 0 220 300" className={className} role="img" aria-label={`Fallback illustration: astronaut in single-leg stance on the ${side} leg`}>
      <defs>
        <radialGradient id={`${uid}-pad`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#22d3ee" stopOpacity="0.45" />
          <stop offset="1" stopColor="#22d3ee" stopOpacity="0" />
        </radialGradient>
        <filter id={`${uid}-g`} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.5" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      </defs>
      <g transform={mirror ? "translate(220 0) scale(-1 1)" : undefined}>
        <ellipse cx="124" cy="280" rx="70" ry="12" fill={`url(#${uid}-pad)`} />
        <ellipse cx="124" cy="280" rx="46" ry="7" fill="none" stroke="#22d3ee" strokeOpacity="0.55" />
        <ellipse cx="124" cy="280" rx="64" ry="10" fill="none" stroke="#22d3ee" strokeOpacity="0.25" />
        {/* raised (free) leg */}
        {limb(98, 150, 74, 192, 16)}
        {limb(74, 192, 86, 232, 12)}
        {limb(86, 232, 74, 240, 9)}
        {/* arms out for balance */}
        {limb(84, 82, 46, 96, 11)}
        {limb(46, 96, 14, 92, 9)}
        {limb(136, 82, 174, 96, 11)}
        {limb(174, 96, 206, 92, 9)}
        {/* torso with backpack outline */}
        <rect x="82" y="72" width="56" height="84" rx="16" fill={BODY} stroke={EDGE} strokeWidth="1.4" />
        <rect x="98" y="92" width="24" height="18" rx="4" fill="none" stroke={EDGE} strokeOpacity="0.7" />
        {/* helmet */}
        <circle cx="110" cy="50" r="22" fill={BODY} stroke={EDGE} strokeWidth="1.5" />
        <ellipse cx="111" cy="52" rx="14" ry="11" fill="#0b2a52" stroke={EDGE} strokeOpacity="0.6" />
        {/* stance leg */}
        {limb(122, 152, 124, 212, 17)}
        {limb(124, 212, 124, 266, 13)}
        {limb(124, 266, 140, 272, 10)}
        {[[122, 152], [124, 212], [124, 266], [74, 192]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="4.5" fill="#e0f7ff" filter={`url(#${uid}-g)`} />)}
        <circle cx="128" cy="272" r="4" fill="#34d399" filter={`url(#${uid}-g)`} />
      </g>
    </svg>
  );
}

/** Decorative balance artwork: the WebP render when present, otherwise the fallback pose. */
export function BalanceArt({ side, hasImage, className = "" }: { side: TrialSide; hasImage: boolean; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (!hasImage || failed) return <BalancePoseFallback side={side} className={className} />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/images/astronaut-balance.webp" alt="" aria-hidden="true" className={`object-contain ${className}`}
      /* The supplied artwork stands on the astronaut's right leg; it is mirrored for a left-leg trial. */
      style={side === "left" ? { transform: "scaleX(-1)" } : undefined} onError={() => setFailed(true)}
      ref={(el) => { if (el && el.complete && el.naturalWidth === 0) queueMicrotask(() => setFailed(true)); }} />
  );
}
