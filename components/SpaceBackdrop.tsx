"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useDisplayPrefs } from "@/components/settings/stores";
import { backdropMode } from "@/lib/settings/display";

function mediaStore(query: string) {
  return {
    subscribe(cb: () => void) {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    get: () => window.matchMedia(query).matches,
  };
}
const WIDE = mediaStore("(min-width: 768px)");
const REDUCED = mediaStore("(prefers-reduced-motion: reduce)");
const no = () => false;

/** true on screens wide enough for the video backdrop. */
export function useWideScreen() {
  return useSyncExternalStore(WIDE.subscribe, WIDE.get, no);
}

/** System "reduce motion" setting (read-only). */
export function useSystemReducedMotion() {
  return useSyncExternalStore(REDUCED.subscribe, REDUCED.get, no);
}

type Props = { hasPoster: boolean; videoSrc: string | null };

/**
 * Decorative fixed backdrop, mounted once in the root layout so route changes never remount it (the video keeps
 * playing). Layers: CSS starfield (always) -> poster (if file exists) -> video -> navy overlay.
 * The <video> is not rendered, so no request is made, on narrow screens, with reduced motion (system setting or the
 * Display Settings switch), when the background-video switch is off, or when no clip exists.
 */
export default function SpaceBackdrop({ hasPoster, videoSrc }: Props) {
  const wide = useWideScreen();
  const systemReduced = useSystemReducedMotion();
  const prefs = useDisplayPrefs();
  const [failed, setFailed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const reducedMotion = systemReduced || prefs.reduceMotion;
  const mode = backdropMode({ hasVideo: !!videoSrc, hasPoster, prefVideo: prefs.backgroundVideo, reducedMotion, wide, failed });

  // One attribute on <html> lets CSS switch off animation and transitions everywhere when motion is reduced.
  useEffect(() => {
    document.documentElement.dataset.reduceMotion = reducedMotion ? "true" : "false";
    document.documentElement.dataset.backdrop = mode;
  }, [reducedMotion, mode]);

  return (
    <div aria-hidden="true" className={`space-backdrop ${hasPoster ? "space-backdrop--image" : ""}`}>
      {mode === "video" && (
        <video
          className={`space-backdrop__video ${playing ? "is-playing" : ""}`}
          src={videoSrc ?? undefined}
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
          onEmptied={() => setPlaying(false)}
          onError={() => setFailed(true)}
          ref={(el) => {
            // Autoplay can be rejected by the browser; fall back to the static backdrop.
            if (el && el.paused) el.play().catch(() => setFailed(true));
          }}
        />
      )}
      <div className="space-backdrop__overlay" />
    </div>
  );
}
