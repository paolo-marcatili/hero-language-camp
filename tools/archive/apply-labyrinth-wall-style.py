#!/usr/bin/env python3
"""Apply image-model stone texture to the canonical low single-edge wall masks.

The image model is allowed to invent surface detail, but it must never change the
maze geometry.  The existing transparent PNG is therefore used as the final
alpha/shape mask and as the low-frequency alignment guide.
"""
from __future__ import annotations

from pathlib import Path
from PIL import Image, ImageEnhance, ImageFilter, ImageOps

ROOT = Path(__file__).resolve().parents[1]
ASSET_DIR = ROOT / "asset-packs" / "cc0-pixel-v10" / "labyrinth"
SOURCE = ROOT / "asset-packs" / "cc0-pixel-v10" / "sources" / "labyrinth-wall-i2i-v012" / "wall-style-source.png"
NAMES = [
    "wall-northwest.png",
    "wall-northeast.png",
    "wall-southwest.png",
    "wall-southeast.png",
]


def quarter(image: Image.Image, index: int) -> Image.Image:
    w, h = image.size
    x = (index % 2) * (w // 2)
    y = (index // 2) * (h // 2)
    return image.crop((x, y, x + w // 2, y + h // 2))


def style_wall(base: Image.Image, source_crop: Image.Image) -> Image.Image:
    base = base.convert("RGBA")
    alpha = base.getchannel("A")

    # Resize and gently normalize the model output.  A broad blur removes the
    # unrelated invented silhouette while retaining its warm stone/plant color
    # vocabulary; a high-frequency layer restores subtle painterly texture.
    source_crop = ImageOps.fit(source_crop.convert("RGB"), base.size, method=Image.Resampling.LANCZOS)
    broad = source_crop.filter(ImageFilter.GaussianBlur(radius=9))
    detail = ImageEnhance.Contrast(source_crop).enhance(1.18)
    styled = Image.blend(broad, detail, 0.48)
    styled = ImageEnhance.Color(styled).enhance(0.88)
    styled = ImageEnhance.Brightness(styled).enhance(1.05)

    original_rgb = base.convert("RGB")
    # Preserve the original guide's shading and endpoint readability while
    # borrowing the hand-painted texture and warmer palette from the i2i pass.
    merged = Image.blend(original_rgb, styled, 0.38)
    merged = ImageEnhance.Contrast(merged).enhance(1.08)
    result = merged.convert("RGBA")
    result.putalpha(alpha)
    return result


def main() -> None:
    if not SOURCE.exists():
        raise SystemExit(f"Missing image-model source: {SOURCE}")
    model_sheet = Image.open(SOURCE)
    for index, name in enumerate(NAMES):
        path = ASSET_DIR / name
        if not path.exists():
            raise SystemExit(f"Missing wall guide: {path}")
        base = Image.open(path)
        if base.size != (256, 192):
            raise SystemExit(f"{name} must be 256x192, got {base.size}")
        result = style_wall(base, quarter(model_sheet, index))
        result.save(path)
        print(f"styled {path.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
