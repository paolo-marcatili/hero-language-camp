#!/usr/bin/env python3
"""Generate four low, single-edge isometric labyrinth wall guide assets.

The assets share a 256x192 coordinate system with these tile vertices:
  north=(128, 64), east=(248, 128), south=(128, 188), west=(8, 128)
Each PNG contains exactly one wall edge, so arbitrary wall combinations can be
composed by the renderer without unwanted perpendicular returns.
"""

from __future__ import annotations

from math import hypot
from pathlib import Path
import random

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "asset-packs" / "cc0-pixel-v10" / "labyrinth"
SIZE = (256, 192)
SCALE = 3

VERTICES = {
    "north": (128, 64),
    "east": (248, 128),
    "south": (128, 188),
    "west": (8, 128),
}
EDGES = {
    "wall-northwest.png": (VERTICES["west"], VERTICES["north"]),
    "wall-northeast.png": (VERTICES["north"], VERTICES["east"]),
    "wall-southeast.png": (VERTICES["east"], VERTICES["south"]),
    "wall-southwest.png": (VERTICES["south"], VERTICES["west"]),
}


def scaled(point: tuple[float, float]) -> tuple[int, int]:
    return round(point[0] * SCALE), round(point[1] * SCALE)


def interpolate(a: tuple[float, float], b: tuple[float, float], t: float) -> tuple[float, float]:
    return a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t


def generate_wall(path: Path, start: tuple[int, int], end: tuple[int, int], seed: int) -> None:
    random.seed(seed)
    image = Image.new("RGBA", (SIZE[0] * SCALE, SIZE[1] * SCALE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image, "RGBA")

    height = 27
    cap = 7
    s = (float(start[0]), float(start[1]))
    e = (float(end[0]), float(end[1]))
    top_s = (s[0], s[1] - height)
    top_e = (e[0], e[1] - height)

    # Soft grounding shadow and dark demarcation line.
    draw.line([scaled(s), scaled(e)], fill=(55, 37, 20, 120), width=10 * SCALE)

    # Low wall face and lighter stone cap.
    draw.polygon(
        [scaled(s), scaled(e), scaled(top_e), scaled(top_s)],
        fill=(118, 96, 63, 255),
        outline=(68, 54, 37, 255),
    )
    cap_s = (top_s[0], top_s[1] - cap)
    cap_e = (top_e[0], top_e[1] - cap)
    draw.polygon(
        [scaled(top_s), scaled(top_e), scaled(cap_e), scaled(cap_s)],
        fill=(166, 142, 93, 255),
        outline=(75, 60, 39, 255),
    )

    length = max(1.0, hypot(e[0] - s[0], e[1] - s[1]))
    blocks = max(5, round(length / 25))
    for index in range(1, blocks):
        t = index / blocks
        base = interpolate(s, e, t)
        top = (base[0], base[1] - height)
        draw.line([scaled(base), scaled(top)], fill=(79, 63, 43, 210), width=2 * SCALE)

    # Uneven stone highlights and moss, deliberately simple for image-to-image refinement.
    for index in range(blocks):
        t0 = index / blocks
        t1 = (index + 1) / blocks
        mid = interpolate(top_s, top_e, (t0 + t1) / 2)
        jitter_x = random.uniform(-4, 4)
        jitter_y = random.uniform(-2, 2)
        radius = random.uniform(2.5, 5.0)
        center = scaled((mid[0] + jitter_x, mid[1] + jitter_y - cap / 2))
        r = round(radius * SCALE)
        color = random.choice([
            (101, 135, 56, 210),
            (80, 119, 48, 190),
            (129, 151, 67, 180),
        ])
        draw.ellipse([center[0] - r, center[1] - r, center[0] + r, center[1] + r], fill=color)

    image = image.resize(SIZE, Image.Resampling.LANCZOS)
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path)


def main() -> None:
    for index, (name, edge) in enumerate(EDGES.items()):
        generate_wall(OUT / name, edge[0], edge[1], seed=1700 + index)
    print(f"Generated {len(EDGES)} low single-edge wall assets in {OUT}")


if __name__ == "__main__":
    main()
