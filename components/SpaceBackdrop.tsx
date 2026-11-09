"use client";

import { useState, useSyncExternalStore } from "react";

// Video is only used on wide screens when the user has not asked for reduced motion.
const QUERY = "(min-width: 768px) and (prefers-reduced-motion: no-preference)";

function subscribe(cb: () => void) {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}
const getSnapshot = () => window.matchMedia(QUERY).matches;
const getServerSnapshot = () => false;

type Props = { hasPoster: boolean; hasVideo: boolean };

/**
 * Decorative fixed backdrop, mounted once in the root layout so route changes never remount it.
 * Layers: CSS starfield (always) -> poster (if file exists) -> video (if allowed and file exists) -> navy overlay.
 * The <video> element is not rendered, so no request is made, on mobile, with reduced motion,
 * or when the MP4 is missing.
 */
export default function SpaceBackdrop({ hasPoster, hasVideo }: Props) {
  const allowed = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [failed, setFailed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const showVideo = hasVideo && allowed && !failed;

  return (
    <div
      aria-hidden="true"
      className={`space-backdrop ${hasPoster ? "space-backdrop--image" : ""}`}
    >
      {showVideo && (
        <video
          className={`space-backdrop__video ${playing ? "is-playing" : ""}`}
          src="/videos/space-loop.mp4"
          poster={hasPoster ? "/images/space-backdrop.webp" : undefined}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          tabIndex={-1}
          disablePictureInPicture
          disableRemotePlayback
          onLoadedMetadata={(e) => {
            const v = e.currentTarget;
            if (v.videoWidth && v.videoHeight) v.style.setProperty("--video-ar", String(v.videoWidth / v.videoHeight));
          }}
          onPlaying={() => setPlaying(true)}
          onError={() => setFailed(true)}
          ref={(el) => {
            // Autoplay can be rejected by the browser; fall back to the static backdrop.
            el?.play().catch(() => setFailed(true));
          }}
        />
      )}
      <div className="space-backdrop__overlay" />
    </div>
  );
}
