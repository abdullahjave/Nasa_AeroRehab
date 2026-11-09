# Offline asset renders

No Blender was available, so the knee and astronaut images are rendered with three.js in a normal Chrome tab.
This folder is tooling only. It is not part of the Next.js app and ships nothing to the browser.

1. `cd tools/render && npm install` (installs `three` locally).
2. `node tools/render/server.mjs` starts a loopback-only server (127.0.0.1:3300) that serves this folder, the two
   GLB inputs, and accepts rendered PNGs into `tools/render/out/`.
3. Open http://127.0.0.1:3300/tools/render/render.html and drive `window.R` from the console (see below).
4. `python tools/render/export_webp.py` crops, fades and converts the PNGs to WebP in `public/images/`.

## Recipe used
- Knee (renderer 768x1024, orthographic half-height 0.2 m): load `assets/source/human-skeleton.glb`, keep only
  `l_femur__0`, `l_tibia__0`, `l_fibula__0`, `l_patella__0`. Body axis is +Z (head -Z); left is +X; anterior is -Y.
  Camera at +X looking -X, up = -Z. Pivot = lateral epicondyle (most lateral femur vertex in the distal 6 cm):
  world (0.3158, 0.0290, 0.5831), which lands at the image centre. Patella moved +0.008 m z, +0.003 m y.
  Lights: warm key (3,-3,-2.5) 2.6, cyan rim (1,4,-1) 5.0, cool fill (3,0,3) 0.7; env intensity 0.22; bone 0xcfc3b0.
  Render four times (combined, femur, tibia+fibula, patella) with identical camera.
- Astronaut (renderer 720x800, perspective fov 19): front of the model is +Z. Camera yaw 20 deg, distance 110, target
  (2,25,0). Material `astnt1_2` (visor) roughness 0.22, metalness 0.55, colour 0x9db4d8. Lights as in the script above.

## Using the pieces in `window.R`
`R.newScene()`, `R.loadGLB(url)`, `R.setCamera({pos,target,up,ortho|fov})`, `R.render()`, `R.project([x,y,z])`
(normalised image coords), `R.bounds(obj)`, `R.save('name.png')`.
