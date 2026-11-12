# 3D asset sources and attribution

## Human skeleton (source for the knee renders)
- File: `assets/source/human-skeleton.glb` (source only; never requested by the browser, never copied to `public/`)
- Title: "Human Skeleton"
- Author: Terrie (https://sketchfab.com/terrielsimmons)
- Source: https://sketchfab.com/3d-models/human-skeleton-911b9df7e7834175b69b4840ea15e054
- License: CC BY 4.0 (http://creativecommons.org/licenses/by/4.0/) - attribution required
- Evidence: read from the GLB's own `asset.extras` block (author, license, source, title), and VERIFIED online on 2026-11-12 with the public
  Sketchfab API (`api.sketchfab.com/v3/models/911b9df7e7834175b69b4840ea15e054`): name "Human Skeleton", author terrielsimmons, license "CC Attribution"
  (CC BY 4.0). Status: **verified**.
- Content: 183 meshes. Separate `l_/r_` femur, tibia, fibula and patella meshes exist.
- Modifications: only left femur, tibia, fibula and patella were rendered; the patella was nudged 8 mm toward the
  trochlea for the render; lighting and bone colour were changed. Derived images carry the same CC BY 4.0 terms.
- Credit shown in the UI under the knee view (Overview and Joint Analytics).

## Astronaut model
- File: `public/models/astronaut.glb` (762 KB, Draco-compressed, WebP textures; exported by "Khronos glTF Blender I/O v4.2.57")
- Original creator, source URL and license: NOT recorded in the file and not provided. Unknown. Checked on 2026-11-12: the GLB's `asset` block holds only the
  exporter string (no copyright, author or license field), its mesh and material names ("astnt1") match nothing identifiable, and a web search for them found no
  source. Status: **awaiting confirmation**. Please supply the creator, source URL and license (and confirm it permits this use) before publishing.
- The GLB is not requested by the browser; only the rendered `public/images/astronaut.webp` is.
- The render shows the model's own stylised (low-poly) design. It is not a photo of any person.

## Rendered outputs (made locally by `tools/render`)
| File | Size | Content |
|---|---|---|
| `public/images/astronaut.webp` | 480x502, 16 KB | Helmet and upper body, transparent background, bottom edge faded |
| `public/images/knee-side.webp` | 576x768, 15 KB | Combined lateral view of the left knee (femur, tibia, fibula, patella), straight-leg pose |
| `public/images/knee-femur.webp` | 576x768, 7 KB | Femur layer (fixed) |
| `public/images/knee-tibia.webp` | 576x768, 8 KB | Tibia + fibula layer (rotates with flexion about the pivot in `lib/knee-render.ts`) |
| `public/images/knee-patella.webp` | 576x768, 3 KB | Patella layer (rotates at 45% of flexion) |

The four knee images share one camera and canvas, so one coordinate system (`lib/knee-render.ts`) aligns the UI
overlay (angle arc, sensor patches, LEDs, labels) to all of them.

## Supplied artwork (added by the project owner, Nov 2026)
These files were placed in `public/images/` by the owner. Their original source and licence are NOT recorded and were not
provided (several carry a small sparkle watermark in a corner, which suggests an AI image generator). Confirm the licence
and terms of use before publishing. The originals are kept untouched; the files below were derived from them.

| Derived file (used by the app) | Made from (kept as is) | What was done |
|---|---|---|
| `astronaut-portrait.webp` | `Astronaut_wearing_space_suit_..._2K-removebg-preview.png` | Converted to WebP (transparent background) |
| `astronaut-balance.webp` | `astronaut.webp` (owner-replaced, checkerboard baked into the pixels) | Checkerboard keyed out, cropped to the figure, transparent PNG-style alpha |
| `knee-anatomy.webp` | `Medical_illustration_of_human_knee.jpg` | Cropped to 3:4 (top 2048 px, below the watermark), resized to 768x1024 |
| `knee-joint-front.webp` | `Joint Anylatic.jpg` | Cropped around the joint, resized to 372x570 |
| `gait-phase-preswing.webp` | `Step3.jpg` | Cropped to the figure (watermark excluded), resized |
| `gait-walk-overview.webp` | `Step1.png` | Trimmed to the figure, converted to WebP |
| Foot clip path in `components/graphics/Footprints.tsx` | `Barefoot_for Loadand presure.png` | Left-foot contour traced, smoothed and fitted to the sensor layout |

The earlier Sketchfab bone renders (`knee-side/femur/tibia/patella.webp`) were removed from `public/images/` by the owner; the
knee view now uses `knee-anatomy.webp`. The Terrie / CC BY 4.0 credit above only applies if those renders are restored.

## Background clips (public/videos)
- `1.mp4`, `2.mp4`, `3.mp4`, `4.mp4`: supplied by the project owner. Portrait Earth-over-moon scenes (720x1280; `2.mp4` is 540x960). No source or licence is recorded.
- Used: `1.mp4` only, as the optional looping background (hidden on phones, off when reduced motion is set, switchable in Settings). `space-loop.mp4` would take priority if added.
- Not used: `2.mp4`, `3.mp4`, `4.mp4`. No page-specific use was stated, so none is attached to a page.

## Verification log (2026-11-12)
Checked with local file inspection (embedded metadata) and, where possible, the original publisher. A file with no embedded or published licence is
listed as awaiting confirmation; nothing below is assumed.

| Item | What was verified | Status |
|---|---|---|
| `assets/source/human-skeleton.glb` (Terrie, Sketchfab) | GLB extras and the public Sketchfab API agree: author terrielsimmons, CC Attribution 4.0 | Verified |
| `public/models/astronaut.glb` | No creator, source or licence in the file; no matching public listing found | **Awaiting confirmation** |
| `Astronaut_wearing_space.jpg`, `Medical_illustration_of_human_knee.jpg`, `Medical_illustration_of_human_kne.jpg`, `Step2.jpg`, `Step3.jpg`, `Step4.jpg`, `astronaut.webp` (originals) | Embedded C2PA content credentials signed by Google LLC: action `c2pa.created`, source type `trainedAlgorithmicMedia`, "Made with Google AI" / "Google Generative AI". They are AI-generated images. The file does not state licence terms; output terms depend on the generator's terms | Provenance verified (AI-generated); **licence awaiting confirmation** |
| `Astronaut_wearing_space_suit_..._2K-removebg-preview.png`, `Barefoot_for Loadand presure.png`, `Dashboard_Knee.png`, `Joint Anylatic.jpg`, `Step1.png` (originals) | No embedded provenance, copyright or licence metadata | **Awaiting confirmation** |
| `Step2.jpg`, `Step3.jpg`, `Step4.jpg` (supplied by the project owner, used directly in the Gait Cycle Timeline with `Step1.png` and `gait-phase-preswing.webp`) | No embedded provenance or licence metadata checked; each shows a small corner sparkle mark | **Awaiting confirmation** |
| Derived `public/images/*.webp` used by the app | Metadata was not carried over; their status follows the original in the table above (portrait <- removebg png; balance <- `astronaut.webp`; knee-anatomy <- `Medical_illustration_of_human_knee.jpg`; knee-joint-front <- `Joint Anylatic.jpg`; gait-phase-preswing <- `Step3.jpg`; gait-walk-overview <- `Step1.png`) | Follows source |
| `public/videos/1.mp4` to `4.mp4` | No embedded source or licence metadata | **Awaiting confirmation** |

Still awaiting confirmation before publishing: the astronaut GLB; the licence terms for the AI-generated images; and the source and licence of the five
originals and four videos listed above.
