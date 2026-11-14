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

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * A number that eases to a new value when it changes. It does not count up on first paint, so a page never loads with
 * moving digits; screen readers always get the final value.
 */
export function AnimatedNumber({ value, digits = 0, duration = 320, className, signed = false }: { value: number; digits?: number; duration?: number; className?: string; signed?: boolean }) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(value);
  const shownRef = useRef(value);

  useEffect(() => {
    const start = shownRef.current;
    if (reduced || start === value) { shownRef.current = value; return; }
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / duration);
      const v = t === 1 ? value : start + (value - start) * easeOut(t);
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

