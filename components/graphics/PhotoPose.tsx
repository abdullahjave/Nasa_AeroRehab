"use client";

import { useState } from "react";
import type { ReactNode } from "react";

/**
 * Supplied pose artwork with a fallback. If the file fails to load, `fallback` (the drawn figure) is shown instead.
 * The picture is static: it never claims to follow the scrubber, so it is only used for the phase it actually depicts.
 */
export default function PhotoPose({ src, alt, className = "", fallback, blend = true, figure }: { src: string; alt: string; className?: string; fallback: ReactNode; blend?: boolean; figure?: { w: number; h: number; box: [number, number, number, number] } }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <>{fallback}</>;
  if (figure) {
    // Size-normalised: scale so the figure's own bounding box fills 90% of the box height, centred in both directions.
    const [l, t, r, b] = figure.box;
    const bh = b - t;
    const imgH = (figure.h / bh) * 90;
    return (
      <div className={`relative overflow-hidden ${className}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} draggable={false} onError={() => setFailed(true)} className="absolute max-w-none"
          style={{ height: `${imgH}%`, top: `${5 - (t / bh) * 90}%`, left: "50%", transform: `translateX(-${((l + r) / 2 / figure.w) * 100}%)`, ...(blend ? { mixBlendMode: "screen" as const } : null) }} />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={`object-contain ${className}`} style={{ ...(blend ? { mixBlendMode: "screen" as const } : null) }} draggable={false}
      onError={() => setFailed(true)} ref={(el) => { if (el && el.complete && el.naturalWidth === 0) queueMicrotask(() => setFailed(true)); }} />
  );
}
