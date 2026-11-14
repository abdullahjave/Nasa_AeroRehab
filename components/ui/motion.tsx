"use client";

import { useEffect, useRef, useState } from "react";
import { useSystemReducedMotion } from "@/components/SpaceBackdrop";
import { useDisplayPrefs } from "@/components/settings/stores";

/** true when motion should be skipped: the system setting or the Display Settings switch. */
export function useReducedMotion() {
  const system = useSystemReducedMotion();
  const prefs = useDisplayPrefs();
  return system || prefs.reduceMotion;
}

/** Recharts props for a one-time draw-in on mount. Off with reduced motion. */
export function useChartAnim(duration = 900) {
  const reduced = useReducedMotion();
  return { isAnimationActive: !reduced, animationDuration: duration, animationEasing: "ease-out" as const };
}

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * A number that counts from its previous value to the new one. Screen readers and the first server render get the final
 * value straight away; only the visible digits animate.
 */
export function AnimatedNumber({ value, digits = 0, duration = 700, className, signed = false }: { value: number; digits?: number; duration?: number; className?: string; signed?: boolean }) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(value);
  const from = useRef<number | null>(null);
  const shownRef = useRef(value);

  useEffect(() => {
    if (reduced) { shownRef.current = value; from.current = value; return; }
    // First mount counts up from zero; later changes count from what is on screen.
    const start = from.current === null ? 0 : shownRef.current;
    from.current = value;
    if (start === value) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / duration);
      const v = start + (value - start) * easeOut(t);
      shownRef.current = v;
      setShown(v);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration, reduced]);

  const now = reduced ? value : shown;
  const abs = Math.abs(now).toFixed(digits);
  const sign = signed ? (value > 0 ? "+" : value < 0 ? "−" : "") : now < 0 && Number(abs) !== 0 ? "−" : "";
  return (
    <span className={`tabular-nums ${className ?? ""}`}>
      <span aria-hidden="true">{sign}{abs}</span>
      <span className="sr-only">{value.toFixed(digits)}</span>
    </span>
  );
}

/** Same as useChartAnim for places where a hook is awkward: reads the attribute SpaceBackdrop keeps on <html>. */
export function chartAnim(duration = 900) {
  const reduced = typeof document !== "undefined" && document.documentElement.dataset.reduceMotion === "true";
  return { isAnimationActive: !reduced, animationDuration: duration, animationEasing: "ease-out" as const };
}
