#!/usr/bin/env python3
"""Generate clean, warm fantasy-labyrinth placeholder assets.

The assets intentionally use simple shapes and clear silhouettes so they can
be passed through an image-to-image model without changing their dimensions.
"""
from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Iterable

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "asset-packs" / "cc0-pixel-v10" / "labyrinth"
SOURCE_PREVIEW = ROOT / "asset-packs" / "cc0-pixel-v10" / "sources" / "labyrinth-placeholder-preview.png"

TRANSPARENT = (0, 0, 0, 0)
INK = (72, 49, 31, 255)
STONE = (137, 126, 91, 255)
STONE_DARK = (88, 81, 60, 255)
STONE_LIGHT = (185, 171, 126, 255)
MOSS = (77, 111, 58, 255)
MOSS_LIGHT = (121, 150, 79, 255)
EARTH = (155, 113, 63, 255)
EARTH_LIGHT = (205, 165, 92, 255)
GOLD = (229, 174, 55, 255)
GOLD_LIGHT = (255, 227, 128, 255)
GREEN_DARK = (39, 78, 48, 255)
GREEN = (75, 126, 68, 255)
GREEN_LIGHT = (131, 169, 91, 255)
BLUE = (67, 136, 171, 255)
PURPLE = (126, 82, 154, 255)
RED = (175, 71, 56, 255)
CREAM = (245, 224, 173, 255)


def rgba(size: tuple[int, int], color=TRANSPARENT) -> Image.Image:
    return Image.new("RGBA", size, color)


def save(image: Image.Image, filename: str) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    image.save(OUT / filename)


def shadow_ellipse(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], alpha: int = 70) -> None:
    draw.ellipse(box, fill=(28, 24, 18, alpha))


def floor_tile(variant: int) -> Image.Image:
    """Create a soft isometric forest-floor tile without a hard cell outline.

    The exact route is rendered separately by ``path_overlay`` so the visible
    maze reads as connected passages instead of a checkerboard of diamonds.
    """
    image = rgba((256, 128))
    draw = ImageDraw.Draw(image)
    diamond = [(128, 4), (251, 64), (128, 124), (5, 64)]
    grass = [
        (105, 139, 72, 255),
        (92, 128, 65, 255),
        (119, 146, 78, 255),
    ][variant % 3]
    draw.polygon(diamond, fill=grass)

    # Organic moss and stone accents. Keep the edge soft and transparent so
    # neighboring cells visually blend when the map is fully explored.
    accents = [
        (31, 64, 17, 8), (71, 39, 19, 8), (111, 88, 24, 10),
        (160, 37, 23, 9), (202, 72, 21, 9), (151, 96, 16, 7),
    ]
    for index, (x, y, rx, ry) in enumerate(accents):
        fill = MOSS_LIGHT if (index + variant) % 2 == 0 else MOSS
        draw.ellipse((x-rx, y-ry, x+rx, y+ry), fill=fill)

    for index, (x, y) in enumerate(((48, 67), (84, 91), (126, 28), (168, 91), (210, 57))):
        if (index + variant) % 2 == 0:
            draw.ellipse((x-4, y-2, x+4, y+2), fill=STONE_LIGHT, outline=STONE_DARK)
        else:
            draw.line((x, y, x, y-7), fill=GREEN_DARK, width=2)
            draw.ellipse((x-3, y-11, x+3, y-5), fill=(245, 218, 111, 255))

    # A light internal highlight gives the tile volume without outlining the
    # complete diamond/grid cell.
    draw.line([(17, 64), (128, 10), (239, 64)], fill=(159, 183, 103, 120), width=2)
    return image


