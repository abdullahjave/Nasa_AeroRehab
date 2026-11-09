"use client";

import { useState } from "react";
import { AstronautArt } from "./Misc";

/**
 * Render of the supplied astronaut model (public/images/astronaut.webp, made from public/models/astronaut.glb
 * by tools/render). Falls back to the original SVG illustration if the image fails to load.
 */
export default function AstronautImage({ className = "", label, earth = false }: { className?: string; label?: string; earth?: boolean }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <AstronautArt className={className} earth={earth} label={label} />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/images/astronaut.webp"
      alt={label ?? "Astronaut (3D render of the supplied model)"}
      className={`object-contain object-bottom ${className}`}
      draggable={false}
      onError={() => setFailed(true)}
      ref={(el) => { if (el && el.complete && el.naturalWidth === 0) queueMicrotask(() => setFailed(true)); }}
    />
  );
}
