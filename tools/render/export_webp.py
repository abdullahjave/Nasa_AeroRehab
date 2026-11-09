"""Convert the PNG renders in tools/render/out to the WebP files the app uses.

Run from anywhere:  python tools/render/export_webp.py
Needs Pillow and numpy.
"""
import os
from pathlib import Path

import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
SRC = HERE / "out"
DEST = HERE.parent.parent / "public" / "images"
DEST.mkdir(parents=True, exist_ok=True)


def fade(im: Image.Image, y0: int, y1: int, top: bool) -> Image.Image:
    """Smoothstep alpha fade between rows y0..y1 (top=True fades in downward, otherwise fades out)."""
    a = np.array(im.getchannel("A"), dtype=np.float32)
    ys = np.arange(a.shape[0], dtype=np.float32)
    g = np.clip((ys - y0) / (y1 - y0), 0, 1) if top else np.clip((y1 - ys) / (y1 - y0), 0, 1)
    g = g * g * (3 - 2 * g)
    out = im.copy()
    out.putalpha(Image.fromarray((a * g[:, None]).astype(np.uint8)))
    return out


def save(im: Image.Image, name: str, quality: int = 86) -> None:
    path = DEST / name
    im.save(path, "WEBP", quality=quality, method=6)
    print(name, im.size, os.path.getsize(path) // 1024, "KB")


def load(name: str) -> Image.Image:
    return Image.open(SRC / name).convert("RGBA")


knee_size = (576, 768)
femur = fade(load("knee-femur.png"), 0, 170, top=True)
tibia = fade(load("knee-tibia.png"), 880, 1024, top=False)
patella = load("knee-patella.png")
combined = fade(fade(load("knee-combined.png"), 0, 170, top=True), 880, 1024, top=False)
for im, name in [(combined, "knee-side.webp"), (femur, "knee-femur.webp"), (tibia, "knee-tibia.webp"), (patella, "knee-patella.webp")]:
    save(im.resize(knee_size, Image.LANCZOS), name)

astro = load("astro-bust.png").crop((30, 110, 690, 800))
astro = fade(astro, 500, 690, top=False).resize((480, 502), Image.LANCZOS)
save(astro, "astronaut.webp", 88)
