#!/usr/bin/env python3
"""
Scrape Perdomo catalog from perdomocigars.com (Squarespace line pages).

Writes:
  assets/perdomo/catalog.json
  tmp/perdomo/blend-images.json
  tmp/perdomo/processed/*.jpg
"""

from __future__ import annotations

import argparse
import re
import sys
import time
import urllib.error
import urllib.parse
from html import unescape
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from catalogCommon import (  # noqa: E402
    CHROME_UA,
    clip_desc,
    download_blend_images,
    fetch,
    fetch_text,
    html_to_text,
    normalize_length,
    replace_frac,
    write_catalog,
)

REPO = Path(__file__).resolve().parents[2]
TMP = REPO / "tmp" / "perdomo"
ASSETS = REPO / "assets" / "perdomo"
SITE = "https://www.perdomocigars.com"

LINE_PAGES = [
    ("/20th", "20th Anniversary"),
    ("/20th-anniversary", "20th Anniversary"),
    ("/10th-anniversary", "10th Anniversary"),
    ("/double-aged-12-year-vintage", "Double Aged 12 Year Vintage"),
    ("/legacy", "Legacy"),
    ("/habano-bourbon-barrel-aged", "Habano Bourbon Barrel-Aged"),
    ("/perdomo-lot-23", "Lot 23"),
    ("/30th-anniversary", "30th Anniversary"),
    ("/small-batch-series", "Small Batch Series"),
    ("/inmenso-seventy", "Inmenso Seventy"),
    ("/nicks-sticks", "Nick's Sticks"),
    ("/scs", "Special Craft Series"),
    ("/perdomo-fresco", "Fresco"),
    ("/factory-tour-blend", "Factory Tour Blend"),
    ("/nicaraguan-shade-grown-1", "Nicaraguan Shade Grown"),
    ("/estate-seleccion-vintage", "Estate Seleccion Vintage"),
]

# Site nav repeats Connecticut/Sun Grown/Maduro alts on every page, so wrapper
# variants are explicit per line rather than inferred from image alts.
LINE_WRAPPERS = {
    "20th Anniversary": ["Connecticut", "Sun Grown", "Maduro"],
    "10th Anniversary": ["Connecticut", "Sun Grown", "Maduro"],
    "Double Aged 12 Year Vintage": ["Connecticut", "Sun Grown", "Maduro"],
    "Legacy": ["Connecticut", "Sun Grown", "Maduro"],
    "Lot 23": ["Connecticut", "Sun Grown", "Maduro"],
    "Habano Bourbon Barrel-Aged": ["Connecticut", "Sun Grown", "Maduro"],
    "Inmenso Seventy": ["Sun Grown", "Maduro"],
    "30th Anniversary": ["Connecticut", "Sun Grown", "Maduro"],
    "Small Batch Series": ["Connecticut", "Sun Grown", "Maduro"],
    "Nick's Sticks": ["Connecticut", "Sun Grown", "Maduro"],
    "Special Craft Series": ["Connecticut", "Sun Grown", "Maduro"],
    "Fresco": ["Connecticut", "Sun Grown", "Maduro"],
    "Factory Tour Blend": ["Connecticut", "Sun Grown", "Maduro"],
    "Nicaraguan Shade Grown": [""],
    "Estate Seleccion Vintage": [""],
}

WRAPPER_LABELS = {
    "connecticut": "Connecticut",
    "sun grown": "Sun Grown",
    "sungrown": "Sun Grown",
    "maduro": "Maduro",
    "habano": "Habano",
    "champagne": "Champagne",
    "cameroun": "Cameroon",
    "cameroon": "Cameroon",
}

SKIP_LINES = {"Cigars"}  # hub page duplicates Legacy sizes


CACHE_ALIASES = {
    "/double-aged-12-year-vintage": "12yr.html",
    "/habano-bourbon-barrel-aged": "habano.html",
    "/perdomo-lot-23": "lot23.html",
    "/01-30th-anniversary": "30th.html",
    "/30th-anniversary": "30th.html",
    "/small-batch-series": "small-batch.html",
    "/inmenso-seventy": "inmenso.html",
    "/nicks-sticks": "nicks.html",
    "/perdomo-fresco": "fresco.html",
    "/factory-tour-blend": "factory.html",
    "/nicaraguan-shade-grown-1": "nsg.html",
    "/20th": "20th.html",
    "/legacy": "legacy.html",
    "/scs": "scs.html",
}


