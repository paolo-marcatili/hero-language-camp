#!/usr/bin/env python3
"""Build the side-scroller monster spritesheet from transparent source cutouts.

The runtime layout is fixed and intentionally simple:

- 6 rows: goblin, bat, troll, dragon, wizard, blob
- 4 columns: idle, hurt, attack, defeated
- 96 x 96 pixels per frame
- transparent RGBA output

The six source cutouts live in:
asset-packs/cc0-pixel-v10/sources/monster-art/cutouts/

This script uses Pillow only. Artists can replace any cutout with a refined
transparent PNG and regenerate the complete sheet without changing Phaser code.
"""

from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageOps

ROOT = Path(__file__).resolve().parents[1]
ASSET_ROOT = ROOT / "asset-packs" / "cc0-pixel-v10"
SOURCE_ROOT = ASSET_ROOT / "sources" / "monster-art" / "cutouts"
OUTPUT = ASSET_ROOT / "monsters.png"
PREVIEW = ASSET_ROOT / "sources" / "monster-art" / "monsters-preview.png"

FRAME_SIZE = 96
ROWS = ("goblin", "bat", "troll", "dragon", "wizard", "blob")


def alpha_bbox(image: Image.Image):
    return image.getchannel("A").getbbox()


def trim(image: Image.Image) -> Image.Image:
    bbox = alpha_bbox(image)
    return image.crop(bbox) if bbox else image


def fit_base(image: Image.Image, max_width: int = 78, max_height: int = 82) -> Image.Image:
    image = trim(image.convert("RGBA"))
    return ImageOps.contain(image, (max_width, max_height), Image.Resampling.LANCZOS)


def composite_grounded(
    canvas: Image.Image,
    image: Image.Image,
    *,
    dx: int = 0,
    dy: int = 0,
    bottom: int = 91,
) -> None:
    x = (FRAME_SIZE - image.width) // 2 + dx
    y = bottom - image.height + dy
    canvas.alpha_composite(image, (x, y))


def add_shadow(
    canvas: Image.Image,
    center_x: int = 48,
    y: int = 90,
    rx: int = 25,
    ry: int = 4,
    alpha: int = 72,
) -> None:
    shadow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(shadow)
    draw.ellipse(
        (center_x - rx, y - ry, center_x + rx, y + ry),
        fill=(35, 24, 18, alpha),
    )
    shadow = shadow.filter(ImageFilter.GaussianBlur(2.0))
    canvas.alpha_composite(shadow)


def tint(image: Image.Image, color=(255, 72, 72), amount: float = 0.32) -> Image.Image:
    base = image.convert("RGBA")
    overlay = Image.new("RGBA", base.size, color + (0,))
    overlay.putalpha(base.getchannel("A"))
    return Image.blend(base, overlay, amount)


def draw_star(draw: ImageDraw.ImageDraw, cx: float, cy: float, outer: float, inner: float) -> None:
    points = []
    for index in range(12):
        radius = outer if index % 2 == 0 else inner
        angle = math.radians(index * 30 - 90)
        points.append((cx + math.cos(angle) * radius, cy + math.sin(angle) * radius))
    draw.polygon(points, fill=(255, 235, 130, 235), outline=(255, 130, 80, 255))


def draw_motion_arc(
    canvas: Image.Image,
    color=(245, 245, 255, 220),
    start: int = 170,
    end: int = 350,
    box=(5, 22, 58, 76),
    width: int = 5,
) -> None:
    draw = ImageDraw.Draw(canvas)
    draw.arc(box, start=start, end=end, fill=color, width=width)
    inner = (box[0] + 3, box[1] + 3, box[2] - 3, box[3] - 3)
    draw.arc(
        inner,
        start=start,
        end=end,
        fill=(255, 255, 255, 150),
        width=max(1, width - 3),
    )


def make_idle(base: Image.Image) -> Image.Image:
    canvas = Image.new("RGBA", (FRAME_SIZE, FRAME_SIZE), (0, 0, 0, 0))
    add_shadow(canvas)
    composite_grounded(canvas, base)
    return canvas


def make_hurt(base: Image.Image) -> Image.Image:
    canvas = Image.new("RGBA", (FRAME_SIZE, FRAME_SIZE), (0, 0, 0, 0))
    add_shadow(canvas, center_x=51, alpha=65)
    pose = tint(base).rotate(-7, resample=Image.Resampling.BICUBIC, expand=True)
    composite_grounded(canvas, pose, dx=4, dy=1)
    draw_star(ImageDraw.Draw(canvas), 20, 30, 8, 3)
    return canvas


