#!/usr/bin/env python3
"""Import and normalize the 25-frame dragon companion animation sheets.

The source may be a directory or ZIP archive. Each animation sheet must use a
5 x 5 grid of square frames. The importer preserves horizontal motion, aligns
visible artwork to a common lower baseline, and writes transparent game-ready
sheets into the active asset pack.

Usage:
    python tools/import-companion-animation-sheets.py
    python tools/import-companion-animation-sheets.py path/to/dragon-sheets.zip
    python tools/import-companion-animation-sheets.py path/to/folder
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
DEFAULT_SOURCE = PACK / "sources" / "companion-animation-sheets"

GRID_COLUMNS = 5
GRID_ROWS = 5
EXPECTED_FRAMES = GRID_COLUMNS * GRID_ROWS
BOTTOM_PADDING = 10


@dataclass(frozen=True)
class AnimationSource:
    animation_id: str
    output_name: str
    accepted_names: tuple[str, ...]
    frame_rate: int
    repeat: int


ANIMATIONS: tuple[AnimationSource, ...] = (
    AnimationSource(
        "walk",
        "companion-dragon-walk.png",
        ("dragon-walk.png", "companion-dragon-walk.png", "walk.png", "walking.png"),
        14,
        -1,
    ),
    AnimationSource(
        "victory",
        "companion-dragon-victory.png",
        ("dragon-victory.png", "companion-dragon-victory.png", "victory.png", "cheer.png"),
        14,
        0,
    ),
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "source",
        nargs="?",
        type=Path,
        default=DEFAULT_SOURCE,
        help="Directory or ZIP containing dragon-walk and dragon-victory sheets.",
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
        help="Transparent pixels retained below the visible companion.",
    )
    return parser.parse_args()


def safe_extract_zip(archive: zipfile.ZipFile, destination: Path) -> None:
    root = destination.resolve()
    for member in archive.infolist():
        target = (destination / member.filename).resolve()
        if target != root and root not in target.parents:
            raise ValueError(f"Unsafe path in ZIP archive: {member.filename}")
        unix_mode = member.external_attr >> 16
        if (unix_mode & 0o170000) == 0o120000:
            raise ValueError(f"Symbolic links are not allowed: {member.filename}")
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
    raise FileNotFoundError(f"Could not find companion sheet. Expected one of: {', '.join(names)}")


def validate_sheet(image: Image.Image, source: Path) -> tuple[int, int]:
    width, height = image.size
    if width % GRID_COLUMNS != 0 or height % GRID_ROWS != 0:
        raise ValueError(
            f"{source.name}: {width}x{height} is not divisible by the required "
            f"{GRID_COLUMNS}x{GRID_ROWS} grid."
        )
    frame_width = width // GRID_COLUMNS
    frame_height = height // GRID_ROWS
    if frame_width != frame_height:
        raise ValueError(f"{source.name}: frames must be square; got {frame_width}x{frame_height}.")
    return frame_width, frame_height


def normalize_frame(frame: Image.Image, bottom_padding: int) -> Image.Image:
    rgba = frame.convert("RGBA")
    bounds = rgba.getchannel("A").getbbox()
    if bounds is None:
        raise ValueError("Encountered an empty companion animation frame.")

    target_bottom = rgba.height - bottom_padding
    vertical_shift = target_bottom - bounds[3]
    normalized = Image.new("RGBA", rgba.size, (0, 0, 0, 0))
    normalized.alpha_composite(rgba, (0, vertical_shift))
    return normalized


def normalize_sheet(source: Path, destination: Path, bottom_padding: int) -> dict[str, int]:
    with Image.open(source) as opened:
        sheet = opened.convert("RGBA")

    frame_width, frame_height = validate_sheet(sheet, source)
    output = Image.new("RGBA", sheet.size, (0, 0, 0, 0))

    frame_count = 0
    for row in range(GRID_ROWS):
        for column in range(GRID_COLUMNS):
            left = column * frame_width
            top = row * frame_height
            frame = sheet.crop((left, top, left + frame_width, top + frame_height))
            output.alpha_composite(normalize_frame(frame, bottom_padding), (left, top))
            frame_count += 1

    if frame_count != EXPECTED_FRAMES:
        raise ValueError(f"{source.name}: expected {EXPECTED_FRAMES} frames, found {frame_count}.")

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
    source_archive = pack / "sources" / "companion-animation-sheets"
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
                "All companion sheets must use the same frame size. "
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
        raise RuntimeError("No companion animation sheets were imported.")

    manifest["frame_width"] = dimensions[0]
    manifest["frame_height"] = dimensions[1]
    manifest_path = pack / "companion-animation-manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    write_preview(walk_destination, pack / "companion-preview.png", *dimensions)

    print(f"Imported {len(ANIMATIONS)} companion animation sheets into {pack}.")
    print(f"Frame grid: {GRID_COLUMNS}x{GRID_ROWS}; frame size: {dimensions[0]}x{dimensions[1]}.")
    print(f"Manifest: {manifest_path}")


def main() -> None:
    args = parse_args()
    source = args.source.expanduser().resolve()
    pack = args.pack.expanduser().resolve()

    if not source.exists():
        raise FileNotFoundError(f"Companion animation source not found: {source}")
    if args.bottom_padding < 0:
        raise ValueError("--bottom-padding must be non-negative.")

    if source.is_file():
        if source.suffix.casefold() != ".zip":
            raise ValueError("The source file must be a ZIP archive.")
        with tempfile.TemporaryDirectory(prefix="hlc-companion-sheets-") as temp_dir:
            with zipfile.ZipFile(source) as archive:
                safe_extract_zip(archive, Path(temp_dir))
            import_from_directory(Path(temp_dir), pack, args.bottom_padding)
    elif source.is_dir():
        import_from_directory(source, pack, args.bottom_padding)
    else:
        raise ValueError(f"Unsupported source: {source}")


if __name__ == "__main__":
    main()
