#!/usr/bin/env python3
"""Split the official Series JJ lineup photo into per-blend product images.

Reads:
  assets/my-father/sources/series-jj-lineup.png

Writes processed JPEGs to tmp/my-father/processed/ and updates blend-images.json
entries for the three Series JJ blends.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

import numpy as np
from PIL import Image

REPO = Path(__file__).resolve().parents[2]
SOURCE = REPO / "assets" / "my-father" / "sources" / "series-jj-lineup.png"
PROCESSED = REPO / "tmp" / "my-father" / "processed"
BLEND_IMAGES = REPO / "tmp" / "my-father" / "blend-images.json"
BG_RGB = (0x21, 0x19, 0x12)

BLENDS = [
    ("Don Pepin Garcia Series JJ", 0, 1 / 3),
    ("Don Pepin Garcia Series JJ Maduro", 1 / 3, 2 / 3),
    ("Don Pepin Garcia Series JJ 20th Anniversary Limited Edition", 2 / 3, 1.0),
]


def slugify(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", value.lower()).strip("_")


def subject_mask(rgb: np.ndarray) -> np.ndarray:
    r, g, b = rgb[:, :, 0].astype(int), rgb[:, :, 1].astype(int), rgb[:, :, 2].astype(int)
    white = (r > 235) & (g > 235) & (b > 235)
    gray = (np.abs(r - g) < 18) & (np.abs(g - b) < 18) & (r < 210)
    black = (r < 35) & (g < 35) & (b < 35)
    return ~(white | gray | black)


def stick_mask(rgb: np.ndarray) -> np.ndarray:
    r, g, b = rgb[:, :, 0].astype(int), rgb[:, :, 1].astype(int), rgb[:, :, 2].astype(int)
    white = (r > 235) & (g > 235) & (b > 235)
    gray = (np.abs(r - g) < 18) & (np.abs(g - b) < 18) & (r < 210)
    black = (r < 35) & (g < 35) & (b < 35)
    tobacco = (r > b + 8) & (g > b) & (r < 230)
    return tobacco & ~(white | gray | black)


def find_foot_row(sub_rgb: np.ndarray) -> int:
    widths = [int(stick_mask(sub_rgb[y : y + 1])[0].sum()) for y in range(sub_rgb.shape[0])]
    body_rows = [y for y, width in enumerate(widths) if width >= 20]
    if not body_rows:
        raise ValueError("could not locate cigar foot")
    return body_rows[-1]


def crop_column(arr: np.ndarray, x0: int, x1: int) -> tuple[int, int, int, int]:
    sub_rgb = arr[:, x0:x1]
    foot = find_foot_row(sub_rgb)

    xs_min: list[int] = []
    xs_max: list[int] = []
    ys: list[int] = []
    for y in range(0, foot + 1):
        cols = np.where(subject_mask(sub_rgb[y : y + 1])[0])[0]
        if cols.size == 0:
            continue
        width = int(cols.max() - cols.min() + 1)
        if width > 120:
            continue
        xs_min.append(int(cols.min()))
        xs_max.append(int(cols.max()))
        ys.append(y)

    if not xs_min:
        raise ValueError(f"no cigar content in column {x0}-{x1}")

    pad_x = max(8, int((max(xs_max) - min(xs_min)) * 0.06))
    pad_y = max(8, int((foot - min(ys)) * 0.02))
    left = x0 + max(0, min(xs_min) - pad_x)
    right = x0 + min(sub_rgb.shape[1], max(xs_max) + pad_x + 1)
    top = max(0, min(ys) - pad_y)
    bottom = min(arr.shape[0], foot + pad_y + 1)
    return left, top, right, bottom


def backdrop_mask(rgb: np.ndarray) -> np.ndarray:
    """Near-white pixels connected to the image border (studio backdrop only)."""
    h, w = rgb.shape[:2]
    r, g, b = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]
    near_white = (r > 230) & (g > 230) & (b > 230)

    bg = np.zeros((h, w), dtype=bool)
    stack: list[tuple[int, int]] = []

    for x in range(w):
        if near_white[0, x]:
            stack.append((0, x))
        if near_white[h - 1, x]:
            stack.append((h - 1, x))
    for y in range(h):
        if near_white[y, 0]:
            stack.append((y, 0))
        if near_white[y, w - 1]:
            stack.append((y, w - 1))

    while stack:
        y, x = stack.pop()
        if y < 0 or y >= h or x < 0 or x >= w or bg[y, x] or not near_white[y, x]:
            continue
        bg[y, x] = True
        stack.extend([(y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)])

    return bg


def subject_bbox_from_bg(bg: np.ndarray) -> tuple[int, int, int, int] | None:
    ys, xs = np.where(~bg)
    if ys.size == 0:
        return None
    return int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())


def recolor_and_crop(src: Path, dest: Path) -> None:
    """Key only edge-connected studio white; preserve label paper and foil."""
    rgb = np.array(Image.open(src).convert("RGB"))
    bg = backdrop_mask(rgb)
    out_arr = rgb.copy()
    out_arr[bg] = BG_RGB
    out = Image.fromarray(out_arr, "RGB")

    bounds = subject_bbox_from_bg(bg)
    if bounds:
        x0, y0, x1, y1 = bounds
        pad_x = max(8, int((x1 - x0) * 0.04))
        pad_y = max(8, int((y1 - y0) * 0.04))
        x0 = max(0, x0 - pad_x)
        y0 = max(0, y0 - pad_y)
        x1 = min(out.width - 1, x1 + pad_x)
        y1 = min(out.height - 1, y1 + pad_y)
        out = out.crop((x0, y0, x1 + 1, y1 + 1))
    out.save(dest, "JPEG", quality=95, optimize=True)


def main() -> None:
    if not SOURCE.exists():
        raise SystemExit(f"Missing lineup source: {SOURCE}")

    PROCESSED.mkdir(parents=True, exist_ok=True)
    BLEND_IMAGES.parent.mkdir(parents=True, exist_ok=True)

    im = Image.open(SOURCE).convert("RGB")
    arr = np.array(im)
    width = im.width

    blend_images = {}
    if BLEND_IMAGES.exists():
        blend_images = json.loads(BLEND_IMAGES.read_text())

    print(f"Processing {SOURCE.name} ({width}x{im.height})")
    for name, start_frac, end_frac in BLENDS:
        x0 = int(width * start_frac)
        x1 = int(width * end_frac)
        box = crop_column(arr, x0, x1)
        raw_path = PROCESSED / f"{slugify(name)}_raw.jpg"
        out_path = PROCESSED / f"{slugify(name)}.jpg"
        crop = arr[box[1] : box[3], box[0] : box[2]]
        Image.fromarray(crop).save(raw_path, "JPEG", quality=95)
        recolor_and_crop(raw_path, out_path)
        blend_images[name] = str(out_path)
        print(
            f"  ✓ {name}\n"
            f"    crop {box[2]-box[0]}x{box[3]-box[1]} → {out_path.relative_to(REPO)}"
        )

    BLEND_IMAGES.write_text(json.dumps(blend_images, indent=2, ensure_ascii=False) + "\n")
    print(f"Updated {BLEND_IMAGES.relative_to(REPO)}")


if __name__ == "__main__":
    main()