def path_overlay(mask: int) -> Image.Image:
    """Create one of the 16 route overlays for N/E/S/W exit combinations.

    Bit layout: north=1, east=2, south=4, west=8. The overlays have a
    transparent background and share the same 256x128 footprint as a floor
    tile.
    """
    image = rgba((256, 128))
    draw = ImageDraw.Draw(image)
    center = (128, 64)
    # Direction names follow the maze grid, whose neighbors are offset on the
    # isometric axes: north=upper-right, east=lower-right, south=lower-left,
    # west=upper-left. Endpoints sit at shared diamond-edge midpoints.
    endpoints = {
        1: (192, 32),
        2: (192, 96),
        4: (64, 96),
        8: (64, 32),
    }

    # Even a zero-exit tile gets a small clearing; in normal generated mazes
    # every reachable cell has at least one exit.
    draw.ellipse((91, 46, 165, 82), fill=EARTH_LIGHT)
    draw.ellipse((98, 50, 158, 78), fill=EARTH)

    for bit, endpoint in endpoints.items():
        if not (mask & bit):
            continue
        # Draw a broad under-stroke and a softer central lane. Rounded ends
        # make adjacent tile paths visually join at the diamond boundary.
        draw.line((center, endpoint), fill=EARTH_LIGHT, width=34)
        draw.line((center, endpoint), fill=EARTH, width=25)

    # Sparse stones make the route readable without introducing text or icons.
    for index, (x, y) in enumerate(((112, 57), (143, 70), (126, 82), (151, 53))):
        if (mask + index) % 3 == 0:
            draw.ellipse((x-3, y-2, x+3, y+2), fill=STONE_LIGHT)
    return image

def fog_tile() -> Image.Image:
    image = rgba((256, 128))
    draw = ImageDraw.Draw(image)
    for cx, cy, rx, ry, alpha in [
        (62, 62, 55, 32, 135), (119, 44, 70, 35, 120), (179, 65, 68, 34, 125), (222, 50, 46, 28, 120)
    ]:
        draw.ellipse((cx-rx, cy-ry, cx+rx, cy+ry), fill=(220, 220, 197, alpha))
    image = image.filter(ImageFilter.GaussianBlur(7))
    return image


def wall(direction: str) -> Image.Image:
    image = rgba((256, 192))
    draw = ImageDraw.Draw(image)
    # Each file uses the full tile footprint and one clear wall edge.
    edge_map = {
        "northwest": ((18, 110), (128, 53)),
        "northeast": ((128, 53), (238, 110)),
        "southwest": ((18, 110), (128, 166)),
        "southeast": ((128, 166), (238, 110)),
    }
    start, end = edge_map[direction]
    dx, dy = end[0] - start[0], end[1] - start[1]
    length = math.hypot(dx, dy)
    nx, ny = -dy / length, dx / length
    height = 35
    top_start = (start[0] + nx * height, start[1] + ny * height)
    top_end = (end[0] + nx * height, end[1] + ny * height)
    draw.polygon([start, end, top_end, top_start], fill=STONE, outline=INK)
    draw.line((top_start, top_end), fill=STONE_LIGHT, width=5)
    segments = 6
    for i in range(1, segments):
        t = i / segments
        x = start[0] + dx * t
        y = start[1] + dy * t
        draw.line((x, y, x + nx * height, y + ny * height), fill=STONE_DARK, width=2)
    # Moss on the upper edge.
    for i in range(5):
        t = (i + 0.5) / 5
        x = top_start[0] + (top_end[0] - top_start[0]) * t
        y = top_start[1] + (top_end[1] - top_start[1]) * t
        draw.ellipse((x - 8, y - 6, x + 8, y + 4), fill=MOSS, outline=GREEN_DARK)
    return image


def hero_token() -> Image.Image:
    image = rgba((128, 128))
    draw = ImageDraw.Draw(image)
    shadow_ellipse(draw, (26, 102, 104, 119))
    # Green cape behind.
    draw.polygon([(54, 45), (35, 61), (31, 97), (59, 88)], fill=GREEN_DARK, outline=INK)
    # Body and head.
    draw.ellipse((46, 19, 82, 55), fill=(204, 145, 92, 255), outline=INK, width=3)
    draw.polygon([(48, 52), (83, 52), (91, 96), (41, 96)], fill=(117, 76, 48, 255), outline=INK)
    draw.line((54, 96, 48, 111), fill=INK, width=9)
    draw.line((77, 96, 84, 111), fill=INK, width=9)
    # Shield right, sword left.
    draw.ellipse((75, 55, 105, 91), fill=BLUE, outline=INK, width=4)
    draw.ellipse((83, 63, 97, 82), outline=CREAM, width=3)
    draw.line((45, 67, 23, 91), fill=STONE_LIGHT, width=6)
    draw.line((40, 71, 27, 57), fill=GOLD, width=5)
    # Hair and face.
    draw.pieslice((43, 14, 86, 52), 175, 360, fill=(76, 44, 29, 255), outline=INK)
    draw.ellipse((57, 35, 61, 39), fill=INK)
    draw.ellipse((70, 35, 74, 39), fill=INK)
    draw.arc((58, 37, 74, 47), 10, 165, fill=INK, width=2)
    return image


