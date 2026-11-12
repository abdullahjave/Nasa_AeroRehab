"use client";

import { useState } from "react";
import type { AstronautProfile } from "@/lib/demo";

/** The one supplied astronaut artwork, used for every crew member (including astronauts added later) unless a profile has its own. */
export const DEFAULT_PORTRAIT = "/images/astronaut-portrait.webp";

/**
 * Portrait of one crew member: the profile's own picture, else the shared supplied astronaut artwork. The alt text says it is
 * artwork, not a photo of the person. Initials are shown only if the image file cannot be loaded.
 */
export default function CrewPortrait({ profile, className = "" }: { profile: AstronautProfile; className?: string }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const src = profile.portrait ?? DEFAULT_PORTRAIT;
  if (src && src !== failedSrc) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={`${profile.displayName}: astronaut portrait (shared supplied artwork, not a photo of the person)`}
        className={`object-contain object-center ${className}`}
        draggable={false}
        onError={() => setFailedSrc(src)}
        ref={(el) => { if (el && el.complete && el.naturalWidth === 0) queueMicrotask(() => setFailedSrc(src)); }}
      />
    );
  }
  return (
    <span role="img" aria-label={`${profile.displayName}: no portrait supplied (initials shown)`} className={`flex items-center justify-center font-semibold text-cyan-200 ${className}`}>
      <span className="text-[length:inherit]">{profile.initials}</span>
    </span>
  );
}
