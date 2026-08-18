#!/usr/bin/env python3
"""
Scrape AJ Fernandez catalog from ajfcigars.com (WP REST pages).

Writes:
  assets/aj-fernandez/catalog.json
  tmp/aj-fernandez/catalog.json
  tmp/aj-fernandez/blend-images.json
  tmp/aj-fernandez/processed/*.jpg

Usage (from repo root or server/):
  python3 scripts/parseAjFernandezCatalog.py
  python3 scripts/parseAjFernandezCatalog.py --refresh
  python3 scripts/parseAjFernandezCatalog.py --skip-images
"""

from __future__ import annotations

import argparse
import io
import json
import re
import ssl
import time
import urllib.parse
import urllib.request
from html import unescape
from pathlib import Path

from PIL import Image

REPO = Path(__file__).resolve().parents[2]
TMP = REPO / "tmp" / "aj-fernandez"
ASSETS = REPO / "assets" / "aj-fernandez"
PROCESSED = TMP / "processed"
RAW = TMP / "raw-images"
PAGES_JSON = TMP / "wp-pages.json"
SITE = "https://ajfcigars.com"
PAGES_API = f"{SITE}/wp-json/wp/v2/pages?per_page=100"
BG_RGB = (0x21, 0x19, 0x12)

FRAC = {
    "½": "1/2",
    "¼": "1/4",
    "¾": "3/4",
    "⅛": "1/8",
    "⅜": "3/8",
    "⅝": "5/8",
    "⅞": "7/8",
}

SKIP_PATHS = {
    "/",
    "/contact/",
    "/factory/",
    "/news/",
    "/careers/",
    "/about-us/",
    "/cigars/",
}

# Parent brand-hub pages (no vitolas of their own)
SKIP_SLUGS = {
    "new-world",
    "san-lotano",
    "bellas-artes",
    "last-call",
    "enclave",
    "dias-de-gloria",
}

LINE_BY_PARENT_SLUG = {
    "new-world": "New World",
    "san-lotano": "San Lotano",
    "bellas-artes": "Bellas Artes",
    "last-call": "Last Call",
    "enclave": "Enclave",
    "dias-de-gloria": "Días de Gloria",
}

NAME_FIXES = {
    "san-lotano/connecticut": "San Lotano Requiem Connecticut",
    "san-lotano/habano": "San Lotano Requiem Habano",
    "san-lotano/maduro": "San Lotano Requiem Maduro",
    "san-lotano/bull": "San Lotano Bull",
    "dias-de-gloria/dias-de-gloria1": "Días de Gloria",
    "dias-de-gloria/dias-de-gloria-brazil": "Días de Gloria Brazil",
}

UA = "Mozilla/5.0 (compatible; CavaroCatalog/1.0)"


