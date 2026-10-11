#!/usr/bin/env python3
"""Import and normalize the 25-frame hero animation sheets.

The source animation files may be supplied as a directory or ZIP archive. Each
sheet is expected to contain a 5 x 5 frame grid. The importer preserves the
horizontal motion authored inside each cell, aligns the visible artwork to a
common bottom baseline, and writes game-ready RGBA sheets into the active asset
pack.

Usage:
    python tools/import-hero-animation-sheets.py
    python tools/import-hero-animation-sheets.py path/to/spritesheet.zip
    python tools/import-hero-animation-sheets.py path/to/folder
"""

from __future__ import annotations

import argparse
import json
import shutil
import tempfile
import zipfile
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PACK = ROOT / "asset-packs" / "cc0-pixel-v10"
DEFAULT_SOURCE = PACK / "sources" / "hero-animation-sheets"

GRID_COLUMNS = 5
GRID_ROWS = 5
EXPECTED_FRAMES = GRID_COLUMNS * GRID_ROWS
BOTTOM_PADDING = 12


@dataclass(frozen=True)
class AnimationSource:
    animation_id: str
    output_name: str
    accepted_names: tuple[str, ...]
    frame_rate: int
    repeat: int


ANIMATIONS: tuple[AnimationSource, ...] = (
    AnimationSource("walk", "hero-walk.png", ("Leo-walk-v1.png", "walk.png", "walking.png"), 16, -1),
    AnimationSource("attack1", "hero-attack-simple.png", ("Leo-attack-v1.png", "attack.png", "attack-simple.png"), 20, 0),
    AnimationSource("attack2", "hero-attack-swing.png", ("Leo-swing-v1.png", "swing.png", "attack-swing.png"), 20, 0),
    AnimationSource("fall", "hero-fall.png", ("Leo-fall-v1.png", "fall.png"), 16, 0),
    AnimationSource("energy", "hero-energy-ball.png", ("Leo-energy-v1.png", "energy.png", "energy-ball.png"), 16, -1),
    AnimationSource("parry", "hero-parry.png", ("Leo-block-v1.png", "block.png", "parry.png"), 16, 0),
    AnimationSource("victory", "hero-victory.png", ("Leo-victory-v1.png", "victory.png"), 16, 0),
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "source",
        nargs="?",
        type=Path,
        default=DEFAULT_SOURCE,
        help="Directory or ZIP containing the seven source sheets.",
    )
    parser.add_argument(
        "--pack",
        type=Path,
        default=PACK,
        help="Destination asset-pack directory.",
    )
    parser.add_argument(
        "--bottom-padding",
        type=int,
        default=BOTTOM_PADDING,
        help="Transparent pixels retained below the visible sprite.",
    )
    return parser.parse_args()




def safe_extract_zip(archive: zipfile.ZipFile, destination: Path) -> None:
    """Extract a ZIP without allowing files to escape the temp directory."""
    root = destination.resolve()
    for member in archive.infolist():
        target = (destination / member.filename).resolve()
        if target != root and root not in target.parents:
            raise ValueError(f"Unsafe path in ZIP archive: {member.filename}")
        # Reject Unix symlinks. The importer only needs regular PNG files.
        unix_mode = member.external_attr >> 16
        if (unix_mode & 0o170000) == 0o120000:
            raise ValueError(f"Symbolic links are not allowed in ZIP archive: {member.filename}")
        archive.extract(member, destination)


def visible_files(root: Path) -> Iterable[Path]:
    for path in root.rglob("*.png"):
        if path.name.startswith("._") or "__MACOSX" in path.parts:
            continue
        yield path


def locate_source(root: Path, names: tuple[str, ...]) -> Path:
    lookup = {path.name.casefold(): path for path in visible_files(root)}
    for name in names:
        candidate = lookup.get(name.casefold())
        if candidate is not None:
            return candidate
    expected = ", ".join(names)
    raise FileNotFoundError(f"Could not find animation sheet. Expected one of: {expected}")


def validate_sheet(image: Image.Image, source: Path) -> tuple[int, int]:
    width, height = image.size
    if width % GRID_COLUMNS != 0 or height % GRID_ROWS != 0:
        raise ValueError(
            f"{source.name}: {width}x{height} is not divisible by "
            f"the required {GRID_COLUMNS}x{GRID_ROWS} grid."
        )
    frame_width = width // GRID_COLUMNS
    frame_height = height // GRID_ROWS
    if frame_width != frame_height:
        raise ValueError(
            f"{source.name}: frames must be square; got {frame_width}x{frame_height}."
        )
    return frame_width, frame_height


def normalize_frame(frame: Image.Image, bottom_padding: int) -> Image.Image:
    frame = frame.convert("RGBA")
    alpha = frame.getchannel("A")
    bounds = alpha.getbbox()
    if bounds is None:
        raise ValueError("Encountered an empty animation frame.")

    frame_width, frame_height = frame.size
    target_bottom = frame_height - bottom_padding
    vertical_shift = target_bottom - bounds[3]

    normalized = Image.new("RGBA", frame.size, (0, 0, 0, 0))
    normalized.alpha_composite(frame, (0, vertical_shift))
    return normalized


