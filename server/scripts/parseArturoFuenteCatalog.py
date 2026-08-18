#!/usr/bin/env python3
"""
Scrape Arturo Fuente catalog from arturofuente.com (WP REST pages).

Writes:
  assets/arturo-fuente/catalog.json
  tmp/arturo-fuente/blend-images.json
  tmp/arturo-fuente/processed/*.jpg
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from html import unescape
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from catalogCommon import (  # noqa: E402
    clip_desc,
    decimal_inches_to_frac,
    download_blend_images,
    fetch_text,
    html_to_text,
    normalize_length,
    prefer_full_image,
    write_catalog,
)

REPO = Path(__file__).resolve().parents[2]
TMP = REPO / "tmp" / "arturo-fuente"
ASSETS = REPO / "assets" / "arturo-fuente"
PAGES_JSON = TMP / "wp-pages.json"
PAGES_API = "https://arturofuente.com/wp-json/wp/v2/pages?per_page=100"

SKIP_SLUGS = {"our-cigars", "opusx", "medium-filler"}

LINE_BY_SLUG = {
    "don-carlos": "Don Carlos",
    "hemingway": "Hemingway",
    "anejo": "Añejo",
    "chateau-fuente": "Chateau Fuente",
    "casa-cuba": "Casa Cuba",
    "magnumr": "Magnum R",
    "destino-al-siglo": "Destino al Siglo",
    "rare-pink": "Rare Pink",
    "gran2": "Gran Reserva",
    "forbidden-x": "OpusX",
    "angels-share": "OpusX",
    "ffox-20th": "OpusX",
    "oro-oscuro": "OpusX",
    "ff-opusx": "OpusX",
}

NAME_BY_SLUG = {
    "don-carlos": "Don Carlos",
    "hemingway": "Hemingway",
    "anejo": "Añejo",
    "chateau-fuente": "Chateau Fuente",
    "casa-cuba": "Casa Cuba",
    "magnumr": "Magnum R Rosado Sungrown",
    "destino-al-siglo": "Destino al Siglo",
    "rare-pink": "Rare Pink",
    "gran2": "Gran Reserva",
    "forbidden-x": "Forbidden X",
    "angels-share": "Angels Share",
    "ffox-20th": "Fuente Fuente OpusX 20th Anniversary",
    "oro-oscuro": "Oro Oscuro",
    "ff-opusx": "Fuente Fuente OpusX",
}

VITOLA_RE = re.compile(
    r"<h3[^>]*>(.*?)</h3>\s*"
    r"<p[^>]*>\s*Length:\s*([^<\(]+)\([^<]*\)\s*<br\s*/?>\s*"
    r"Ring Gauge:\s*([\d/]+)",
    re.I | re.S,
)


def parse_vitolas(html: str) -> list[tuple[str, str]]:
    rows = []
    seen = set()
    for m in VITOLA_RE.finditer(html):
        label = unescape(re.sub(r"<[^>]+>", " ", m.group(1)))
        label = re.sub(r"\s+", " ", label).strip()
        inches = decimal_inches_to_frac(m.group(2).replace('"', "").strip())
        ring = m.group(3).split("/")[-1]
        length = normalize_length(inches, ring)
        key = (label.lower(), length)
        if not label or key in seen:
            continue
        seen.add(key)
        rows.append((label, length))
    return rows


FUENTE_COMPONENTS = {
    "don-carlos": ("African Cameroon", "Dominican Republic", "Dominican Republic"),
    "hemingway": ("African Cameroon", "Dominican Republic", "Dominican Republic"),
    "anejo": ("Maduro (Cognac barrel-aged)", "Dominican Republic", "Dominican Republic"),
    "chateau-fuente": ("Cameroon", "Dominican Republic", "Dominican Republic"),
    "casa-cuba": ("Ecuadorian Havana", "Cuban-seed Dominican", "Cuban-seed Dominican"),
    "magnumr": ("Ecuadorian Rosado Sungrown", "Dominican Republic", "Dominican Republic"),
    "destino-al-siglo": ("Dominican Habano", "Dominican Republic", "Dominican Republic"),
    "rare-pink": ("Dominican Republic", "Dominican Republic", "Dominican Republic"),
    "gran2": ("African Cameroon", "Dominican Republic", "Dominican Republic"),
    "forbidden-x": ("Dominican Republic", "Dominican Republic", "Dominican Republic"),
    "angels-share": ("Dominican (middle priming)", "Dominican Republic", "Dominican Republic"),
    "ffox-20th": ("Dominican Republic", "Dominican Republic", "Dominican Republic"),
    "oro-oscuro": ("Dominican Republic", "Dominican Republic", "Dominican Republic"),
    "ff-opusx": ("Dominican Republic", "Dominican Republic", "Dominican Republic"),
}


def cigar_image_urls(html: str) -> list[str]:
    urls = []
    for raw in re.findall(
        r'(?:src|data-src)="(https://arturofuente.com/wp-content/uploads/[^"]+\.(?:png|jpg|jpeg|webp))"',
        html,
        re.I,
    ):
        url = prefer_full_image(unescape(raw))
        lower = url.lower()
        if any(tok in lower for tok in ("logo", "left-1", "banner", "family", "box")):
            continue
        if url not in urls:
            urls.append(url)
    return urls


def pick_blend_image(urls: list[str]) -> str:
    if not urls:
        return ""
    scored = []
    for url in urls:
        score = 0
        lower = url.lower()
        if lower.endswith(".png") or "cigar_" in lower:
            score += 4
        if "rob" in lower or "robusto" in lower:
            score += 3
        if "box" in lower:
            score -= 5
        scored.append((score, url))
    scored.sort(key=lambda x: -x[0])
    return scored[0][1]


def build_catalog(pages: list[dict]) -> list[dict]:
    rows = []
    seen = set()
    for page in pages:
        slug = page.get("slug") or ""
        link = page.get("link") or ""
        if "/our-cigars/" not in link or slug in SKIP_SLUGS:
            continue
        html = page.get("content", {}).get("rendered") or ""
        vitolas = parse_vitolas(html)
        if not vitolas:
            print(f"  skip (no vitolas): {link}")
            continue
        name = NAME_BY_SLUG.get(slug) or unescape(page.get("title", {}).get("rendered") or "").strip()
        line = LINE_BY_SLUG.get(slug, name)
        text = html_to_text(html)
        desc = clip_desc(text.split("Length:")[0] if "Length:" in text else text)
        wrapper, binder, filler = FUENTE_COMPONENTS.get(
            slug, ("", "Dominican Republic", "Dominican Republic")
        )
        images = cigar_image_urls(html)
        blend_image = pick_blend_image(images)
        print(f"  {name}: {len(vitolas)} sizes")
        for size_name, length in vitolas:
            key = (name.lower(), size_name.lower(), length)
            if key in seen:
                continue
            seen.add(key)
            rows.append(
                {
                    "brand": "Arturo Fuente",
                    "name": name,
                    "line": line,
                    "description": desc,
                    "wrapper": wrapper,
                    "binder": binder,
                    "filler": filler,
                    "length": length,
                    "size_name": size_name,
                    "image": "",
                    "_source": link,
                    "_blend_image": blend_image,
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
    if args.refresh or not PAGES_JSON.exists():
        print("Fetching Arturo Fuente WP pages…")
        PAGES_JSON.write_text(fetch_text(PAGES_API))
    else:
        print("Using cached WP pages JSON")

    pages = json.loads(PAGES_JSON.read_text())
    catalog = build_catalog(pages)
    print(f"Catalog rows: {len(catalog)}")

    blend_images = {}
    if not args.skip_images:
        print("Downloading / processing blend images…")
        blend_images = download_blend_images(catalog, TMP / "processed", TMP / "raw-images")

    write_catalog(catalog, ASSETS, TMP, blend_images if not args.skip_images else None)


if __name__ == "__main__":
    main()
