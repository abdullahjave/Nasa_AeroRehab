import test from "node:test";
import assert from "node:assert/strict";
import { backdropMode, DEFAULT_DISPLAY, parseDisplay } from "./display";

const base = { hasVideo: true, hasPoster: false, prefVideo: true, reducedMotion: false, wide: true, failed: false };

test("video plays only when every condition allows it", () => {
  assert.equal(backdropMode(base), "video");
  assert.equal(backdropMode({ ...base, prefVideo: false }), "css");
  assert.equal(backdropMode({ ...base, reducedMotion: true }), "css");
  assert.equal(backdropMode({ ...base, wide: false }), "css");
  assert.equal(backdropMode({ ...base, failed: true }), "css");
  assert.equal(backdropMode({ ...base, hasVideo: false }), "css");
});

test("the poster is the fallback when it exists", () => {
  assert.equal(backdropMode({ ...base, hasPoster: true, prefVideo: false }), "poster");
  assert.equal(backdropMode({ ...base, hasPoster: true }), "video");
});

test("parseDisplay falls back to defaults for missing or malformed values", () => {
  assert.deepEqual(parseDisplay(null), DEFAULT_DISPLAY);
  assert.deepEqual(parseDisplay({ reduceMotion: "x", backgroundVideo: false }), { reduceMotion: false, backgroundVideo: false });
});
