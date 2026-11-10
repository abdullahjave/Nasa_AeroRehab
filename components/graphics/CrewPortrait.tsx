"use client";

import { useState } from "react";
import type { AstronautProfile } from "@/lib/demo";

/**
 * Portrait of one crew member. Only an astronaut whose profile carries a supplied portrait shows an image; everyone
 * else gets an initials avatar, so one picture is never presented as several different people.
 */
export default function CrewPortrait({ profile, className = "", zoom = false, fill = false }: { profile: AstronautProfile; className?: string; zoom?: boolean; fill?: boolean }) {
  const [failed, setFailed] = useState(false);
  if (profile.portrait && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={profile.portrait}
        alt={`${profile.displayName}: astronaut portrait (supplied artwork, not a photo of the person)`}
        className={`object-contain object-bottom ${zoom ? "origin-top scale-[2.2] object-top" : ""} ${fill ? "origin-bottom scale-[1.9]" : ""} ${className}`}
        draggable={false}
        onError={() => setFailed(true)}
        ref={(el) => { if (el && el.complete && el.naturalWidth === 0) queueMicrotask(() => setFailed(true)); }}
      />
    );
  }
  return (
    <span role="img" aria-label={`${profile.displayName}: no portrait supplied (initials shown)`} className={`flex items-center justify-center font-semibold text-cyan-200 ${className}`}>
      <span className="text-[length:inherit]">{profile.initials}</span>
    </span>
  );
}