def dragon_token() -> Image.Image:
    image = rgba((96, 96))
    draw = ImageDraw.Draw(image)
    shadow_ellipse(draw, (18, 74, 80, 88), 55)
    draw.ellipse((28, 34, 70, 76), fill=RED, outline=INK, width=3)
    draw.ellipse((55, 20, 82, 48), fill=(205, 91, 67, 255), outline=INK, width=3)
    draw.polygon([(31, 42), (10, 27), (20, 58)], fill=(224, 125, 96, 255), outline=INK)
    draw.polygon([(45, 38), (34, 15), (59, 33)], fill=(224, 125, 96, 255), outline=INK)
    draw.line((31, 67, 13, 78), fill=RED, width=8)
    draw.ellipse((65, 29, 69, 34), fill=INK)
    draw.arc((64, 32, 77, 41), 10, 160, fill=INK, width=2)
    return image


def pedestal(symbol: str, accent: tuple[int, int, int, int]) -> Image.Image:
    image = rgba((128, 128))
    draw = ImageDraw.Draw(image)
    shadow_ellipse(draw, (20, 104, 108, 120))
    draw.polygon([(34, 88), (94, 88), (105, 108), (23, 108)], fill=STONE_DARK, outline=INK)
    draw.polygon([(43, 52), (85, 52), (91, 91), (37, 91)], fill=STONE, outline=INK)
    draw.ellipse((47, 21, 81, 57), fill=accent, outline=INK, width=4)
    # Use simple geometric symbols rather than text.
    if symbol == "sword":
        draw.line((58, 48, 73, 27), fill=CREAM, width=6)
        draw.line((56, 43, 70, 53), fill=GOLD, width=4)
    elif symbol == "shield":
        draw.polygon([(64, 27), (76, 33), (73, 49), (64, 55), (55, 49), (52, 33)], fill=CREAM, outline=INK)
    elif symbol == "target":
        draw.ellipse((53, 28, 75, 50), outline=CREAM, width=4)
        draw.ellipse((59, 34, 69, 44), fill=CREAM)
    else:
        draw.ellipse((56, 31, 72, 47), fill=CREAM)
        draw.line((64, 24, 64, 54), fill=CREAM, width=3)
    return image


def entrance() -> Image.Image:
    image = rgba((128, 128))
    draw = ImageDraw.Draw(image)
    shadow_ellipse(draw, (15, 105, 113, 120))
    draw.rectangle((27, 43, 101, 107), fill=STONE, outline=INK, width=4)
    draw.pieslice((27, 15, 101, 87), 180, 360, fill=STONE, outline=INK, width=4)
    draw.pieslice((42, 31, 86, 83), 180, 360, fill=(39, 47, 38, 255), outline=INK, width=3)
    draw.rectangle((42, 56, 86, 107), fill=(39, 47, 38, 255), outline=INK, width=3)
    draw.ellipse((25, 36, 48, 50), fill=MOSS)
    draw.ellipse((80, 31, 105, 49), fill=MOSS)
    return image


