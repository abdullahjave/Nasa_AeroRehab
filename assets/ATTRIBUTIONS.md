# 3D asset sources and attribution

## Human skeleton (source for the knee renders)
- File: `assets/source/human-skeleton.glb` (source only; never requested by the browser, never copied to `public/`)
- Title: "Human Skeleton"
- Author: Terrie (https://sketchfab.com/terrielsimmons)
- Source: https://sketchfab.com/3d-models/human-skeleton-911b9df7e7834175b69b4840ea15e054
- License: CC BY 4.0 (http://creativecommons.org/licenses/by/4.0/) - attribution required
- Evidence: read from the GLB's own `asset.extras` block (author, license, source, title). Not independently
  re-verified online (the build machine could not resolve external hosts).
- Content: 183 meshes. Separate `l_/r_` femur, tibia, fibula and patella meshes exist.
- Modifications: only left femur, tibia, fibula and patella were rendered; the patella was nudged 8 mm toward the
  trochlea for the render; lighting and bone colour were changed. Derived images carry the same CC BY 4.0 terms.
- Credit shown in the UI under the knee view (Overview and Joint Analytics).

## Astronaut model
- File: `public/models/astronaut.glb` (762 KB, Draco-compressed, WebP textures; exported by "Khronos glTF Blender I/O v4.2.57")
- Original creator, source URL and license: NOT recorded in the file and not provided. Unknown.
  Please supply them (and confirm the license permits this use) before publishing.
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