def make_attack(name: str, base: Image.Image) -> Image.Image:
    canvas = Image.new("RGBA", (FRAME_SIZE, FRAME_SIZE), (0, 0, 0, 0))
    add_shadow(canvas, center_x=44, rx=27, alpha=70)

    pose = base.resize(
        (round(base.width * 1.06), round(base.height * 1.06)),
        Image.Resampling.LANCZOS,
    )
    pose = pose.rotate(4, resample=Image.Resampling.BICUBIC, expand=True)
    attack_dx = 1 if name == "bat" else -4
    composite_grounded(canvas, pose, dx=attack_dx)

    if name == "goblin":
        draw_motion_arc(canvas, (230, 240, 255, 235), 145, 315, (4, 20, 64, 82), 6)
    elif name == "bat":
        draw_motion_arc(canvas, (180, 100, 255, 210), 120, 300, (3, 15, 65, 86), 7)
    elif name == "troll":
        draw_motion_arc(canvas, (180, 220, 255, 190), 135, 305, (3, 25, 61, 85), 8)
    elif name == "dragon":
        draw = ImageDraw.Draw(canvas)
        draw.polygon(
            [(8, 48), (35, 34), (32, 47), (46, 51), (31, 57), (34, 69)],
            fill=(255, 128, 40, 220),
        )
        draw.polygon(
            [(4, 49), (28, 42), (26, 50), (36, 52), (25, 56), (28, 63)],
            fill=(255, 232, 85, 240),
        )
    elif name == "wizard":
        orb = Image.new("RGBA", (34, 34), (0, 0, 0, 0))
        draw = ImageDraw.Draw(orb)
        draw.ellipse((4, 4, 30, 30), fill=(140, 70, 255, 105))
        draw.ellipse((8, 8, 26, 26), fill=(180, 115, 255, 210))
        draw.ellipse((12, 12, 22, 22), fill=(245, 230, 255, 245))
        orb = orb.filter(ImageFilter.GaussianBlur(2))
        canvas.alpha_composite(orb, (4, 28))
    elif name == "blob":
        draw = ImageDraw.Draw(canvas)
        for x, y, radius in ((12, 42, 5), (20, 31, 3), (26, 56, 4), (5, 58, 3)):
            draw.ellipse(
                (x - radius, y - radius, x + radius, y + radius),
                fill=(150, 220, 55, 220),
                outline=(80, 130, 30, 220),
            )

    return canvas


def make_defeated(base: Image.Image) -> Image.Image:
    canvas = Image.new("RGBA", (FRAME_SIZE, FRAME_SIZE), (0, 0, 0, 0))
    add_shadow(canvas, center_x=48, y=91, rx=32, ry=5, alpha=75)

    pose = ImageEnhance.Color(base).enhance(0.45)
    pose = ImageEnhance.Brightness(pose).enhance(0.8)
    pose = pose.rotate(72, resample=Image.Resampling.BICUBIC, expand=True)
    pose = ImageOps.contain(pose, (82, 65), Image.Resampling.LANCZOS)
    composite_grounded(canvas, pose, dy=4, bottom=91)

    draw = ImageDraw.Draw(canvas)
    for cx, cy in ((35, 23), (49, 18), (61, 25)):
        points = []
        for index in range(10):
            radius = 4 if index % 2 == 0 else 1.8
            angle = math.radians(index * 36 - 90)
            points.append((cx + math.cos(angle) * radius, cy + math.sin(angle) * radius))
        draw.polygon(points, fill=(255, 226, 90, 220))

    return canvas


def create_checker_preview(sheet: Image.Image) -> Image.Image:
    scale = 2
    preview = Image.new(
        "RGBA",
        (sheet.width * scale, sheet.height * scale),
        (0, 0, 0, 0),
    )
    draw = ImageDraw.Draw(preview)
    cell = 24
    for y in range(0, preview.height, cell):
        for x in range(0, preview.width, cell):
            fill = (220, 220, 220, 255) if (x // cell + y // cell) % 2 == 0 else (170, 170, 170, 255)
            draw.rectangle((x, y, x + cell - 1, y + cell - 1), fill=fill)
    preview.alpha_composite(sheet.resize(preview.size, Image.Resampling.NEAREST))
    return preview


def main() -> None:
    sheet = Image.new(
        "RGBA",
        (FRAME_SIZE * 4, FRAME_SIZE * len(ROWS)),
        (0, 0, 0, 0),
    )

    for row, name in enumerate(ROWS):
        source_path = SOURCE_ROOT / f"{name}.png"
        if not source_path.exists():
            raise FileNotFoundError(f"Missing monster cutout: {source_path}")

        base = fit_base(Image.open(source_path).convert("RGBA"))
        frames = (
            make_idle(base),
            make_hurt(base),
            make_attack(name, base),
            make_defeated(base),
        )

        for column, frame in enumerate(frames):
            sheet.alpha_composite(frame, (column * FRAME_SIZE, row * FRAME_SIZE))

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    PREVIEW.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(OUTPUT)
    create_checker_preview(sheet).save(PREVIEW)

    print(f"Wrote {OUTPUT.relative_to(ROOT)} ({sheet.width}x{sheet.height})")
    print(f"Wrote {PREVIEW.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
