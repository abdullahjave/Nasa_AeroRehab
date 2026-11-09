// Geometry of the rendered knee layers (public/images/knee-*.webp), shared by the image and the UI overlay.
// All layers are rendered from one camera on the same 576 x 768 canvas, so one coordinate system fits all.
// Source render: tools/render (three.js, orthographic, lateral view of the left knee, anterior = right).

export const KNEE_IMG = {
  w: 576,
  h: 768,
  /** Flexion axis (lateral epicondyle) in image pixels. The tibia and patella layers rotate about it. */
  pivot: { x: 288, y: 384 },
  /** Image pixels per metre (orthographic half-height 0.2 m over 768 px). */
  pxPerM: 1920,
  /** Sensor patch centres in the neutral (straight-leg) pose, image pixels. */
  thighPatch: { x: 338, y: 196 },
  shankPatch: { x: 334, y: 552 },
  /** The patella follows the knee at about this fraction of the flexion angle. */
  patellaFollow: 0.45,
} as const;

const rad = (d: number) => (d * Math.PI) / 180;

/** Rotate an image point about the pivot by flexion (CSS clockwise, shank swings backward). */
export function rotateAboutPivot(p: { x: number; y: number }, deg: number) {
  const { pivot } = KNEE_IMG;
  const dx = p.x - pivot.x;
  const dy = p.y - pivot.y;
  const c = Math.cos(rad(deg));
  const s = Math.sin(rad(deg));
  return { x: pivot.x + dx * c - dy * s, y: pivot.y + dx * s + dy * c };
}