def cache_path(path: str) -> Path:
    alias = CACHE_ALIASES.get(path)
    if alias:
        return TMP / alias
    slug = path.strip("/").replace("/", "_") or "index"
    return TMP / f"{slug}.html"


def load_page(path: str, refresh: bool) -> str | None:
    dest = cache_path(path)
    if dest.exists() and not refresh:
        return dest.read_text(encoding="utf-8", errors="ignore")
    print(f"  fetch {path}")
    try:
        html = fetch_text(SITE + path)
    except urllib.error.HTTPError as exc:
        print(f"  skip ({exc.code}): {path}")
        return None
    except urllib.error.URLError as exc:
        print(f"  skip ({exc}): {path}")
        return None
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(html, encoding="utf-8")
    time.sleep(0.15)
    return html


def parse_sizes(html: str) -> list[tuple[str, str]]:
    html = replace_frac(unescape(html))
    rows: list[tuple[str, str]] = []
    seen: set[tuple[str, str]] = set()

    patterns = [
        re.compile(
            r"<strong[^>]*>\s*([^<]+?)\s*</strong>\s*(?:<strong[^>]*>\s*•\s*</strong>\s*)?•?\s*"
            r"(\d+(?:\s+\d+/\d+)?)\s*x\s*(\d{2,3})",
            re.I,
        ),
        re.compile(
            r"<p[^>]*>\s*(\d+(?:\s+\d+/\d+)?)\s*x\s*(\d{2,3})\s+([^<]+?)\s*</p>",
            re.I,
        ),
    ]
    for i, pat in enumerate(patterns):
        for m in pat.finditer(html):
            if i == 0:
                label, length, ring = m.group(1), m.group(2), m.group(3)
            else:
                length, ring, label = m.group(1), m.group(2), m.group(3)
            label = re.sub(r"\s+", " ", label).strip(" •-")
            if label.lower() in WRAPPER_LABELS or len(label) > 40:
                continue
            length = normalize_length(length, ring)
            key = (label.lower(), length)
            if key in seen:
                continue
            seen.add(key)
            rows.append((label, length))
    return rows


def wrapper_variants(html: str) -> list[str]:
    alts = [unescape(a).strip() for a in re.findall(r'alt="([^"]+)"', html)]
    found = []
    for alt in alts:
        key = re.sub(r"\s+", " ", alt).strip().lower()
        if key in WRAPPER_LABELS:
            label = WRAPPER_LABELS[key]
            if label not in found:
                found.append(label)
    if len(found) >= 2:
        return found
    return [""]


def cigar_image_url(html: str) -> str:
    urls = re.findall(
        r'(?:data-src|src)="(https://images\.squarespace-cdn\.com/[^"]+)"',
        html,
    )
    scored = []
    for raw in urls:
        url = unescape(raw).split("?")[0]
        lower = url.lower()
        if any(tok in lower for tok in ("logo", "icon", "favicon", "banner")):
            continue
        score = 0
        if any(tok in lower for tok in ("tilt", "crop", "1900", "epicure")):
            score += 3
        if "box" in lower:
            score -= 4
        if "sizes" in lower:
            score -= 2
        scored.append((score, url))
    if not scored:
        return ""
    scored.sort(key=lambda x: -x[0])
    return scored[0][1]


PERDOMO_DEFAULTS = {
    "Connecticut": ("Ecuadorian Connecticut", "Cuban-seed Nicaraguan", "Cuban-seed Nicaraguan"),
    "Sun Grown": ("Nicaraguan Sun Grown", "Cuban-seed Nicaraguan", "Cuban-seed Nicaraguan"),
    "Maduro": ("Nicaraguan Maduro", "Cuban-seed Nicaraguan", "Cuban-seed Nicaraguan"),
    "Habano": ("Habano", "Cuban-seed Nicaraguan", "Cuban-seed Nicaraguan"),
}


CLASS_TO_WRAPPER = {
    "connecticut": "Connecticut",
    "sungrown": "Sun Grown",
    "sun-grown": "Sun Grown",
    "maduro": "Maduro",
    "habano": "Habano",
}


def _clean_component(raw: str) -> str:
    text = re.sub(r"<br\s*/?>", " ", raw, flags=re.I)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", unescape(text)).strip(" .")
    return text.replace("Cuban-Seed", "Cuban-seed")


