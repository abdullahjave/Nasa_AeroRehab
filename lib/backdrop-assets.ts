import fs from "node:fs";
import path from "node:path";

// Server-only: which optional backdrop files exist in /public. Used by the root layout and the Settings page.
// The video is `space-loop.mp4`; if it is absent, the first of the clips already in the repo (1.mp4 ... 4.mp4) is used.
const CANDIDATES = ["space-loop.mp4", "1.mp4", "2.mp4", "3.mp4", "4.mp4"];

export type BackdropAssets = { videoSrc: string | null; hasPoster: boolean };

export function backdropAssets(): BackdropAssets {
  const cwd = process.cwd();
  const file = CANDIDATES.find((f) => fs.existsSync(path.join(cwd, "public/videos", f)));
  return {
    videoSrc: file ? `/videos/${file}` : null,
    hasPoster: fs.existsSync(path.join(cwd, "public/images/space-backdrop.webp")),
  };
}
