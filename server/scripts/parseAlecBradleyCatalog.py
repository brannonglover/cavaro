#!/usr/bin/env python3
"""
Scrape Alec Bradley catalog from alecbradley.com product pages.

Official pages include an isolated vertical "stick image" on white.

Writes:
  assets/alec-bradley/catalog.json
  tmp/alec-bradley/blend-images.json
  tmp/alec-bradley/processed/*.jpg
"""

from __future__ import annotations

import argparse
import re
import sys
import time
from html import unescape
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from catalogCommon import (  # noqa: E402
    clip_desc,
    download_blend_images,
    fetch_text,
    html_to_text,
    normalize_length,
    replace_frac,
    write_catalog,
)

REPO = Path(__file__).resolve().parents[2]
TMP = REPO / "tmp" / "alec-bradley"
ASSETS = REPO / "assets" / "alec-bradley"
SITE = "https://www.alecbradley.com"

# Keep lookups working for names already in cigars.json / user humidors.
NAME_ALIASES = {
    "Chunk Maduro": "Chunk",
}

SKIP_PATHS = {
    "/cigars",
    "/cigars/",
}

SIZE_RE = re.compile(
    r"(.+?)\s+[—–-]\s+(\d+(?:\s+\d/\d)?|\d+\s*[⅛¼⅜½⅝⅞]?)\s*[xX]\s*(\d{2,3})\s*$"
)


def load_page(path: str, refresh: bool) -> str:
    slug = path.strip("/").replace("/", "_") or "index"
    dest = TMP / f"{slug}.html"
    if dest.exists() and not refresh:
        return dest.read_text(encoding="utf-8", errors="ignore")
    print(f"  fetch {path}")
    html = fetch_text(SITE + path)
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(html, encoding="utf-8")
    time.sleep(0.15)
    return html


def cigar_paths(listing_html: str) -> list[str]:
    paths = []
    seen = set()
    for path in re.findall(r'href="(/cigars/[^"#?]+)"', listing_html):
        clean = path.rstrip("/")
        if clean in SKIP_PATHS or clean in seen:
            continue
        seen.add(clean)
        paths.append(clean)
    return paths


def parse_h1(html: str) -> str:
    m = re.search(r"<h1[^>]*>(.*?)</h1>", html, re.S | re.I)
    if not m:
        return ""
    return re.sub(r"\s+", " ", html_to_text(m.group(1))).strip()


def parse_blend(html: str) -> tuple[str, str, str]:
    def field(label: str) -> str:
        m = re.search(
            rf"<strong[^>]*>\s*{label}\s*:</strong>\s*([^<]+)",
            html,
            re.I,
        )
        return re.sub(r"\s+", " ", unescape(m.group(1))).strip(" .") if m else ""

    return field("Wrapper"), field("Binder"), field("Filler")


def parse_description(html: str) -> str:
    m = re.search(
        r'id="about".*?<p[^>]*>(.*?)</p>',
        html,
        re.S | re.I,
    )
    if m:
        return clip_desc(html_to_text(m.group(1)))
    m = re.search(
        r"About Alec Bradley[^<]*</span></h2>.*?<p[^>]*>(.*?)</p>",
        html,
        re.S | re.I,
    )
    if m:
        return clip_desc(html_to_text(m.group(1)))
    return ""


def parse_sizes(html: str) -> list[tuple[str, str]]:
    m = re.search(r"Available Sizes.*?<ul>(.*?)</ul>", html, re.S | re.I)
    if not m:
        return []
    rows = []
    seen = set()
    for item in re.findall(r"<li[^>]*>(.*?)</li>", m.group(1), re.S | re.I):
        text = replace_frac(html_to_text(item))
        text = re.sub(r"\s+", " ", text).strip()
        mm = SIZE_RE.match(text)
        if not mm:
            continue
        size_name = re.sub(r"\s+", " ", mm.group(1)).strip()
        length = normalize_length(mm.group(2), mm.group(3))
        key = (size_name.lower(), length)
        if key in seen:
            continue
        seen.add(key)
        rows.append((size_name, length))
    return rows


def cloudfront_original(url: str) -> str:
    m = re.search(r"(https://d25bsrltkk1hnl\.cloudfront\.net/[^?\s]+)", url)
    return m.group(1) if m else url


def stick_image_url(html: str) -> str:
    for tag in re.findall(r"<img\b[^>]*>", html, re.I):
        alt = re.search(r'alt="([^"]*)"', tag, re.I)
        src = re.search(r'src="([^"]+)"', tag, re.I)
        if not alt or not src:
            continue
        label = unescape(alt.group(1)).lower()
        if "stick image" in label and "binder" not in label:
            return cloudfront_original(unescape(src.group(1)))
    return ""


def build_catalog(refresh: bool) -> list[dict]:
    listing = load_page("/cigars", refresh)
    paths = cigar_paths(listing)
    print(f"Found {len(paths)} cigar pages")
    rows = []
    seen = set()
    for path in paths:
        html = load_page(path, refresh)
        name = NAME_ALIASES.get(parse_h1(html), parse_h1(html))
        if not name:
            print(f"  skip (no name): {path}")
            continue
        sizes = parse_sizes(html)
        if not sizes:
            print(f"  skip (no sizes): {path} ({name})")
            continue
        wrapper, binder, filler = parse_blend(html)
        desc = parse_description(html)
        image = stick_image_url(html)
        print(f"  {name}: {len(sizes)} sizes img={'yes' if image else 'NO'}")
        for size_name, length in sizes:
            key = (name.lower(), size_name.lower(), length)
            if key in seen:
                continue
            seen.add(key)
            rows.append(
                {
                    "brand": "Alec Bradley",
                    "name": name,
                    "line": name,
                    "description": desc,
                    "wrapper": wrapper,
                    "binder": binder,
                    "filler": filler,
                    "length": length,
                    "size_name": size_name,
                    "image": "",
                    "_source": SITE + path,
                    "_blend_image": image,
                }
            )
    rows.sort(key=lambda r: (r["name"].lower(), r["size_name"].lower(), r["length"]))
    return rows


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--refresh", action="store_true")
    parser.add_argument("--skip-images", action="store_true")
    args = parser.parse_args()

    TMP.mkdir(parents=True, exist_ok=True)
    print("Building Alec Bradley catalog…")
    catalog = build_catalog(args.refresh)
    print(f"Catalog rows: {len(catalog)}")

    blend_images = {}
    if not args.skip_images:
        print("Downloading / processing blend images…")
        blend_images = download_blend_images(catalog, TMP / "processed", TMP / "raw-images")

    write_catalog(catalog, ASSETS, TMP, blend_images if not args.skip_images else None)


if __name__ == "__main__":
    main()