def slugify(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", value.lower()).strip("_")


def html_to_text(html: str) -> str:
    t = unescape(html or "")
    t = re.sub(r"<br\s*/?>", "\n", t, flags=re.I)
    t = re.sub(r"</(p|div|h\d|li|td|section)>", "\n", t, flags=re.I)
    t = re.sub(r"<[^>]+>", " ", t)
    t = t.replace("\xa0", " ").replace("&nbsp;", " ")
    for k, v in FRAC.items():
        t = t.replace(k, f" {v} ")
    t = t.replace("×", "x").replace("–", "-").replace("—", "-")
    t = re.sub(r"[ \t]+", " ", t)
    t = re.sub(r"\n+", "\n", t)
    return t.strip()


def normalize_length(length: str, ring: str) -> str:
    length = re.sub(r"\s+", " ", length).strip()
    ring = ring.strip()
    return f"{length}x{ring}"


def encode_url(url: str) -> str:
    parts = urllib.parse.urlsplit(url)
    path = urllib.parse.quote(parts.path, safe="/%")
    return urllib.parse.urlunsplit(
        (parts.scheme, parts.netloc, path, parts.query, parts.fragment)
    )


def fetch(url: str) -> bytes:
    ctx = ssl.create_default_context()
    req = urllib.request.Request(encode_url(url), headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=90, context=ctx) as r:
        return r.read()


def fetch_text(url: str) -> str:
    return fetch(url).decode("utf-8", "ignore")


def page_path(link: str) -> str:
    path = urllib.parse.urlparse(link).path
    if not path.endswith("/"):
        path += "/"
    return path


def line_for_page(page: dict, by_id: dict) -> str:
    path = page_path(page["link"])
    parts = [p for p in path.strip("/").split("/") if p]
    if len(parts) >= 2 and parts[0] == "cigars":
        return LINE_BY_PARENT_SLUG.get(parts[1], parts[1].replace("-", " ").title())
    parent = by_id.get(page.get("parent"))
    if parent:
        return unescape(parent.get("title", {}).get("rendered") or "").strip()
    return unescape(page.get("title", {}).get("rendered") or "").strip()


def blend_name_for_page(page: dict) -> str:
    path = page_path(page["link"]).strip("/")
    key = path.replace("cigars/", "", 1)
    if key in NAME_FIXES:
        return NAME_FIXES[key]
    title = unescape(page.get("title", {}).get("rendered") or "").strip()
    title = re.sub(r"\s+", " ", title)
    return title


def extract_blend_section(text: str) -> str:
    m = re.search(r"Cigar Blend\s+(.*?)(?:Discover more|$)", text, re.I | re.S)
    if m:
        return m.group(1)
    idx = text.lower().find("wrapper")
    return text[idx:] if idx >= 0 else text


def parse_components(text: str) -> tuple[str, str, str]:
    section = extract_blend_section(text)
    m = re.search(
        r"Wrapper\s+(.+?)\s+Binder\s+(.+?)\s+Filler\s+(.+?)(?:\s+Vitolas|\s*$)",
        section,
        re.I | re.S,
    )
    if not m:
        return "", "", ""
    wrapper = re.sub(r"\s+", " ", m.group(1)).strip(" .")
    binder = re.sub(r"\s+", " ", m.group(2)).strip(" .")
    filler = re.sub(r"\s+", " ", m.group(3)).strip(" .")
    filler = re.sub(r"\s+Vitolas.*$", "", filler, flags=re.I).strip(" .")
    return wrapper, binder, filler


def parse_description(text: str, title: str) -> str:
    cut = re.split(r"Cigar Blend", text, maxsplit=1, flags=re.I)[0]
    cut = re.sub(r"\s+", " ", cut).strip()
    for chunk in (title, title.split()[-1] if title else ""):
        if chunk and cut.lower().startswith(chunk.lower()):
            cut = cut[len(chunk) :].strip()
    cut = re.sub(r"\s*Read More\s*$", "", cut, flags=re.I)
    if len(cut) > 900:
        cut = cut[:900].rsplit(".", 1)[0] + "."
    return cut.strip()


def line_description(text: str, title: str) -> str:
    cut = re.split(r"\bDISCOVER\b", text, maxsplit=1, flags=re.I)[0]
    cut = re.sub(r"\s+", " ", cut).strip()
    if title and cut.lower().startswith(title.lower()):
        cut = cut[len(title) :].strip()
    if "." in cut:
        head, tail = cut.rsplit(".", 1)
        if 0 < len(tail.strip()) <= 40:
            cut = head.strip() + "."
    return cut.strip()


VITOLA_START = {
    "short",
    "doble",
    "gran",
    "double",
    "super",
    "petit",
    "robusto",
    "toro",
    "gordo",
    "gordito",
    "belicoso",
    "churchill",
    "corona",
    "figurado",
    "torpedo",
    "chiquitas",
    "corticas",
    "geniales",
    "pequenas",
    "pequeñas",
    "flaquitas",
    "lancero",
}


def parse_vitolas(text: str) -> list[tuple[str, str]]:
    m = re.search(r"Vitolas\s+(.*?)(?:Discover more|$)", text, re.I | re.S)
    section = m.group(1) if m else ""
    if not section:
        return []
    section = re.sub(r"\s+", " ", section).strip()

    dim_re = re.compile(r"(\d+(?:\s+\d+/\d+)?)\s*x\s*(\d{2,3})", re.I)
    matches = list(dim_re.finditer(section))
    if not matches:
        return []

    rows = []
    seen = set()
    for i, match in enumerate(matches):
        start = 0 if i == 0 else matches[i - 1].end()
        label = section[start : match.start()]
        label = re.sub(r"^Vitolas\s+", "", label, flags=re.I)
        label = label.replace(":", " ").strip(" -–—")
        label = re.sub(r"\s+", " ", label)
        words = label.split()
        start_i = 0
        for i, word in enumerate(words):
            token = re.sub(r"[^a-zñáéíóú]", "", word.lower())
            if token in VITOLA_START:
                start_i = i
                break
        label = " ".join(words[start_i:]).strip(" -")
        if not label:
            continue
        if label.isupper() and len(label) > 3:
            label = label.title()
        # Keep parenthetical notes like (Box-Pressed)
        length = normalize_length(match.group(1), match.group(2))
        key = (label.lower(), length)
        if key in seen:
            continue
        seen.add(key)
        rows.append((label, length))
    return rows


def cigar_image_urls(html: str) -> list[str]:
    urls = []
    for raw in re.findall(
        r'(?:src|data-src|data-lazy-src)="(https://ajfcigars.com/wp-content/uploads/[^"]+)"',
        html,
    ):
        url = unescape(raw)
        lower = url.lower()
        if any(
            tok in lower
            for tok in (
                "logo",
                "rating",
                "aficionado",
                "snob",
                "journal",
                "cover",
                "badge",
                "caja",
                "box",
                "-open",
                "closed",
                "front",
            )
        ) and "cigar" not in lower and "puro" not in lower:
            continue
        if re.search(
            r"(cigar|puro|robusto|toro|churchill|gordo|belicoso|corona|figurado|torpedo|"
            r"chiquitas|corticas|geniales|flaquitas|pequen)",
            lower,
        ):
            if url not in urls:
                urls.append(url)
    return urls


def prefer_full_image(url: str) -> str:
    return re.sub(r"-\d+x\d+(?=\.(?:jpg|jpeg|png|webp)$)", "", url, flags=re.I)


def recolor_and_crop(src: bytes, dest_path: Path):
    im = Image.open(io.BytesIO(src))
    if im.mode in ("RGBA", "LA") or (im.mode == "P" and "transparency" in im.info):
        rgba = im.convert("RGBA")
    else:
        rgb = im.convert("RGB")
        luma = rgb.convert("L")

        def to_alpha(p: int) -> int:
            if p >= 242:
                return 0
            if p <= 198:
                return 255
            return int((242 - p) * 255 / 44)

        rgba = rgb.convert("RGBA")
        rgba.putalpha(luma.point(to_alpha))

    bg = Image.new("RGBA", rgba.size, (*BG_RGB, 255))
    out = Image.alpha_composite(bg, rgba).convert("RGB")
    bbox = out.getbbox()
    if bbox:
        x0, y0, x1, y1 = bbox
        pad_x = max(8, int((x1 - x0) * 0.04))
        pad_y = max(8, int((y1 - y0) * 0.12))
        x0 = max(0, x0 - pad_x)
        y0 = max(0, y0 - pad_y)
        x1 = min(out.width, x1 + pad_x)
        y1 = min(out.height, y1 + pad_y)
        out = out.crop((x0, y0, x1, y1))
    out.save(dest_path, "JPEG", quality=90, optimize=True)


def pick_blend_image(urls: list[str]) -> str | None:
    if not urls:
        return None
    scored = []
    for url in urls:
        score = 0
        lower = url.lower()
        if "robusto" in lower:
            score += 5
        if "puro" in lower or "cigar" in lower:
            score += 3
        if re.search(r"-\d+x\d+\.(jpg|jpeg|png|webp)$", lower):
            score -= 1
        scored.append((score, url))
    scored.sort(key=lambda x: -x[0])
    return prefer_full_image(scored[0][1])


def build_catalog(pages: list[dict]) -> list[dict]:
    by_id = {p["id"]: p for p in pages}
    rows = []
    seen = set()

    for page in pages:
        path = page_path(page["link"])
        if not path.startswith("/cigars/"):
            continue
        if path in SKIP_PATHS or page.get("slug") in SKIP_SLUGS:
            continue

        html = page.get("content", {}).get("rendered") or ""
        text = html_to_text(html)
        vitolas = parse_vitolas(text)
        if not vitolas:
            print(f"  skip (no vitolas): {page['link']}")
            continue

        name = blend_name_for_page(page)
        line = line_for_page(page, by_id)
        wrapper, binder, filler = parse_components(text)
        desc = parse_description(text, name)
        if len(desc) < 80:
            parent = by_id.get(page.get("parent"))
            if parent:
                parent_desc = line_description(
                    html_to_text(parent.get("content", {}).get("rendered") or ""),
                    unescape(parent.get("title", {}).get("rendered") or ""),
                )
                if len(parent_desc) > len(desc):
                    desc = parent_desc
        images = cigar_image_urls(html)
        blend_image = pick_blend_image(images)

        for size_name, length in vitolas:
            key = (name.lower(), size_name.lower(), length)
            if key in seen:
                continue
            seen.add(key)
            rows.append(
                {
                    "brand": "AJ Fernandez",
                    "name": name,
                    "line": line,
                    "description": desc,
                    "wrapper": wrapper,
                    "binder": binder,
                    "filler": filler,
                    "length": length,
                    "size_name": size_name,
                    "image": "",
                    "_source": page["link"],
                    "_blend_image": blend_image or "",
                    "_size_images": images,
                }
            )
        print(f"  {name}: {len(vitolas)} sizes")

    rows.sort(key=lambda r: (r["line"].lower(), r["name"].lower(), r["size_name"].lower(), r["length"]))
    return rows


def download_images(catalog: list[dict]) -> dict[str, str]:
    RAW.mkdir(parents=True, exist_ok=True)
    PROCESSED.mkdir(parents=True, exist_ok=True)
    blend_images: dict[str, str] = {}
    fetched: dict[str, bytes] = {}

    for row in catalog:
        name = row["name"]
        if name in blend_images:
            continue
        url = row.get("_blend_image") or ""
        if not url:
            print(f"  no image: {name}")
            continue
        dest = PROCESSED / f"{slugify(name)}.jpg"
        if dest.exists() and dest.stat().st_size > 0:
            blend_images[name] = str(dest)
            continue
        try:
            data = fetched.get(url) or fetch(url)
            fetched[url] = data
            raw_path = RAW / Path(urllib.parse.urlparse(url).path).name
            raw_path.write_bytes(data)
            recolor_and_crop(data, dest)
            blend_images[name] = str(dest)
            print(f"  processed: {name}")
            time.sleep(0.08)
        except Exception as exc:
            print(f"  image fail {name}: {exc}")
            blend_images[name] = ""
    return blend_images


def strip_private(rows: list[dict]) -> list[dict]:
    return [{k: v for k, v in r.items() if not k.startswith("_")} for r in rows]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--refresh", action="store_true")
    parser.add_argument("--skip-images", action="store_true")
    args = parser.parse_args()

    TMP.mkdir(parents=True, exist_ok=True)
    ASSETS.mkdir(parents=True, exist_ok=True)

    if args.refresh or not PAGES_JSON.exists():
        print("Fetching AJ Fernandez WP pages…")
        PAGES_JSON.write_text(fetch_text(PAGES_API))
    else:
        print("Using cached WP pages JSON")

    pages = json.loads(PAGES_JSON.read_text())
    catalog = build_catalog(pages)
    print(f"Catalog rows: {len(catalog)}")

    blend_images = {}
    if not args.skip_images:
        print("Downloading / processing blend images…")
        blend_images = download_images(catalog)
        (TMP / "blend-images.json").write_text(
            json.dumps(blend_images, indent=2, ensure_ascii=False) + "\n"
        )

    clean = strip_private(catalog)
    (ASSETS / "catalog.json").write_text(
        json.dumps(clean, indent=2, ensure_ascii=False) + "\n"
    )
    (TMP / "catalog.json").write_text(
        json.dumps(catalog, indent=2, ensure_ascii=False) + "\n"
    )

    names = sorted({r["name"] for r in clean})
    print(f"Wrote {ASSETS / 'catalog.json'} ({len(clean)} rows, {len(names)} blends)")
    for n in names:
        sizes = [r for r in clean if r["name"] == n]
        print(f"  - {n}: {len(sizes)} sizes")
    missing = [n for n in names if not blend_images.get(n)]
    if missing and blend_images:
        print(f"Missing images ({len(missing)}): {missing}")


if __name__ == "__main__":
    main()