def normalize_sheet(source: Path, destination: Path, bottom_padding: int) -> dict[str, int]:
    with Image.open(source) as opened:
        sheet = opened.convert("RGBA")

    frame_width, frame_height = validate_sheet(sheet, source)
    output = Image.new("RGBA", sheet.size, (0, 0, 0, 0))

    non_empty = 0
    for row in range(GRID_ROWS):
        for column in range(GRID_COLUMNS):
            left = column * frame_width
            top = row * frame_height
            frame = sheet.crop((left, top, left + frame_width, top + frame_height))
            normalized = normalize_frame(frame, bottom_padding)
            output.alpha_composite(normalized, (left, top))
            non_empty += 1

    if non_empty != EXPECTED_FRAMES:
        raise ValueError(f"{source.name}: expected {EXPECTED_FRAMES} frames, found {non_empty}.")

    destination.parent.mkdir(parents=True, exist_ok=True)
    output.save(destination, optimize=True)
    return {
        "width": output.width,
        "height": output.height,
        "frame_width": frame_width,
        "frame_height": frame_height,
        "columns": GRID_COLUMNS,
        "rows": GRID_ROWS,
        "frames": EXPECTED_FRAMES,
    }


def copy_original(source: Path, source_dir: Path) -> None:
    source_dir.mkdir(parents=True, exist_ok=True)
    destination = source_dir / source.name
    try:
        if source.resolve() == destination.resolve():
            return
    except FileNotFoundError:
        pass
    shutil.copy2(source, destination)


def write_preview(walk_sheet: Path, destination: Path, frame_width: int, frame_height: int) -> None:
    with Image.open(walk_sheet) as opened:
        frame = opened.convert("RGBA").crop((0, 0, frame_width, frame_height))
    destination.parent.mkdir(parents=True, exist_ok=True)
    frame.save(destination, optimize=True)


def import_from_directory(source_root: Path, pack: Path, bottom_padding: int) -> None:
    source_archive = pack / "sources" / "hero-animation-sheets"
    manifest: dict[str, object] = {
        "version": 1,
        "grid": {"columns": GRID_COLUMNS, "rows": GRID_ROWS, "frames": EXPECTED_FRAMES},
        "bottom_padding": bottom_padding,
        "animations": {},
    }

    dimensions: tuple[int, int] | None = None
    walk_destination: Path | None = None

    for animation in ANIMATIONS:
        source = locate_source(source_root, animation.accepted_names)
        copy_original(source, source_archive)
        destination = pack / animation.output_name
        metadata = normalize_sheet(source, destination, bottom_padding)

        current_dimensions = (metadata["frame_width"], metadata["frame_height"])
        if dimensions is None:
            dimensions = current_dimensions
        elif dimensions != current_dimensions:
            raise ValueError(
                f"All hero sheets must use the same frame size. "
                f"Expected {dimensions[0]}x{dimensions[1]}, got "
                f"{current_dimensions[0]}x{current_dimensions[1]} in {source.name}."
            )

        manifest["animations"][animation.animation_id] = {
            "file": animation.output_name,
            "source": source.name,
            "frame_rate": animation.frame_rate,
            "repeat": animation.repeat,
            **metadata,
        }
        if animation.animation_id == "walk":
            walk_destination = destination

    if dimensions is None or walk_destination is None:
        raise RuntimeError("No hero animation sheets were imported.")

    manifest["frame_width"] = dimensions[0]
    manifest["frame_height"] = dimensions[1]
    manifest_path = pack / "hero-animation-manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    write_preview(walk_destination, pack / "hero-preview.png", *dimensions)

    print(f"Imported {len(ANIMATIONS)} hero animation sheets into {pack}.")
    print(f"Frame grid: {GRID_COLUMNS}x{GRID_ROWS}; frame size: {dimensions[0]}x{dimensions[1]}.")
    print(f"Manifest: {manifest_path}")


def main() -> None:
    args = parse_args()
    source = args.source.expanduser().resolve()
    pack = args.pack.expanduser().resolve()

    if not source.exists():
        raise FileNotFoundError(f"Hero animation source not found: {source}")
    if args.bottom_padding < 0:
        raise ValueError("--bottom-padding must be non-negative.")

    if source.is_file():
        if source.suffix.casefold() != ".zip":
            raise ValueError("The source file must be a ZIP archive.")
        with tempfile.TemporaryDirectory(prefix="hlc-hero-sheets-") as temp_dir:
            with zipfile.ZipFile(source) as archive:
                safe_extract_zip(archive, Path(temp_dir))
            import_from_directory(Path(temp_dir), pack, args.bottom_padding)
    elif source.is_dir():
        import_from_directory(source, pack, args.bottom_padding)
    else:
        raise ValueError(f"Unsupported source: {source}")


if __name__ == "__main__":
    main()