def monster(kind: int) -> Image.Image:
    image = rgba((192, 192))
    draw = ImageDraw.Draw(image)
    shadow_ellipse(draw, (34, 154, 158, 177))
    colors = [(113, 151, 62, 255), (116, 82, 151, 255), (73, 119, 121, 255)]
    color = colors[kind % len(colors)]
    if kind == 0:
        draw.ellipse((47, 53, 145, 153), fill=color, outline=INK, width=5)
        draw.polygon([(61, 62), (36, 35), (75, 48)], fill=color, outline=INK)
        draw.polygon([(131, 62), (156, 35), (118, 48)], fill=color, outline=INK)
    elif kind == 1:
        draw.ellipse((48, 65, 144, 154), fill=color, outline=INK, width=5)
        draw.polygon([(60, 89), (22, 61), (42, 119)], fill=color, outline=INK)
        draw.polygon([(132, 89), (170, 61), (150, 119)], fill=color, outline=INK)
    else:
        draw.ellipse((45, 48, 147, 153), fill=color, outline=INK, width=5)
        for x in (63, 96, 129):
            draw.ellipse((x - 9, 32, x + 9, 57), fill=(198, 116, 56, 255), outline=INK)
    draw.ellipse((68, 82, 82, 96), fill=CREAM, outline=INK)
    draw.ellipse((110, 82, 124, 96), fill=CREAM, outline=INK)
    draw.ellipse((73, 86, 79, 92), fill=INK)
    draw.ellipse((115, 86, 121, 92), fill=INK)
    draw.arc((72, 96, 121, 131), 5, 175, fill=INK, width=4)
    return image


def guardian() -> Image.Image:
    image = rgba((256, 256))
    draw = ImageDraw.Draw(image)
    shadow_ellipse(draw, (37, 210, 219, 238), 85)
    draw.ellipse((48, 58, 208, 215), fill=(161, 73, 57, 255), outline=INK, width=7)
    draw.polygon([(62, 91), (11, 47), (34, 145)], fill=(194, 91, 70, 255), outline=INK)
    draw.polygon([(194, 91), (245, 47), (222, 145)], fill=(194, 91, 70, 255), outline=INK)
    draw.ellipse((89, 27, 167, 92), fill=(185, 84, 65, 255), outline=INK, width=6)
    draw.polygon([(102, 36), (92, 9), (116, 31)], fill=STONE_LIGHT, outline=INK)
    draw.polygon([(154, 36), (164, 9), (140, 31)], fill=STONE_LIGHT, outline=INK)
    draw.ellipse((108, 53, 118, 63), fill=CREAM)
    draw.ellipse((138, 53, 148, 63), fill=CREAM)
    draw.arc((103, 66, 153, 91), 0, 170, fill=INK, width=4)
    draw.ellipse((103, 108, 153, 188), fill=CREAM, outline=INK, width=4)
    return image


def trap(kind: int) -> Image.Image:
    image = rgba((128, 128))
    draw = ImageDraw.Draw(image)
    shadow_ellipse(draw, (16, 101, 112, 118), 55)
    if kind == 0:  # roots
        for i in range(5):
            x = 23 + i * 19
            draw.arc((x - 20, 50, x + 30, 112), 190, 355, fill=(91, 57, 33, 255), width=8)
        draw.ellipse((45, 42, 84, 79), fill=GREEN_DARK, outline=INK)
    elif kind == 1:  # spikes
        draw.polygon([(19, 105), (32, 45), (47, 105), (62, 39), (79, 105), (95, 50), (110, 105)], fill=STONE_LIGHT, outline=INK)
    elif kind == 2:  # web
        center = (64, 67)
        for radius in (18, 34, 48):
            draw.ellipse((center[0]-radius, center[1]-radius, center[0]+radius, center[1]+radius), outline=CREAM, width=3)
        for angle in range(0, 360, 45):
            x = center[0] + math.cos(math.radians(angle)) * 52
            y = center[1] + math.sin(math.radians(angle)) * 52
            draw.line((center[0], center[1], x, y), fill=CREAM, width=3)
        draw.ellipse((58, 61, 70, 74), fill=INK)
    else:  # poison mushroom circle
        for x, y in ((35, 83), (62, 60), (89, 86)):
            draw.rectangle((x-4, y, x+4, y+25), fill=CREAM, outline=INK)
            draw.pieslice((x-18, y-15, x+18, y+11), 180, 360, fill=RED, outline=INK)
            draw.ellipse((x-5, y-10, x, y-5), fill=CREAM)
    return image


