#!/usr/bin/env python3
"""Create a transparent, fixed-grid hero sprite sheet from a concept sheet.

This is an art-helper script, not part of the normal dev loop. It expects the
current four-row adventurer concept image generated during the prototype and
produces a 64-frame, 96x96-frame transparent sheet compatible with Phaser.

Usage:
  python tools/clean-concept-sprite-sheet.py \
    asset-packs/cc0-pixel-v10/sources/hero-adventurer-concept.png \
    asset-packs/cc0-pixel-v10/sources/legacy/hero-adventurer-concept-clean.png
"""
from __future__ import annotations

import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

FRAME_SIZE = 96

# Manual crop hints for the current generated concept sheet. These are deliberately
# stored here so a future artist can retune the cleaner without touching game code.
# Each row entry is: (y0, y1, crop_width, center_x_values).
ROWS = [
    (45, 230, 92, [48, 158, 268, 378, 488, 598, 708, 818, 928, 1038, 1148, 1258, 1368]),
    (270, 462, 132, [50, 166, 282, 398, 514, 630, 746, 866, 990, 1110]),
    (492, 680, 145, [54, 166, 280, 392, 510, 632, 760, 890, 1018, 1145, 1276, 1405]),
    (720, 940, 145, [58, 176, 318, 456, 596, 732, 862, 1000, 1145, 1290]),
]

# Source-frame mapping into the app's existing 64-frame hero animation layout:
# walk 0-5, run 6-11, attack1 12-15, attack2 16-19, throw 20-23,
# parry 24-27, hit 28-31, fall 32-35, victory 36-39,
# strength 40-43, defense 44-47, precision 48-51, stamina 52-55,
# funny 56-59, idle 60-63.
MAPPING = [
    0, 1, 2, 3, 4, 5,
    6, 7, 8, 9, 10, 11,
    14, 15, 16, 17,
    17, 18, 19, 20,
    25, 26, 27, 28,
    20, 21, 22, 20,
    29, 30, 31, 32,
    31, 32, 33, 34,
    42, 43, 44, 42,
    35, 36, 35, 36,
    37, 20, 21, 37,
    39, 40, 39, 40,
    41, 41, 41, 41,
    44, 44, 44, 44,
    0, 2, 3, 4,
]


def extract_sources(source_path: Path) -> list[Image.Image]:
    image = Image.open(source_path).convert("RGB")
    arr = np.array(image).astype(np.int16)
    sources: list[Image.Image] = []

    for y0, y1, crop_width, centers in ROWS:
        for center_x in centers:
            x0 = max(0, int(center_x - crop_width // 2))
            x1 = min(arr.shape[1], int(center_x + crop_width // 2))
            crop = arr[y0:y1, x0:x1].copy()
            mask = build_foreground_mask(crop)
            sprite = crop_to_alpha_sprite(crop, mask)
            sources.append(sprite)

    return sources


def build_foreground_mask(crop: np.ndarray) -> np.ndarray:
    # The concept image has a soft painted background. Estimate it with a large
    # blur and keep pixels that differ enough from that local background.
    background = cv2.GaussianBlur(crop.astype(np.uint8), (0, 0), sigmaX=25, sigmaY=25).astype(np.int16)
    diff = np.linalg.norm(crop - background, axis=2)
    rgb = crop
    max_rgb = rgb.max(axis=2)
    min_rgb = rgb.min(axis=2)
    saturation = max_rgb - min_rgb

    mask = ((diff > 20) | ((saturation > 35) & (diff > 12))).astype("uint8") * 255
    mask[:5, :] = 0
    mask[-3:, :] = 0
    mask[:, :2] = 0
    mask[:, -2:] = 0

    kernel = np.ones((3, 3), np.uint8)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel, iterations=1)
    mask = cv2.dilate(mask, kernel, iterations=1)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel, iterations=2)

    # Keep foreground components near the largest component and drop vertical
    # background streaks from the concept sheet.
    num, labels, stats, _ = cv2.connectedComponentsWithStats((mask > 0).astype("uint8"), 8)
    keep = np.zeros_like(mask)
    if num > 1:
        areas = stats[:, cv2.CC_STAT_AREA]
        largest = int(np.argmax(areas[1:]) + 1)
        lx, ly, lw, lh, _ = stats[largest]
        for label in range(1, num):
            x, y, width, height, area = stats[label]
            overlaps = not (
                x + width < lx - 28 or x > lx + lw + 28 or y + height < ly - 24 or y > ly + lh + 24
            )
            if area > 60 and height > 5 and overlaps:
                keep[labels == label] = 255
        if keep.sum() == 0:
            keep[labels == largest] = 255
    return keep


def crop_to_alpha_sprite(crop: np.ndarray, mask: np.ndarray) -> Image.Image:
    ys, xs = np.where(mask > 0)
    if len(xs) == 0:
        return Image.new("RGBA", (FRAME_SIZE, FRAME_SIZE), (0, 0, 0, 0))

    x_min = max(0, int(xs.min()) - 2)
    x_max = min(crop.shape[1], int(xs.max()) + 3)
    y_min = max(0, int(ys.min()) - 3)
    y_max = min(crop.shape[0], int(ys.max()) + 4)
    rgba = np.dstack([crop.astype("uint8"), mask])
    return Image.fromarray(rgba, "RGBA").crop((x_min, y_min, x_max, y_max))


def assemble_sheet(sources: list[Image.Image], output_path: Path) -> None:
    sheet = Image.new("RGBA", (FRAME_SIZE * 64, FRAME_SIZE), (0, 0, 0, 0))
    for index, source_index in enumerate(MAPPING):
        if source_index >= len(sources):
            continue
        sprite = sources[source_index]
        if sprite.getbbox() is None:
            continue
        scale = min(90 / sprite.width, 90 / sprite.height, 1.0)
        new_size = (max(1, int(sprite.width * scale)), max(1, int(sprite.height * scale)))
        sprite = sprite.resize(new_size, Image.Resampling.LANCZOS)
        x = index * FRAME_SIZE + (FRAME_SIZE - new_size[0]) // 2
        y = FRAME_SIZE - new_size[1] - 4
        sheet.alpha_composite(sprite, (x, y))

    output_path.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(output_path)


def main() -> int:
    if len(sys.argv) != 3:
        print("Usage: python tools/clean-concept-sprite-sheet.py <concept.png> <output.png>", file=sys.stderr)
        return 2
    source_path = Path(sys.argv[1])
    output_path = Path(sys.argv[2])
    if not source_path.exists():
        print(f"Concept image not found: {source_path}", file=sys.stderr)
        return 1
    sources = extract_sources(source_path)
    assemble_sheet(sources, output_path)
    print(f"Wrote {output_path} with {FRAME_SIZE}x{FRAME_SIZE} frames.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
