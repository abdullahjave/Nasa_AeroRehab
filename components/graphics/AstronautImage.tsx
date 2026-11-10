"use client";

import { useState } from "react";
import { AstronautArt } from "./Misc";

/**
 * Supplied astronaut portrait artwork (decorative; not tied to a crew member) (public/images/astronaut-portrait.webp, supplied artwork). Falls back to the original SVG illustration if the image fails to load.
 */
export default function AstronautImage({ className = "", label, earth = false }: { className?: string; label?: string; earth?: boolean }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <AstronautArt className={className} earth={earth} label={label} />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/images/astronaut-portrait.webp"
      alt={label ?? "Astronaut (3D render of the supplied model)"}
      className={`object-contain object-bottom ${className}`}
      draggable={false}
      onError={() => setFailed(true)}
      ref={(el) => { if (el && el.complete && el.naturalWidth === 0) queueMicrotask(() => setFailed(true)); }}
    />
  );
}