def cache(opened: bool) -> Image.Image:
    image = rgba((128, 128))
    draw = ImageDraw.Draw(image)
    shadow_ellipse(draw, (16, 101, 112, 118), 60)
    draw.rectangle((27, 61, 101, 105), fill=(136, 78, 38, 255), outline=INK, width=4)
    if opened:
        draw.polygon([(27, 61), (38, 31), (102, 31), (101, 61)], fill=(151, 91, 43, 255), outline=INK)
        for x in (48, 64, 80):
            draw.ellipse((x-7, 49, x+7, 63), fill=GOLD, outline=INK)
    else:
        draw.pieslice((27, 36, 101, 82), 180, 360, fill=(151, 91, 43, 255), outline=INK, width=4)
    draw.rectangle((58, 73, 70, 90), fill=GOLD, outline=INK)
    return image


def healing_fountain() -> Image.Image:
    image = rgba((128, 128))
    draw = ImageDraw.Draw(image)
    shadow_ellipse(draw, (15, 104, 113, 120), 55)
    draw.ellipse((23, 77, 105, 113), fill=STONE_DARK, outline=INK, width=4)
    draw.ellipse((31, 72, 97, 103), fill=BLUE, outline=INK, width=3)
    draw.rectangle((55, 39, 73, 85), fill=STONE, outline=INK)
    draw.ellipse((44, 27, 84, 49), fill=STONE_LIGHT, outline=INK)
    draw.line((64, 39, 64, 78), fill=(174, 225, 234, 255), width=8)
    return image


def reveal_obelisk() -> Image.Image:
    image = rgba((128, 128))
    draw = ImageDraw.Draw(image)
    shadow_ellipse(draw, (21, 104, 107, 120), 55)
    draw.polygon([(64, 15), (88, 43), (81, 103), (47, 103), (40, 43)], fill=STONE, outline=INK, width=4)
    draw.ellipse((54, 45, 74, 65), fill=GOLD_LIGHT, outline=GOLD, width=4)
    draw.line((64, 34, 64, 78), fill=GOLD_LIGHT, width=3)
    draw.line((46, 55, 82, 55), fill=GOLD_LIGHT, width=3)
    return image


def treasure(locked: bool) -> Image.Image:
    image = cache(False if locked else True)
    draw = ImageDraw.Draw(image)
    if locked:
        draw.rectangle((51, 45, 77, 76), fill=STONE_DARK, outline=INK, width=3)
        draw.arc((55, 30, 73, 55), 180, 360, fill=STONE_LIGHT, width=5)
    else:
        draw.ellipse((91, 21, 109, 39), fill=GOLD_LIGHT, outline=GOLD)
        draw.line((100, 13, 100, 47), fill=GOLD_LIGHT, width=3)
        draw.line((84, 30, 116, 30), fill=GOLD_LIGHT, width=3)
    return image


