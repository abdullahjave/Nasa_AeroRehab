import fs from "node:fs";
import path from "node:path";

// Server-only: which optional backdrop files exist in /public. Used by the root layout and the Settings page.
// The video is `space-loop.mp4`; if it is absent, `1.mp4` is used. All four supplied clips (1-4.mp4) are portrait 720x1280 (540x960
// for 2.mp4) Earth-over-moon scenes, so they fit the space theme but not a specific page. Only 1.mp4 is used, as the one default
// backdrop; 2-4.mp4 are kept in the repo and are not selected automatically. Their source and licence are not recorded.
const CANDIDATES = ["space-loop.mp4", "1.mp4"];

export type BackdropAssets = { videoSrc: string | null; hasPoster: boolean };

export function backdropAssets(): BackdropAssets {
  const cwd = process.cwd();
  const file = CANDIDATES.find((f) => fs.existsSync(path.join(cwd, "public/videos", f)));
  return {
    videoSrc: file ? `/videos/${file}` : null,
    hasPoster: fs.existsSync(path.join(cwd, "public/images/space-backdrop.webp")),
  };
}
