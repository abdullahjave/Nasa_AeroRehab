// Display preferences (Step 10). Persisted per browser; never cleared by Reset Demo.

export type DisplayPrefs = {
  /** User asks to reduce motion. The system preference (prefers-reduced-motion) always applies on top of this. */
  reduceMotion: boolean;
  /** Show the shared background video when the device allows it. */
  backgroundVideo: boolean;
};

export const DEFAULT_DISPLAY: DisplayPrefs = { reduceMotion: false, backgroundVideo: true };

export function parseDisplay(raw: unknown): DisplayPrefs {
  if (!raw || typeof raw !== "object") return DEFAULT_DISPLAY;
  const r = raw as Partial<Record<keyof DisplayPrefs, unknown>>;
  return {
    reduceMotion: typeof r.reduceMotion === "boolean" ? r.reduceMotion : DEFAULT_DISPLAY.reduceMotion,
    backgroundVideo: typeof r.backgroundVideo === "boolean" ? r.backgroundVideo : DEFAULT_DISPLAY.backgroundVideo,
  };
}

export type BackdropMode = "video" | "poster" | "css";

/**
 * Which backdrop layer is showing. Video needs: a clip on disk, the user preference, a wide screen, no reduced
 * motion (preference or system) and no load/autoplay failure. Otherwise the poster, else the CSS starfield.
 */
export function backdropMode(o: { hasVideo: boolean; hasPoster: boolean; prefVideo: boolean; reducedMotion: boolean; wide: boolean; failed: boolean }): BackdropMode {
  if (o.hasVideo && o.prefVideo && o.wide && !o.reducedMotion && !o.failed) return "video";
  return o.hasPoster ? "poster" : "css";
}
