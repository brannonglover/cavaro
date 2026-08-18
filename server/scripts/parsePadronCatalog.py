#!/usr/bin/env python3
"""
Scrape Padrón catalog from padron.com (WP REST series pages).

Natural and Maduro of the same size are separate `name`s so unique indexes
do not collide.

Writes:
  assets/padron/catalog.json
  tmp/padron/blend-images.json
  tmp/padron/processed/*.jpg
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
    download_blend_images,
    fetch_text,
    html_to_text,
    normalize_length,
    prefer_full_image,
    replace_frac,
    write_catalog,
)

REPO = Path(__file__).resolve().parents[2]
TMP = REPO / "tmp" / "padron"
ASSETS = REPO / "assets" / "padron"
PAGES_JSON = TMP / "wp-pages.json"
PAGES_API = "https://padron.com/wp-json/wp/v2/pages?per_page=100"

SERIES_SLUGS = {
    "padron-series": ("Padrón Series", True),
    "padron-1926-serie": ("Padrón 1926 Serie", True),
    "padron-1964-anniversary-series": ("Padrón 1964 Anniversary", True),
    "padron-family-reserve": ("Padrón Family Reserve", True),
    "damaso-series": ("Dámaso", False),
    "padron-no-97": ("Padrón No. 97", True),
    "padron-no-99": ("Padrón No. 99", True),
    "60th-anniversary": ("Padrón 60th Anniversary", True),
}

DIM_RE = re.compile(r"^(\d{2})\s*x\s*(\d+(?:\s+\d+/\d+)?)$")
INLINE_DIM_RE = re.compile(r"(\d{2})\s*x\s*(\d+(?:\s+\d+/\d+)?)")
RATING_RE = re.compile(r"\b(?:CA|CI)\s+[A-Z][a-z]{2}\s+\d{2}\s*[–-]\s*\d{2}")
SKIP_LABELS = {
    "cigar selection",
    "padron series",
    "padrón series",
    "padrón 1926 serie",
    "padrón 1964 anniversary series",
    "padron family reserve",
    "dámaso series",
    "damaso series",
}


def text_editors(html: str) -> list[str]:
    chunks = []
    for raw in re.findall(
        r'class="[^"]*text-editor[^"]*"[^>]*>(.*?)</div>',
        html,
        re.S | re.I,
    ):
        t = replace_frac(unescape(re.sub(r"<[^>]+>", " ", raw)))
        t = re.sub(r"\s+", " ", t).strip()
        if t:
            chunks.append(t)
    return chunks


def parse_vitolas(html: str) -> list[tuple[str, str]]:
    chunks = text_editors(html)
    rows = []
    seen = set()
    for i, chunk in enumerate(chunks):
        m = DIM_RE.match(chunk)
        if not m or i == 0:
            continue
        label = chunks[i - 1]
        if DIM_RE.match(label) or label.lower() in SKIP_LABELS:
            continue
        if label.lower().startswith("available in"):
            continue
        if re.match(r"^(CA|CI)\b", label):
            continue
        if "box" in label.lower() or "count" in label.lower():
            continue
        if len(label) > 40:
            continue
        ring, inches = m.group(1), m.group(2)
        length = normalize_length(inches, ring)
        key = (label.lower(), length)
        if key in seen:
            continue
        seen.add(key)
        rows.append((label, length))
    if not rows:
        for chunk in chunks:
            m = re.search(r"(\d{2})\s*x\s*(\d+\s+\d+/\d+)", chunk)
            if not m:
                m = re.search(r"(\d{2})\s*x\s*([4-9](?:\s+\d+/\d+)?)\b", chunk)
            if not m:
                continue
            ring, inches = m.group(1), m.group(2)
            length = normalize_length(inches, ring)
            if any(length == existing for _, existing in rows):
                continue
            rows.append(("60th Anniversary", length))
    return rows


def is_noise_chunk(chunk: str) -> bool:
    lower = chunk.lower()
    if len(chunk) < 80:
        return True
    if DIM_RE.match(chunk):
        return True
    if RATING_RE.search(chunk) and len(RATING_RE.findall(chunk)) >= 2:
        return True
    if "count box" in lower and (len(chunk) < 200 or "." not in chunk):
        return True
    if lower in SKIP_LABELS or lower == "cigar selection":
        return True
    if "cigar of the year" in lower and len(chunk) < 120:
        return True
    if lower.startswith(("natural wrapper", "maduro wrapper")):
        return True
    return False


def series_description(html: str, title: str) -> str:
    chunks = [c for c in text_editors(html) if not is_noise_chunk(c)]
    if not chunks:
        return ""
    chunk = max(chunks, key=len)
    chunk = re.sub(r"^(?:Cigar Selection\s+)+", "", chunk, flags=re.I).strip()
    long_prefix = f"{title} Cigar Selection"
    if title and chunk.lower().startswith(long_prefix.lower()):
        chunk = chunk[len(long_prefix) :].strip(" -–")
    return clip_desc(chunk)


def cigar_image_url(html: str) -> str:
    urls = []
    for raw in re.findall(
        r'(?:src|data-src)="(https://padron.com/wp-content/uploads/[^"]+\.(?:jpg|jpeg|png|webp))"',
        html,
        re.I,
    ):
        url = prefer_full_image(unescape(raw))
        lower = url.lower()
        if any(tok in lower for tok in ("box", "open", "closed", "logo", "humidor", "pack")):
            continue
        if url not in urls:
            urls.append(url)
    return urls[0] if urls else ""


def wrappers_for_page(html: str, split_natural_maduro: bool) -> list[tuple[str, str]]:
    text = html_to_text(html).lower()
    if not split_natural_maduro:
        wrapper = (
            "Ecuadorian Connecticut"
            if "connecticut" in text or "dámaso" in text or "damaso" in text
            else ""
        )
        return [("", wrapper)]
    if "natural and maduro" in text or ("natural" in text and "maduro" in text):
        return [("Natural", "Natural"), ("Maduro", "Maduro")]
    return [("", "")]


def blend_components(line: str, wrapper_label: str, html: str) -> tuple[str, str, str]:
    """
    Padrón's site names wrapper style (sun-grown natural / maduro; Dámaso Connecticut)
    but not binder/filler. Those lines are Nicaraguan puros from their vertically
    integrated farms, except Dámaso's Ecuadorian Connecticut wrapper.
    """
    text = html_to_text(html).lower()
    if line == "Dámaso" or "ecuadorian connecticut" in text:
        return "Ecuadorian Connecticut", "Nicaragua", "Nicaragua"
    if wrapper_label == "Maduro":
        return "Nicaraguan Maduro", "Nicaragua", "Nicaragua"
    if wrapper_label == "Natural":
        return "Nicaraguan Sun Grown", "Nicaragua", "Nicaragua"
    if wrapper_label:
        return wrapper_label, "Nicaragua", "Nicaragua"
    return "", "Nicaragua", "Nicaragua"


def build_catalog(pages: list[dict]) -> list[dict]:
    rows = []
    seen = set()
    for page in pages:
        slug = page.get("slug") or ""
        if slug not in SERIES_SLUGS:
            continue
        line, split = SERIES_SLUGS[slug]
        html = page.get("content", {}).get("rendered") or ""
        vitolas = parse_vitolas(html)
        if not vitolas:
            print(f"  skip (no vitolas): {page.get('link')}")
            continue
        desc = series_description(html, line)
        image = cigar_image_url(html)
        variants = wrappers_for_page(html, split)
        print(f"  {line}: {len(vitolas)} sizes, variants={ [v[0] or 'default' for v in variants] }")
        for suffix, wrapper_label in variants:
            name = f"{line} {suffix}".strip() if suffix else line
            wrapper, binder, filler = blend_components(line, wrapper_label, html)
            for size_name, length in vitolas:
                key = (name.lower(), size_name.lower(), length)
                if key in seen:
                    continue
                seen.add(key)
                rows.append(
                    {
                        "brand": "Padrón",
                        "name": name,
                        "line": line,
                        "description": desc,
                        "wrapper": wrapper,
                        "binder": binder,
                        "filler": filler,
                        "length": length,
                        "size_name": size_name,
                        "image": "",
                        "_source": page.get("link") or "",
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
    if args.refresh or not PAGES_JSON.exists():
        print("Fetching Padrón WP pages…")
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
