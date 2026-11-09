type Props = {
  value: number | null;
  max: number;
  color: string;
  ariaLabel: string;
  size?: string;
  /** Optional text in the middle. */
  center?: string;
  centerSub?: string;
};

/** SVG progress ring. null shows Unavailable and an empty track. */
export default function GaugeRing({ value, max, color, ariaLabel, size = "h-24 w-24", center, centerSub }: Props) {
  const r = 40;
  const c = 2 * Math.PI * r;
  const pct = value === null ? 0 : Math.max(0, Math.min(1, value / max));
  return (
    <svg viewBox="0 0 100 100" className={`${size} shrink-0`} role="img" aria-label={value === null ? `${ariaLabel}: Unavailable` : ariaLabel}>
      <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(148,163,184,0.2)" strokeWidth="9" />
      {value !== null && (
        <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="9" strokeLinecap="round"
          strokeDasharray={`${c * pct} ${c}`} transform="rotate(-90 50 50)" style={{ filter: `drop-shadow(0 0 4px ${color})` }} />
      )}
      {value === null ? (
        <text x="50" y="54" textAnchor="middle" fontSize="11" fill="#fde68a">Unavailable</text>
      ) : center ? (
        <>
          <text x="50" y={centerSub ? 52 : 58} textAnchor="middle" fontSize="24" fontWeight="600" fill="#fff">{center}</text>
          {centerSub && <text x="50" y="66" textAnchor="middle" fontSize="9" fill="#cbd5e1">{centerSub}</text>}
        </>
      ) : null}
    </svg>
  );
}
