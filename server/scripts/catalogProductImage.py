#!/usr/bin/env python3
"""Process a single studio product photo onto the app background."""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
from PIL import Image

BG_RGB = (0x21, 0x19, 0x12)
MIN_OUTPUT_WIDTH = 120


def backdrop_mask_white(rgb: np.ndarray) -> np.ndarray:
    """Near-white pixels connected to the image border (studio backdrop only)."""
    h, w = rgb.shape[:2]
    r, g, b = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]
    candidate = (r > 230) & (g > 230) & (b > 230)
    return _edge_connected_mask(candidate)


def backdrop_mask_black(rgb: np.ndarray) -> np.ndarray:
    """Near-black pixels connected to the image border."""
    h, w = rgb.shape[:2]
    r, g, b = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]
    candidate = (r < 28) & (g < 28) & (b < 28)
    return _edge_connected_mask(candidate)


def _edge_connected_mask(candidate: np.ndarray) -> np.ndarray:
    h, w = candidate.shape
    bg = np.zeros((h, w), dtype=bool)
    stack: list[tuple[int, int]] = []

    for x in range(w):
        if candidate[0, x]:
            stack.append((0, x))
        if candidate[h - 1, x]:
            stack.append((h - 1, x))
    for y in range(h):
        if candidate[y, 0]:
            stack.append((y, 0))
        if candidate[y, w - 1]:
            stack.append((y, w - 1))

    while stack:
        y, x = stack.pop()
        if y < 0 or y >= h or x < 0 or x >= w or bg[y, x] or not candidate[y, x]:
            continue
        bg[y, x] = True
        stack.extend([(y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)])

    return bg


def bg_mask_for_rgb(rgb: np.ndarray) -> np.ndarray:
    white_bg = backdrop_mask_white(rgb)
    if white_bg.mean() > 0.01:
        return white_bg
    return backdrop_mask_black(rgb)


def load_rgb_and_bg_mask(src: Path) -> tuple[np.ndarray, np.ndarray]:
    im = Image.open(src)
    if im.mode in ("RGBA", "LA") or (im.mode == "P" and "transparency" in im.info):
        rgba = np.array(im.convert("RGBA"))
        rgb = rgba[:, :, :3]
        bg = rgba[:, :, 3] < 16
        if bg.mean() > 0.01:
            return rgb, bg

    rgb = np.array(im.convert("RGB"))
    return rgb, bg_mask_for_rgb(rgb)


def backdrop_mask(rgb: np.ndarray) -> np.ndarray:
    return backdrop_mask_white(rgb)


def subject_bbox(bg: np.ndarray) -> tuple[int, int, int, int] | None:
    ys, xs = np.where(~bg)
    if ys.size == 0:
        return None
    return int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())


def strip_corner_watermarks(rgb: np.ndarray, bg: np.ndarray) -> np.ndarray:
    """Drop light-gray retailer marks that sit on white backdrops."""
    h, w = rgb.shape[:2]
    r, g, b = rgb[:, :, 0].astype(int), rgb[:, :, 1].astype(int), rgb[:, :, 2].astype(int)
    corner = np.zeros((h, w), dtype=bool)
    corner[h * 3 // 4 :, : max(1, w // 3)] = True
    corner[h * 3 // 4 :, w * 2 // 3 :] = True
    gray = (
        (np.abs(r - g) < 24)
        & (np.abs(g - b) < 24)
        & (r > 150)
        & (r < 248)
    )
    out = bg.copy()
    out[corner & gray] = True
    return out


def orient_portrait(im: Image.Image) -> Image.Image:
    """Turn a sideways product shot upright with the head at the top."""
    if im.width > im.height * 1.05:
        return im.transpose(Image.Transpose.ROTATE_270)
    return im


def recolor_product_photo(src: Path, dest: Path, *, rotate: bool = False) -> None:
    """Key studio/cutout backgrounds onto the app surface; preserve label detail."""
    im = Image.open(src).convert("RGB")
    if rotate:
        im = orient_portrait(im)
    rgb = np.array(im)
    bg = bg_mask_for_rgb(rgb)
    bg = strip_corner_watermarks(rgb, bg)
    out_arr = rgb.copy()
    out_arr[bg] = BG_RGB
    out = Image.fromarray(out_arr, "RGB")

    bounds = subject_bbox(bg)
    if bounds:
        x0, y0, x1, y1 = bounds
        pad_x = max(8, int((x1 - x0) * 0.04))
        pad_y = max(8, int((y1 - y0) * 0.04))
        x0 = max(0, x0 - pad_x)
        y0 = max(0, y0 - pad_y)
        x1 = min(out.width - 1, x1 + pad_x)
        y1 = min(out.height - 1, y1 + pad_y)
        out = out.crop((x0, y0, x1 + 1, y1 + 1))
    if out.width < MIN_OUTPUT_WIDTH:
        scale = MIN_OUTPUT_WIDTH / out.width
        out = out.resize(
            (MIN_OUTPUT_WIDTH, max(1, round(out.height * scale))),
            Image.Resampling.LANCZOS,
        )
    dest.parent.mkdir(parents=True, exist_ok=True)
    out.save(dest, "JPEG", quality=98, subsampling=0, optimize=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("dest", type=Path)
    parser.add_argument(
        "--rotate",
        action="store_true",
        help="Rotate sideways studio shots upright (head at top)",
    )
    args = parser.parse_args()
    recolor_product_photo(args.source, args.dest, rotate=args.rotate)
    print(args.dest)


if __name__ == "__main__":
    main()
