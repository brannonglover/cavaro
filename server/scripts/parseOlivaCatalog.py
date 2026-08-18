#!/usr/bin/env python3
"""
Scrape Oliva catalog from olivacigar.com collection pages.

Cloudflare blocks default urllib UA; Chrome UA is required.

Writes:
  assets/oliva/catalog.json
  tmp/oliva/blend-images.json
  tmp/oliva/processed/*.jpg
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
    normalize_length,
    prefer_full_image,
    write_catalog,
)

REPO = Path(__file__).resolve().parents[2]
TMP = REPO / "tmp" / "oliva"
ASSETS = REPO / "assets" / "oliva"
SITE = "https://olivacigar.com"

COLLECTIONS = [
    ("/cigars/serie-v-melanio/", "Serie V Melanio", "Serie V Melanio"),
    ("/cigars/serie-v-melanio-maduro/", "Serie V Melanio Maduro", "Serie V Melanio"),
    ("/cigars/serie-v/", "Serie V", "Serie V"),
    ("/cigars/serie-v-maduro/", "Serie V Maduro", "Serie V"),
    ("/cigars/serie-o/", "Serie O", "Serie O"),
    ("/cigars/serie-o-maduro/", "Serie O Maduro", "Serie O"),
    ("/cigars/serie-g/", "Serie G", "Serie G"),
    ("/cigars/serie-6-maduro/", "Serie G Maduro", "Serie G"),
    ("/cigars/connecticut-reserve/", "Connecticut Reserve", "Connecticut Reserve"),
    ("/cigars/master-blends-3/", "Master Blends 3", "Master Blends 3"),
    ("/cigars/gilberto-reserva/", "Gilberto Reserva", "Gilberto Oliva"),
    ("/cigars/gilberto-blanc/", "Gilberto Blanc", "Gilberto Oliva"),
    ("/cigars/flor-de-oliva/", "Flor de Oliva", "Flor de Oliva"),
    ("/cigars/flor-corojo/", "Flor de Oliva Corojo", "Flor de Oliva"),
    ("/cigars/flor-gold/", "Flor de Oliva Gold", "Flor de Oliva"),
    ("/cigars/flor-maduro/", "Flor de Oliva Maduro", "Flor de Oliva"),
]

SIZE_RE = re.compile(
    r"<h3[^>]*>\s*(?:[A-Za-z][A-Za-z ]{0,20}?)?\s*"
    r"(\d+(?:\.\d+)?)\s*x\s*(\d{2,3})\s+([^<]+?)\s*</h3>",
    re.I,
)


def load_page(path: str, refresh: bool) -> str:
    slug = path.strip("/").replace("/", "_")
    dest = TMP / f"{slug}.html"
    if dest.exists() and not refresh:
        return dest.read_text(encoding="utf-8", errors="ignore")
    print(f"  fetch {path}")
    html = fetch_text(SITE + path)
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(html, encoding="utf-8")
    time.sleep(0.2)
    return html


def parse_sizes(html: str) -> list[tuple[str, str]]:
    rows = []
    seen = set()
    for m in SIZE_RE.finditer(html):
        label = re.sub(r"\s+", " ", unescape(m.group(3))).strip()
        if label.lower() in {"news", "press", "quick links", "more info", "contact us"}:
            continue
        length = normalize_length(m.group(1), m.group(2))
        key = (label.lower(), length)
        if key in seen:
            continue
        seen.add(key)
        rows.append((label, length))
    return rows


def parse_components(html: str) -> tuple[str, str, str]:
    matches = list(
        re.finditer(
            r"Wrapper</strong>\s*(?:&#8211;|–|-)\s*([^|<]+?)\s*\|\s*"
            r"<strong>Binder</strong>\s*(?:&#8211;|–|-)\s*([^|<]+?)\s*\|\s*"
            r"<strong>Filler</strong>\s*(?:&#8211;|–|-)\s*([^<]+)",
            html,
            re.I,
        )
    )
    if not matches:
        return "", "", ""
    m = matches[-1]
    return tuple(re.sub(r"\s+", " ", unescape(g)).strip(" .") for g in m.groups())


def parse_description(html: str) -> str:
    m = re.search(r'<meta property="og:description" content="([^"]+)"', html, re.I)
    if m:
        return clip_desc(unescape(m.group(1)))
    m = re.search(r'<meta name="description" content="([^"]+)"', html, re.I)
    if m:
        return clip_desc(unescape(m.group(1)))
    return ""


def cigar_image_url(html: str) -> str:
    urls = []
    for raw in re.findall(
        r'(?:src|data-src)="(https://olivacigar.com/wp-content/uploads/[^"]+\.(?:jpg|jpeg|png|webp))"',
        html,
        re.I,
    ):
        url = prefer_full_image(unescape(raw))
        lower = url.lower()
        if any(tok in lower for tok in ("logo", "favicon", "banner", "icon")):
            continue
        urls.append(url)
    if not urls:
        return ""
    scored = []
    for url in urls:
        score = 0
        lower = url.lower()
        if "robusto" in lower:
            score += 5
        if re.search(r"\d+x\d+", lower):
            score += 2
        if "box" in lower:
            score -= 3
        scored.append((score, url))
    scored.sort(key=lambda x: -x[0])
    return scored[0][1]


def build_catalog(refresh: bool) -> list[dict]:
    rows = []
    seen = set()
    for path, name, line in COLLECTIONS:
        html = load_page(path, refresh)
        sizes = parse_sizes(html)
        if not sizes:
            print(f"  skip (no sizes): {path}")
            continue
        wrapper, binder, filler = parse_components(html)
        desc = parse_description(html)
        image = cigar_image_url(html)
        print(f"  {name}: {len(sizes)} sizes")
        for size_name, length in sizes:
            key = (name.lower(), size_name.lower(), length)
            if key in seen:
                continue
            seen.add(key)
            rows.append(
                {
                    "brand": "Oliva",
                    "name": name,
                    "line": line,
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
    rows.sort(key=lambda r: (r["line"].lower(), r["name"].lower(), r["size_name"].lower(), r["length"]))
    return rows


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--refresh", action="store_true")
    parser.add_argument("--skip-images", action="store_true")
    args = parser.parse_args()

    TMP.mkdir(parents=True, exist_ok=True)
    print("Building Oliva catalog…")
    catalog = build_catalog(args.refresh or not any(TMP.glob("cigars_*.html")))
    print(f"Catalog rows: {len(catalog)}")

    blend_images = {}
    if not args.skip_images:
        print("Downloading / processing blend images…")
        blend_images = download_blend_images(catalog, TMP / "processed", TMP / "raw-images")

    write_catalog(catalog, ASSETS, TMP, blend_images if not args.skip_images else None)


if __name__ == "__main__":
    main()