def parse_blend_specs(html: str) -> dict[str, tuple[str, str, str]]:
    specs: dict[str, dict[str, str]] = {}
    for m in re.finditer(
        r'<div class="([^"]+)"[^>]*>\s*<h3>\s*(wrapper|binder|filler)\s*</h3>\s*<p>(.*?)</p>',
        html,
        re.I | re.S,
    ):
        cls, kind, raw = m.group(1).lower(), m.group(2).lower(), m.group(3)
        key = CLASS_TO_WRAPPER.get(cls)
        if not key:
            continue
        val = _clean_component(raw)
        if not val:
            continue
        bucket = specs.setdefault(key, {})
        if kind not in bucket:
            bucket[kind] = val

    out: dict[str, tuple[str, str, str]] = {}
    for key, parts in specs.items():
        wrap = parts.get("wrapper") or ""
        binder = parts.get("binder") or ""
        filler = parts.get("filler") or ""
        if wrap or binder or filler:
            out[key] = (wrap, binder, filler)
    return out


def blend_components(line: str, wrapper: str, html: str) -> tuple[str, str, str]:
    specs = parse_blend_specs(html)
    parsed = specs.get(wrapper) if wrapper else None
    defaults = PERDOMO_DEFAULTS.get(wrapper) or PERDOMO_DEFAULTS["Sun Grown"]
    if line == "Nicaraguan Shade Grown":
        defaults = ("Nicaraguan Shade Grown", "Cuban-seed Nicaraguan", "Cuban-seed Nicaraguan")
    if parsed:
        wrap = parsed[0] or defaults[0]
        binder = parsed[1] or defaults[1]
        filler = parsed[2] or defaults[2]
        return wrap, binder, filler
    if wrapper:
        return defaults
    if specs:
        wrap, binder, filler = next(iter(specs.values()))
        return wrap or defaults[0], binder or defaults[1], filler or defaults[2]
    return defaults


def parse_description(html: str, title: str) -> str:
    text = html_to_text(html)
    # Drop nav / footer noise by taking the first substantial paragraph.
    chunks = [c.strip() for c in re.split(r"\n+", text) if len(c.strip()) > 80]
    desc = ""
    for chunk in chunks:
        if title and chunk.lower().startswith(title.lower()):
            chunk = chunk[len(title) :].strip()
        if "perdomo" in chunk.lower() or "tobacco" in chunk.lower() or "wrapper" in chunk.lower():
            desc = chunk
            break
    if not desc and chunks:
        desc = chunks[0]
    return clip_desc(desc)


def build_catalog(refresh: bool) -> list[dict]:
    rows = []
    seen = set()
    seen_lines = set()

    for path, line in LINE_PAGES:
        if line in SKIP_LINES:
            continue
        key = line.lower()
        html = load_page(path, refresh)
        if not html:
            continue
        sizes = parse_sizes(html)
        if not sizes:
            print(f"  skip (no sizes): {path}")
            continue
        if key in seen_lines:
            continue
        seen_lines.add(key)

        wrappers = LINE_WRAPPERS.get(line, [""])
        desc = parse_description(html, line)
        image = cigar_image_url(html)
        print(f"  {line}: {len(sizes)} sizes, wrappers={wrappers or ['(none)']}")

        for wrapper in wrappers:
            if wrapper and wrapper.lower() not in line.lower():
                name = f"{line} {wrapper}".strip()
            else:
                name = line
            wrap, binder, filler = blend_components(line, wrapper, html)
            for size_name, length in sizes:
                ukey = (name.lower(), size_name.lower(), length)
                if ukey in seen:
                    continue
                seen.add(ukey)
                rows.append(
                    {
                        "brand": "Perdomo",
                        "name": name,
                        "line": line,
                        "description": desc,
                        "wrapper": wrap,
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
    print("Building Perdomo catalog…")
    catalog = build_catalog(args.refresh)
    print(f"Catalog rows: {len(catalog)}")

    blend_images = {}
    if not args.skip_images:
        print("Downloading / processing blend images…")
        blend_images = download_blend_images(catalog, TMP / "processed", TMP / "raw-images")

    write_catalog(catalog, ASSETS, TMP, blend_images if not args.skip_images else None)


if __name__ == "__main__":
    main()
