# AeroRehab (Nasa_AeroRehab)

Frontend-only rehabilitation analytics dashboard for a simulated astronaut mission (Artemis-II, Day 42).
All values are **Simulated Data** fixtures in `lib/demo/`. There is no backend and no live sensor link.

Next.js (App Router) + TypeScript + Tailwind CSS v4 + Recharts.

## Pages
Overview, Joint Analytics, Gait Analysis are built. Load & Pressure, Stability & Balance, AI Insights,
Rehabilitation, Reports, Patient Management and Settings are placeholders.

## Run
```bash
npm install
npm run dev        # starts the CSS watcher and Next.js together
npm run build      # one-shot CSS build + production build
npm run lint
```

### CSS workflow
Authored CSS lives in `styles/globals.src.css`. `scripts/build-css.mjs` compiles it with Tailwind's JavaScript
compiler into `app/globals.css` (generated, committed). It runs automatically before `dev` and `build`, and works
on machines where Tailwind's native binary is blocked.

## Assets
- `public/images/*.webp` are derived from the artwork supplied by the project owner (see `assets/ATTRIBUTIONS.md`). Original source and licence are not recorded; confirm before publishing.
- The old Sketchfab knee renders (Terrie, CC BY 4.0) are no longer in `public/images/`.
- `public/models/astronaut.glb`: source and licence not recorded yet. Confirm before publishing.
- Optional background video: add `public/videos/space-loop.mp4` (and `public/images/space-backdrop.webp` as poster).
  Without them the app uses a CSS starfield.
