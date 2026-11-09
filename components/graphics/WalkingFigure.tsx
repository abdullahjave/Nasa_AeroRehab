import { useId } from "react";
import { bodyPoseAt, NO_SCALE, type CurveScale, type LegPose, type Pt } from "@/lib/demo";

// Original full-body side-view walking figure, posed from the gait-cycle model (cycle percent p).
// Static poses only; facing right.

type Props = {
  /** Gait cycle percent, 0-100. */
  p: number;
  scale?: CurveScale;
  className?: string;
  /** Show joint glows and ground contact highlight. */
  glow?: boolean;
  ariaLabel?: string;
};

const BODY = "rgba(56,189,248,0.32)";
const EDGE = "#bae6fd";

function Limb({ a, b, w, dim }: { a: Pt; b: Pt; w: number; dim?: boolean }) {
  const o = dim ? 0.55 : 1;
  return (
    <g opacity={o}>
      <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={BODY} strokeWidth={w} strokeLinecap="round" />
      <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={EDGE} strokeWidth="1.6" strokeLinecap="round" opacity="0.9" />
    </g>
  );
}

function Leg({ leg, dim }: { leg: LegPose; dim?: boolean }) {
  return (
    <g>
      <Limb a={leg.hip} b={leg.knee} w={17} dim={dim} />
      <Limb a={leg.knee} b={leg.ankle} w={12} dim={dim} />
      <g opacity={dim ? 0.55 : 1}>
        <polygon points={`${leg.heel.x},${leg.heel.y} ${leg.ankle.x},${leg.ankle.y} ${leg.toe.x},${leg.toe.y}`} fill={BODY} stroke={EDGE} strokeWidth="1.6" strokeLinejoin="round" />
      </g>
    </g>
  );
}

export default function WalkingFigure({ p, scale = NO_SCALE, className = "", glow = true, ariaLabel }: Props) {
  const uid = useId().replace(/:/g, "");
  const pose = bodyPoseAt(p, scale);
  const joints = [pose.near.hip, pose.near.knee, pose.near.ankle, pose.shoulder, pose.armNear.elbow];
  const contact = [pose.near, pose.far].flatMap((l) => [l.heel, l.toe]).filter((pt) => pt.y > pose.ground - 14);
  return (
    <svg viewBox="20 36 160 358" className={className} role="img" aria-label={ariaLabel ?? `Walking figure at ${Math.round(p)} percent of the gait cycle`}>
      <defs>
        <filter id={`${uid}-g`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <radialGradient id={`${uid}-floor`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#22d3ee" stopOpacity="0.55" />
          <stop offset="1" stopColor="#22d3ee" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* ground */}
      <ellipse cx="100" cy={pose.ground} rx="86" ry="9" fill={`url(#${uid}-floor)`} />
      {glow && contact.map((c, i) => <ellipse key={i} cx={c.x} cy={pose.ground} rx="18" ry="5" fill="#22d3ee" opacity="0.55" filter={`url(#${uid}-g)`} />)}

      <g>
        {/* far side */}
        <Limb a={pose.shoulder} b={pose.armFar.elbow} w={9} dim />
        <Limb a={pose.armFar.elbow} b={pose.armFar.hand} w={8} dim />
        <Leg leg={pose.far} dim />
        {/* torso and head */}
        <line x1={pose.pelvis.x} y1={pose.pelvis.y} x2={pose.neck.x} y2={pose.neck.y + 6} stroke={BODY} strokeWidth="32" strokeLinecap="round" />
        <line x1={pose.pelvis.x} y1={pose.pelvis.y} x2={pose.neck.x} y2={pose.neck.y + 6} stroke={EDGE} strokeWidth="1.6" strokeLinecap="round" opacity="0.5" />
        <rect x={pose.neck.x - 5} y={pose.neck.y - 8} width="10" height="14" rx="4" fill={BODY} />
        <circle cx={pose.head.x} cy={pose.head.y} r="15" fill={BODY} stroke={EDGE} strokeWidth="1.6" />
        {/* near side */}
        <Leg leg={pose.near} />
        <Limb a={pose.shoulder} b={pose.armNear.elbow} w={10} />
        <Limb a={pose.armNear.elbow} b={pose.armNear.hand} w={9} />
      </g>

      {glow && joints.map((j, i) => (
        <circle key={i} cx={j.x} cy={j.y} r="5.5" fill="#e0f7ff" filter={`url(#${uid}-g)`} />
      ))}
    </svg>
  );
}
