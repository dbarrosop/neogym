#!/usr/bin/env python3
"""Generate/check the deterministic DEV-badged app icon using fixed geometry."""

from __future__ import annotations

import argparse
import importlib
import sys
from pathlib import Path


def image_modules():
    try:
        image = importlib.import_module("PIL.Image")
        draw = importlib.import_module("PIL.ImageDraw")
    except ImportError as error:  # pragma: no cover - toolchain failure
        raise RuntimeError(
            "Pillow is unavailable; run through the Nix devshell"
        ) from error
    return image, draw


def generated_image(source: Path):
    image_module, draw_module = image_modules()
    base = image_module.open(source).convert("RGBA")
    if base.size != (1024, 1024):
        raise RuntimeError("production icon must be 1024 by 1024 pixels")

    badge = image_module.new("RGBA", base.size, (0, 0, 0, 0))
    drawing = draw_module.Draw(badge)
    drawing.rectangle((0, 744, 1024, 1024), fill=(136, 20, 32, 238))

    # Fixed block-letter geometry; no host fonts, locale, or font rendering.
    white = (255, 255, 255, 255)
    width = 34
    top, bottom = 790, 970
    # D
    drawing.rectangle((142, top, 142 + width, bottom), fill=white)
    drawing.rectangle((142, top, 266, top + width), fill=white)
    drawing.rectangle((142, bottom - width, 266, bottom), fill=white)
    drawing.rectangle((250, top + 22, 284, bottom - 22), fill=white)
    # E
    drawing.rectangle((382, top, 382 + width, bottom), fill=white)
    drawing.rectangle((382, top, 524, top + width), fill=white)
    drawing.rectangle((382, 862, 506, 896), fill=white)
    drawing.rectangle((382, bottom - width, 524, bottom), fill=white)
    # V
    drawing.polygon(((616, top), (654, top), (720, bottom), (683, bottom)), fill=white)
    drawing.polygon(((782, top), (820, top), (721, bottom), (684, bottom)), fill=white)

    return image_module.alpha_composite(base, badge).convert("RGB")


def images_equal(expected, path: Path) -> bool:
    image_module, _ = image_modules()
    if not path.is_file():
        return False
    actual = image_module.open(path).convert("RGB")
    return actual.size == expected.size and actual.tobytes() == expected.tobytes()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--source",
        type=Path,
        default=Path("App/Assets.xcassets/AppIcon.appiconset/AppIcon-1024.png"),
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("App/Assets.xcassets/AppIconDev.appiconset/AppIconDev-1024.png"),
    )
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args(argv)

    try:
        expected = generated_image(args.source)
        if args.check:
            if not images_equal(expected, args.output):
                print("development icon drift detected", file=sys.stderr)
                return 1
        else:
            args.output.parent.mkdir(parents=True, exist_ok=True)
            expected.save(args.output, format="PNG", optimize=False, compress_level=9)
    except (OSError, RuntimeError):
        print("development icon generation failed", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
