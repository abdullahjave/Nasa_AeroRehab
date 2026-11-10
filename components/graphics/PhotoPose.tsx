"use client";

import { useState } from "react";
import type { ReactNode } from "react";

/**
 * Supplied pose artwork with a fallback. If the file fails to load, `fallback` (the drawn figure) is shown instead.
 * The picture is static: it never claims to follow the scrubber, so it is only used for the phase it actually depicts.
 */
export default function PhotoPose({ src, alt, className = "", fallback, blend = true }: { src: string; alt: string; className?: string; fallback: ReactNode; blend?: boolean }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <>{fallback}</>;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={`object-contain ${className}`} style={blend ? { mixBlendMode: "screen" } : undefined} draggable={false}
      onError={() => setFailed(true)} ref={(el) => { if (el && el.complete && el.naturalWidth === 0) queueMicrotask(() => setFailed(true)); }} />
  );
}
