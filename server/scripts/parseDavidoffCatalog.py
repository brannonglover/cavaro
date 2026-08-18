#!/usr/bin/env python3
"""
Scrape Davidoff catalog.

The US shop (us.davidoffgeneva.com) hides length/ring behind client-side
BigCommerce fields. Official Davidoff London product JSON includes
LENGTH / RING GAUGE / WRAPPER / BINDER / FILLER in the body HTML.

Writes:
  assets/davidoff/catalog.json
  tmp/davidoff/blend-images.json
  tmp/davidoff/processed/*.jpg
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
from html import unescape
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from catalogCommon import (  # noqa: E402
    clip_desc,
    download_blend_images,
    fetch_json,
    html_to_text,
    normalize_length,
    write_catalog,
)

REPO = Path(__file__).resolve().parents[2]
TMP = REPO / "tmp" / "davidoff"
ASSETS = REPO / "assets" / "davidoff"
PRODUCTS_JSON = TMP / "london-products.json"
COLLECTION = "https://www.davidofflondon.com/collections/davidoff/products.json?limit=250&page={page}"

SKIP_TITLE = re.compile(
    r"mini cigarillo|primeros|\btubos\b|traveller|sampler|selection|assortment|"
    r"humidor|cutter|ashtray|lighter|gift set",
    re.I,
)
SKIP_VENDORS = {"zino"}

LINE_BY_VENDOR = {
    "signature range": "Signature",
    "aniversario": "Aniversario",
    "grand cru": "Grand Cru",
    "escurio": "Escurio",
    "yamasa": "Yamasa",
    "nicaragua": "Nicaragua",
    "maduro": "Maduro",
    "dominicano": "Puro Dominicano",
    "dominican": "Dominican",
    "winston churchill": "Winston Churchill",
    "millenium blend": "Millennium",
    "millennium blend": "Millennium",
    "davidoff limited editions": "Limited Edition",
}

LATE_HOUR = re.compile(r"late hour", re.I)


def fetch_products(refresh: bool) -> list[dict]:
    if PRODUCTS_JSON.exists() and not refresh:
        return json.loads(PRODUCTS_JSON.read_text())
    products = []
    page = 1
    while True:
        print(f"  fetch London products page {page}")
        data = fetch_json(COLLECTION.format(page=page))
        batch = data.get("products") or []
        if not batch:
            break
        products.extend(batch)
        page += 1
        time.sleep(0.15)
        if page > 20:
            break
    PRODUCTS_JSON.write_text(json.dumps(products, indent=2, ensure_ascii=False) + "\n")
    return products


def parse_specs(body_html: str) -> tuple[str, str, str, str, str]:
    text = html_to_text(body_html)
    length_in = ""
    ring = ""
    m = re.search(r"LENGTH:\s*([0-9./\s]+)", text, re.I)
    if m:
        length_in = m.group(1).replace('"', "").strip()
    m = re.search(r"RING GAUGE:\s*(\d+)", text, re.I)
    if m:
        ring = m.group(1)
    wrapper = binder = filler = ""
    m = re.search(r"WRAPPER:\s*(.+?)(?:\s+BINDER:|\s+FILLER:|\s+LENGTH:)", text, re.I | re.S)
    if m:
        wrapper = re.sub(r"\s+", " ", m.group(1)).strip(" .")
    m = re.search(r"BINDER:\s*(.+?)(?:\s+FILLER:|\s+LENGTH:)", text, re.I | re.S)
    if m:
        binder = re.sub(r"\s+", " ", m.group(1)).strip(" .")
    m = re.search(r"FILLER:\s*(.+?)(?:\s+LENGTH:|\s+STRENGTH:|$)", text, re.I | re.S)
    if m:
        filler = re.sub(r"\s+", " ", m.group(1)).strip(" .")
        if filler.lower() in {"length", "strength"}:
            filler = ""
    if not wrapper:
        m = re.search(
            r"(Ecuadorian wrapper over an Ecuadorian binder and three Dominican fillers)",
            text,
            re.I,
        )
        if m:
            wrapper, binder, filler = "Ecuador", "Ecuador", "Dominican Republic"
    if not wrapper:
        m = re.search(
            r"tobaccos from Ecuador,\s*Mexico and the Dominican Republic",
            text,
            re.I,
        )
        if m:
            wrapper, binder, filler = "Ecuador", "Mexico", "Dominican Republic"
    if not wrapper:
        m = re.search(
            r"(Habano Seed Nicaragua Rosada|Habana Seed Nicaragua Rosada)\s+wrapper",
            text,
            re.I,
        )
        if m:
            wrapper = "Habano Seed Nicaragua Rosado"
    length = normalize_length(length_in, ring) if length_in and ring else ""
    return length, wrapper, binder, filler, text


def blend_and_size(title: str, vendor: str) -> tuple[str, str, str]:
    vendor_key = (vendor or "").strip().lower()
    line = LINE_BY_VENDOR.get(vendor_key, vendor.strip() or "Davidoff")
    raw = re.sub(r"^Davidoff\s+", "", title.strip(), flags=re.I)
    raw = re.sub(r"\s+", " ", raw)

    if LATE_HOUR.search(raw):
        line = "Winston Churchill The Late Hour"
        name = line
        size = re.sub(r"^Winston Churchill(?: The)? Late Hour\s*", "", raw, flags=re.I).strip(" -")
        return name, line, size or raw

    if re.match(r"^Royal\s+", raw, re.I):
        size = re.sub(r"^Royal\s+", "", raw, flags=re.I).strip()
        return "Royal Release", "Royal Release", size or raw

    if re.search(r"demi-?tasse", raw, re.I):
        return "Demi-Tasse", "Dominican", "Demi-Tasse"

    if vendor_key == "winston churchill":
        name = "Winston Churchill"
        size = re.sub(r"^Winston Churchill\s+", "", raw, flags=re.I)
        size = re.sub(r"\s*-\s*(Traveller|Raconteur)\s*$", "", size, flags=re.I).strip()
        # "Robusto Statesman" -> size_name Robusto, keep nickname in size_name if unique
        m = re.match(
            r"^(Belicoso|Petit Panetela|Petit Corona|Robusto|Toro|Churchill)\b(?:\s+(.+))?$",
            size,
            re.I,
        )
        if m:
            size = m.group(1)
        return name, name, size or raw

    if vendor_key == "davidoff limited editions":
        return raw, "Limited Edition", raw

    if " - " in raw:
        left, right = raw.split(" - ", 1)
        if line.lower() in {"signature", "grand cru"} or left.lower() in {line.lower(), "signature", "grand cru"}:
            return line, line, right.strip()
        return left.strip(), line, right.strip()

    prefix = line
    size = raw
    for cand in (line, vendor, "Puro Dominicano", "Millennium Blend", "Robusto Millennium Blend"):
        if cand and raw.lower().startswith(cand.lower()):
            size = raw[len(cand) :].strip(" -")
            break
    if vendor_key == "millenium blend":
        prefix = "Millennium"
        size = re.sub(r"\s*Millennium Blend\s*$", "", raw, flags=re.I).strip() or raw
    if vendor_key == "dominicano":
        prefix = "Puro Dominicano"
        size = re.sub(r"^Puro Dominicano\s+", "", raw, flags=re.I).strip() or raw
    return prefix, line if line != "Dominican" else prefix, size or raw


def pick_image(product: dict) -> str:
    images = product.get("images") or []
    scored = []
    for img in images:
        url = img.get("src") or ""
        lower = url.lower()
        score = 0
        if "single" in lower or "cigar" in lower:
            score += 4
        if "box" in lower or "25s" in lower or "_5s" in lower:
            score -= 3
        scored.append((score, url.split("?")[0]))
    scored.sort(key=lambda x: -x[0])
    return scored[0][1] if scored else ""


def parse_description(text: str) -> str:
    cut = re.split(r"\bSTRENGTH:|\bFORMAT:|\bWRAPPER:", text, maxsplit=1)[0]
    return clip_desc(cut)


def build_catalog(products: list[dict]) -> list[dict]:
    rows = []
    seen = set()
    for product in products:
        title = unescape(product.get("title") or "")
        vendor = unescape(product.get("vendor") or "")
        ptype = (product.get("product_type") or "").lower()
        if ptype == "zino" or vendor.strip().lower() in SKIP_VENDORS:
            continue
        if SKIP_TITLE.search(title):
            print(f"  skip: {title}")
            continue
        length, wrapper, binder, filler, text = parse_specs(product.get("body_html") or "")
        if not length:
            print(f"  skip (no specs): {title}")
            continue
        name, line, size_name = blend_and_size(title, vendor)
        size_name = re.sub(r"'", "", size_name).strip(" -") or title
        key = (name.lower(), size_name.lower(), length)
        if key in seen:
            continue
        seen.add(key)
        rows.append(
            {
                "brand": "Davidoff",
                "name": name,
                "line": line,
                "description": parse_description(text),
                "wrapper": wrapper,
                "binder": binder,
                "filler": filler,
                "length": length,
                "size_name": size_name,
                "image": "",
                "_source": f"https://www.davidofflondon.com/products/{product.get('handle')}",
                "_blend_image": pick_image(product),
            }
        )
        print(f"  {name} / {size_name} {length}")
    fill_missing_components(rows)
    rows.sort(key=lambda r: (r["line"].lower(), r["name"].lower(), r["size_name"].lower(), r["length"]))
    return rows


def _component_score(row: dict) -> tuple[int, int, int]:
    return (
        len(row.get("filler") or ""),
        len(row.get("wrapper") or ""),
        len(row.get("binder") or ""),
    )


def fill_missing_components(rows: list[dict]) -> None:
    complete_by_name: dict[str, dict] = {}
    complete_by_line: dict[str, dict] = {}
    for row in rows:
        if not (row.get("wrapper") and row.get("binder") and row.get("filler")):
            continue
        name = row["name"]
        prev = complete_by_name.get(name)
        if prev is None or _component_score(row) > _component_score(prev):
            complete_by_name[name] = row
        if row["line"] == "Limited Edition":
            continue
        prev = complete_by_line.get(row["line"])
        if prev is None or _component_score(row) > _component_score(prev):
            complete_by_line[row["line"]] = row

    fallbacks = {
        "Puro Dominicano": ("Dominican Republic", "Dominican Republic", "Dominican Republic"),
        "Maduro": ("Ecuador", "Mexico", "Dominican Republic"),
        "Year of the Horse - 2026": ("Ecuador", "Ecuador", "Dominican Republic"),
        "Demi-Tasse": ("Dominican Republic", "Dominican Republic", "Dominican Republic"),
        "Oro Blanco Special Release 111": ("Dominican Republic", "Dominican Republic", "Dominican Republic"),
    }
    for row in rows:
        if row.get("wrapper") and row.get("binder") and row.get("filler"):
            continue
        src = complete_by_name.get(row["name"])
        if not src and row["line"] != "Limited Edition":
            src = complete_by_line.get(row["line"])
        if not src and "Winston Churchill" in row["name"]:
            src = complete_by_name.get("Winston Churchill")
        if not src and row["name"].startswith("Escurio"):
            src = complete_by_name.get("Escurio")
        if src:
            row["wrapper"] = row["wrapper"] or src["wrapper"]
            row["binder"] = row["binder"] or src["binder"]
            row["filler"] = row["filler"] or src["filler"]
            continue
        if row["name"] in fallbacks:
            row["wrapper"], row["binder"], row["filler"] = fallbacks[row["name"]]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--refresh", action="store_true")
    parser.add_argument("--skip-images", action="store_true")
    args = parser.parse_args()

    TMP.mkdir(parents=True, exist_ok=True)
    print("Fetching Davidoff London products…")
    products = fetch_products(args.refresh)
    catalog = build_catalog(products)
    print(f"Catalog rows: {len(catalog)}")

    blend_images = {}
    if not args.skip_images:
        print("Downloading / processing blend images…")
        blend_images = download_blend_images(catalog, TMP / "processed", TMP / "raw-images")

    write_catalog(catalog, ASSETS, TMP, blend_images if not args.skip_images else None)


if __name__ == "__main__":
    main()