def backdrop(size: tuple[int, int], encounter: bool) -> Image.Image:
    image = rgba(size, (233, 207, 148, 255))
    draw = ImageDraw.Draw(image)
    w, h = size
    # Sky and warm ruins/forest silhouette.
    draw.rectangle((0, 0, w, int(h * 0.56)), fill=(132, 174, 171, 255))
    for i in range(9):
        x = int(i * w / 8)
        peak = int(h * (0.18 + 0.07 * ((i * 3) % 4)))
        draw.polygon([(x - w // 7, int(h * 0.58)), (x, peak), (x + w // 7, int(h * 0.58))], fill=(93, 124, 94, 255))
    draw.rectangle((0, int(h * 0.55), w, h), fill=(92, 113, 62, 255))
    draw.polygon([(0, int(h * 0.78)), (w, int(h * 0.64)), (w, h), (0, h)], fill=(171, 129, 72, 255))
    for i in range(13):
        x = int((i + 0.5) * w / 13)
        tree_h = int(h * (0.24 if encounter else 0.18))
        draw.rectangle((x - 5, int(h * 0.55) - tree_h // 3, x + 5, int(h * 0.62)), fill=(72, 55, 34, 255))
        draw.ellipse((x - tree_h // 3, int(h * 0.55) - tree_h, x + tree_h // 3, int(h * 0.58)), fill=GREEN_DARK)
    return image


def decoration(kind: int) -> Image.Image:
    image = rgba((96, 96))
    draw = ImageDraw.Draw(image)
    shadow_ellipse(draw, (13, 75, 83, 89), 42)
    if kind == 0:  # roots
        for i in range(5):
            x = 14 + i * 17
            draw.arc((x - 14, 35, x + 26, 84), 185, 355, fill=(91, 57, 33, 255), width=6)
    elif kind == 1:  # broken column
        draw.rectangle((35, 27, 61, 78), fill=STONE, outline=INK, width=3)
        draw.rectangle((27, 20, 69, 32), fill=STONE_LIGHT, outline=INK, width=2)
        draw.polygon([(35, 27), (47, 12), (61, 27)], fill=STONE_DARK, outline=INK)
        draw.ellipse((28, 66, 68, 82), fill=MOSS, outline=GREEN_DARK)
    elif kind == 2:  # mushroom group
        for x, y, scale in ((25, 59, .85), (48, 45, 1.15), (72, 62, .75)):
            draw.rectangle((x-3*scale, y, x+3*scale, y+21*scale), fill=CREAM, outline=INK)
            draw.pieslice((x-14*scale, y-12*scale, x+14*scale, y+8*scale), 180, 360, fill=RED, outline=INK)
    elif kind == 3:  # fern
        for angle in (-65, -42, -20, 20, 42, 65):
            end_x = 48 + math.sin(math.radians(angle)) * 34
            end_y = 79 - math.cos(math.radians(angle)) * 46
            draw.line((48, 80, end_x, end_y), fill=GREEN_DARK, width=5)
            draw.ellipse((end_x-6, end_y-3, end_x+6, end_y+3), fill=GREEN_LIGHT)
    elif kind == 4:  # small ruin
        draw.rectangle((14, 54, 82, 78), fill=STONE, outline=INK, width=3)
        draw.rectangle((24, 30, 38, 69), fill=STONE_LIGHT, outline=INK, width=2)
        draw.rectangle((58, 22, 74, 69), fill=STONE_LIGHT, outline=INK, width=2)
        draw.ellipse((8, 68, 87, 84), fill=MOSS, outline=GREEN_DARK)
    else:  # fireflies
        for x, y in ((24, 48), (43, 29), (66, 54), (77, 35), (39, 66)):
            draw.ellipse((x-4, y-4, x+4, y+4), fill=GOLD_LIGHT, outline=GOLD)
            draw.ellipse((x-9, y-9, x+9, y+9), outline=(255, 231, 135, 95), width=2)
    return image


def make_preview(files: Iterable[str]) -> None:
    names = list(files)
    thumb_w, thumb_h = 240, 170
    preview = Image.new("RGB", (thumb_w * 4, thumb_h * math.ceil(len(names) / 4)), (43, 42, 36))
    for index, name in enumerate(names):
        source = Image.open(OUT / name).convert("RGBA")
        source.thumbnail((thumb_w - 20, thumb_h - 38), Image.Resampling.LANCZOS)
        cell = Image.new("RGBA", (thumb_w, thumb_h), (239, 226, 190, 255))
        x = (thumb_w - source.width) // 2
        y = 8 + (thumb_h - 38 - source.height) // 2
        cell.alpha_composite(source, (x, y))
        draw = ImageDraw.Draw(cell)
        draw.text((8, thumb_h - 25), name, fill=(40, 36, 29, 255))
        px = (index % 4) * thumb_w
        py = (index // 4) * thumb_h
        preview.paste(cell.convert("RGB"), (px, py))
    SOURCE_PREVIEW.parent.mkdir(parents=True, exist_ok=True)
    preview.save(SOURCE_PREVIEW)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    # This command intentionally resets the placeholder set. Normal hand-made
    # or image-model-refined assets should only use `npm run assets:sync`.
    for stale in OUT.glob("*.png"):
        stale.unlink()
    for stale_name in ("manifest.json",):
        stale = OUT / stale_name
        if stale.exists():
            stale.unlink()

    generated: list[str] = []

    for i in range(3):
        name = f"floor-{i+1:02d}.png"
        save(floor_tile(i), name); generated.append(name)
    for mask in range(16):
        name = f"path-{mask:02d}.png"
        save(path_overlay(mask), name); generated.append(name)
    save(fog_tile(), "fog.png"); generated.append("fog.png")
    for direction in ("northwest", "northeast", "southwest", "southeast"):
        name = f"wall-{direction}.png"
        save(wall(direction), name); generated.append(name)

    save(hero_token(), "hero.png"); generated.append("hero.png")
    save(dragon_token(), "dragon.png"); generated.append("dragon.png")
    save(entrance(), "entrance.png"); generated.append("entrance.png")

    rune_specs = [
        ("rune-vocabulary.png", "sword", RED),
        ("rune-comprehension.png", "shield", BLUE),
        ("rune-grammar.png", "target", GOLD),
        ("rune-pronunciation.png", "energy", PURPLE),
    ]
    for filename, symbol, color in rune_specs:
        save(pedestal(symbol, color), filename); generated.append(filename)

    for i in range(3):
        name = f"monster-{i+1:02d}.png"
        save(monster(i), name); generated.append(name)
    save(guardian(), "guardian.png"); generated.append("guardian.png")

    for i in range(4):
        name = f"trap-{i+1:02d}.png"
        save(trap(i), name); generated.append(name)

    for i in range(6):
        name = f"decoration-{i+1:02d}.png"
        save(decoration(i), name); generated.append(name)

    save(cache(False), "cache-closed.png"); generated.append("cache-closed.png")
    save(cache(True), "cache-open.png"); generated.append("cache-open.png")
    save(healing_fountain(), "healing-fountain.png"); generated.append("healing-fountain.png")
    save(reveal_obelisk(), "reveal-obelisk.png"); generated.append("reveal-obelisk.png")
    save(treasure(True), "treasure-locked.png"); generated.append("treasure-locked.png")
    save(treasure(False), "treasure-open.png"); generated.append("treasure-open.png")


    save(backdrop((1280, 720), encounter=False), "map-backdrop.png"); generated.append("map-backdrop.png")
    save(backdrop((1024, 360), encounter=True), "encounter-backdrop.png"); generated.append("encounter-backdrop.png")

    manifest = {
        "style": "simplified warm fantasy adventure placeholders",
        "runtimeRoot": "/assets/pixel/labyrinth/",
        "files": {
            name: list(Image.open(OUT / name).size) for name in generated
        },
        "notes": [
            "Preserve exact canvas dimensions when processing with an image model.",
            "Preserve transparency for all files except the two backdrops.",
            "Keep floor, path and fog assets as 2:1 isometric diamonds.",
            "Path files use bit masks: north=1, east=2, south=4, west=8.",
            "Keep tokens centered and clear of every canvas edge.",
            "The six decoration files are optional path-cell accents and should remain visually light."
        ]
    }
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf8")
    generated.append("manifest.json")

    readme = """# Labyrinth placeholder assets

These clean guide assets are runtime-ready but primarily designed as image-to-image inputs. Preserve every filename, exact canvas size and transparent background.

- `floor-*`, `path-*` and `fog.png` use a 256 x 128 isometric footprint.
- `path-00.png` through `path-15.png` encode exits with north=1, east=2, south=4 and west=8. Preserve the route geometry when refining them.
- Wall files are 256 x 192.
- Creature, event and decoration sizes are listed in `manifest.json`.
- `map-backdrop.png` and `encounter-backdrop.png` are the only intentionally opaque images.

Run `npm run assets:generate-labyrinth-placeholders` only to reset the placeholder set. After manual or image-model edits, run only `npm run assets:sync`.
"""
    (OUT / "README.md").write_text(readme, encoding="utf8")
    make_preview([name for name in generated if name.endswith(".png")])
    print(f"Generated {len(generated)} labyrinth assets in {OUT}")


if __name__ == "__main__":
    main()
