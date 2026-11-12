"use client";

import { useState } from "react";
import type { AstronautProfile } from "@/lib/demo";

/**
 * Portrait of one crew member. Only an astronaut whose profile carries a supplied portrait shows an image; everyone
 * else gets an initials avatar, so one picture is never presented as several different people.
 */
export default function CrewPortrait({ profile, className = "" }: { profile: AstronautProfile; className?: string }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const src = profile.portrait;
  if (src && src !== failedSrc) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={`${profile.displayName}: astronaut portrait (supplied artwork, not a photo of the person)`}
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
