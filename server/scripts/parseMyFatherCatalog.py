#!/usr/bin/env python3
"""
Scrape My Father Cigars catalog from myfathercigars.com (WP REST cigar CPT).

Writes:
  assets/my-father/catalog.json
  tmp/my-father/catalog.json
  tmp/my-father/blend-images.json
  tmp/my-father/processed/*.jpg

Usage (from repo root or server/):
  python3 scripts/parseMyFatherCatalog.py
  python3 scripts/parseMyFatherCatalog.py --refresh
  python3 scripts/parseMyFatherCatalog.py --skip-images
"""

from __future__ import annotations

import argparse
import io
import json
import re
import ssl
import time
import unicodedata
import urllib.parse
import urllib.request
from html import unescape
from pathlib import Path

from PIL import Image

REPO = Path(__file__).resolve().parents[2]
TMP = REPO / "tmp" / "my-father"
ASSETS = REPO / "assets" / "my-father"
PROCESSED = TMP / "processed"
RAW = TMP / "raw-images"
CIGARS_JSON = TMP / "wp-cigars.json"
API = "https://myfathercigars.com/wp-json/wp/v2/cigar?per_page=100"
BG_RGB = (0x21, 0x19, 0x12)
UA = "Mozilla/5.0 (compatible; CavaroCatalog/1.0)"

FRAC = {
    "½": "1/2",
    "¼": "1/4",
    "¾": "3/4",
    "⅛": "1/8",
    "⅜": "3/8",
    "⅝": "5/8",
    "⅞": "7/8",
}

SKIP_SLUGS = {
    "samplers-and-humidified-bags",
}

PACK_WORDS = (
    "petaca",
    "tin of",
    "sampler",
    "tubos",
    "humidified",
    "collection of",
    "selection of",
    "bags",
    "assorted",
)

# slug → (catalog name, line)
BLEND_MAP = {
    "my-father": ("My Father", "My Father"),
    "my-father-le-bijou-1922": ("Le Bijou 1922", "My Father"),
    "my-father-connecticut": ("Connecticut", "My Father"),
    "my-father-mf-the-judge": ("The Judge", "My Father"),
    "my-father-la-opulencia": ("La Opulencia", "My Father"),
    "my-father-la-gran-oferta": ("La Gran Oferta", "My Father"),
    "my-father-la-promesa": ("La Promesa", "My Father"),
    "my-father-blue": ("Blue", "My Father"),
    "my-father-la-lealtad": ("La Lealtad", "My Father"),
    "tabacos-baez-serie-sf": ("Tabacos Baez Serie SF", "Tabacos Baez"),
    "don-pepin-garcia-original": ("Don Pepin Garcia Original", "Don Pepin Garcia"),
    "don-pepin-garcia-cuban-classic": ("Don Pepin Garcia Cuban Classic", "Don Pepin Garcia"),
    "don-pepin-garcia-series-jj": ("Don Pepin Garcia Series JJ", "Don Pepin Garcia"),
    "don-pepin-garcia-vegas-cubanas": ("Don Pepin Garcia Vegas Cubanas", "Don Pepin Garcia"),
    "don-pepin-vintage-edition": ("Don Pepin Vintage Edition", "Don Pepin Garcia"),
    "don-pepin-garcia-e-r-h": ("Don Pepin Garcia E.R.H.", "Don Pepin Garcia"),
    "la-duena": ("La Dueña", "La Dueña"),
    "la-antiguedad": ("La Antigüedad", "La Antigüedad"),
    "flor-de-las-antillas": ("Flor de las Antillas", "Flor de las Antillas"),
    "flor-de-las-antillas-maduro": ("Flor de las Antillas Maduro", "Flor de las Antillas"),
    "el-centurion": ("El Centurion", "El Centurion"),
    "el-centurion-h-2k-ct": ("El Centurion H-2K-CT", "El Centurion"),
    "fonseca": ("Fonseca", "Fonseca"),
    "fonseca-mexico-edition": ("Fonseca Mexico Edition", "Fonseca"),
    "jaime-garcia-reserva-especial": ("Jaime Garcia Reserva Especial", "Jaime Garcia"),
    "jaime-garcia-r-e-connecticut": ("Jaime Garcia Reserva Especial Connecticut", "Jaime Garcia"),
}

SIZE_RE = re.compile(
    r"^(?P<label>.+?)\s+"
    r"(?P<len>\d+(?:\s+\d+/\d+)?)\s*[xX×]\s*(?P<rg>\d{2,3})"
    r"(?:\s*[xX×]\s*(?P<rg2>\d{2,3}))?\s*$"
)


def slugify(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", value.lower()).strip("_")


def strip_accents(value: str) -> str:
    value = unicodedata.normalize("NFD", value)
    return "".join(c for c in value if unicodedata.category(c) != "Mn")


def html_to_text(html: str) -> str:
    t = unescape(html or "")
    t = re.sub(r"<br\s*/?>", "\n", t, flags=re.I)
    t = re.sub(r"</(p|div|h\d|li|td|section)>", "\n", t, flags=re.I)
    t = re.sub(r"<[^>]+>", " ", t)
    t = t.replace("\xa0", " ")
    for k, v in FRAC.items():
        t = t.replace(k, f" {v} ")
    t = t.replace("×", "x").replace("–", "-").replace("—", "-")
    t = re.sub(r"[ \t]+", " ", t)
    t = re.sub(r"\n+", "\n", t)
    return t.strip()


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


def clean_heading(html: str) -> str:
    t = unescape(re.sub(r"<[^>]+>", " ", html or ""))
    for k, v in FRAC.items():
        t = t.replace(k, f" {v} ")
    t = t.replace("×", "x").replace("–", "-").replace("—", "-")
    t = re.sub(r"\s+", " ", t).strip()
    return t


def is_pack(label: str) -> bool:
    key = strip_accents(label).lower()
    return any(word in key for word in PACK_WORDS)


def tidy_size_name(label: str, blend_name: str) -> str:
    label = re.sub(r"\s+", " ", label).strip(" -")
    # Drop leading blend name if repeated on the vitola title
    for prefix in (blend_name, "My Father", "Flor de las Antillas"):
        if label.lower().startswith(prefix.lower()):
            rest = label[len(prefix) :].strip(" -")
            if rest:
                label = rest
    label = label.replace(" - ", " ").replace("Figuarado", "Figurado")
    label = re.sub(r"\s+", " ", label).strip(" -")
    return label


def parse_size_heading(heading: str, blend_name: str) -> tuple[str, str] | None:
    if heading.lower().startswith("price"):
        return None
    heading = clean_heading(heading)
    if is_pack(heading):
        return None
    m = SIZE_RE.match(heading)
    if not m:
        return None
    label = tidy_size_name(m.group("label"), blend_name)
    length = f"{m.group('len')}x{m.group('rg')}"
    if m.group("rg2"):
        length = f"{m.group('len')}x{m.group('rg')}-{m.group('rg2')}"
    if not label:
        return None
    return label, length


def parse_components(html: str, text: str) -> tuple[str, str, str]:
    m = re.search(
        r"Wrapper\s*[–—-]\s*([^|<]+?)\s*\|\s*Binder\s*[–—-]\s*([^|<]+?)\s*\|\s*Filler\s*[–—-]\s*([^|<]+?)(?:\s*\||\s*Handcrafted|\s*$)",
        html_to_text(html),
        re.I,
    )
    if m:
        return (
            re.sub(r"\s+", " ", m.group(1)).strip(" ."),
            re.sub(r"\s+", " ", m.group(2)).strip(" ."),
            re.sub(r"\s+", " ", m.group(3)).strip(" ."),
        )

    wrapper = binder = filler = ""
    wm = re.search(r"(?:wrapped in|wrapper(?: is| of)?)\s+(?:a\s+)?([^.;]{4,80})", text, re.I)
    bm = re.search(r"binder[s]?\s+(?:is|are)?\s+([^.;]{4,80})", text, re.I)
    fm = re.search(r"filler[s]?\s+(?:is|are)?\s+([^.;]{4,80})", text, re.I)
    if wm:
        wrapper = re.sub(r"\s+", " ", wm.group(1)).strip(" .")
        wrapper = re.sub(r"^(?:an?\s+)?", "", wrapper, flags=re.I)
    if bm:
        binder = re.sub(r"\s+", " ", bm.group(1)).strip(" .")
    if fm:
        filler = re.sub(r"\s+", " ", fm.group(1)).strip(" .")
    return wrapper, binder, filler


def parse_description(page: dict, blend_name: str) -> str:
    html = page.get("content", {}).get("rendered") or ""
    paras = re.findall(r"<p[^>]*>([\s\S]*?)</p>", html, re.I)
    chunks = []
    for para in paras:
        text = re.sub(r"\s+", " ", html_to_text(para)).strip()
        if len(text) < 50:
            continue
        if re.match(r"^(wrapper|binder|filler)\b", text, re.I):
            continue
        for prefix in (blend_name, unescape(page.get("title", {}).get("rendered") or "")):
            prefix = re.sub(r"\s+", " ", prefix).strip()
            if prefix and text.lower().startswith(prefix.lower()):
                text = text[len(prefix) :].strip(" -–—")
        if text:
            chunks.append(text)
        if sum(len(c) for c in chunks) > 450:
            break
    desc = " ".join(chunks).strip()
    desc = re.sub(r"\s*\[…\]\s*$", "", desc)
    if len(desc) > 900:
        desc = desc[:900].rsplit(".", 1)[0] + "."
    return desc


def cigar_image_urls(html: str) -> list[str]:
    urls = []
    for raw in re.findall(r'(?:src|data-src|data-lazy-src)="(https://myfathercigars.com/wp-content/uploads/[^"]+)"', html):
        url = unescape(raw)
        lower = url.lower()
        if any(
            tok in lower
            for tok in (
                "logo",
                "banner",
                "anillo",
                "lineup",
                "flag",
                "untitled",
                "petaca",
            )
        ):
            continue
        if "box" in lower and "cigar" not in lower:
            continue
        if not re.search(r"\.(?:jpg|jpeg|png|webp)(?:$|\?)", lower):
            continue
        if re.search(r"(cigar|robusto|toro|belicoso|churchill|lancero|corona|gordo)", lower):
            if url not in urls:
                urls.append(url)
    return urls


def prefer_full_image(url: str) -> str:
    return re.sub(r"-\d+x\d+(?=\.(?:jpg|jpeg|png|webp)$)", "", url, flags=re.I)


def pick_blend_image(urls: list[str]) -> str | None:
    if not urls:
        return None
    scored = []
    for url in urls:
        score = 0
        lower = url.lower()
        if "robusto" in lower:
            score += 4
        if "edit" in lower:
            score += 2
        if re.search(r"-\d+x\d+\.(jpg|jpeg|png|webp)$", lower):
            score -= 1
        scored.append((score, url))
    scored.sort(key=lambda x: -x[0])
    return prefer_full_image(scored[0][1])


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


def build_catalog(posts: list[dict]) -> list[dict]:
    rows = []
    seen = set()

    for page in posts:
        slug = page.get("slug") or ""
        if slug in SKIP_SLUGS:
            print(f"  skip slug: {slug}")
            continue
        name, line = BLEND_MAP.get(
            slug,
            (
                unescape(re.sub(r"<[^>]+>", "", page.get("title", {}).get("rendered") or "")).strip(),
                "My Father",
            ),
        )
        html = page.get("content", {}).get("rendered") or ""
        text = html_to_text(html)
        headings = re.findall(r"<h3[^>]*>([\s\S]*?)</h3>", html, re.I)
        vitolas = []
        for heading in headings:
            parsed = parse_size_heading(heading, name)
            if parsed:
                vitolas.append(parsed)
        if not vitolas:
            print(f"  skip (no vitolas): {slug}")
            continue

        wrapper, binder, filler = parse_components(html, text)
        desc = parse_description(page, name)
        images = cigar_image_urls(html)
        blend_image = pick_blend_image(images)

        for size_name, length in vitolas:
            key = (name.lower(), size_name.lower(), length)
            if key in seen:
                continue
            seen.add(key)
            rows.append(
                {
                    "brand": "My Father",
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
                    "_blend_image": blend_image or "",
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

    if args.refresh or not CIGARS_JSON.exists():
        print("Fetching My Father cigar posts…")
        CIGARS_JSON.write_text(fetch_text(API))
    else:
        print("Using cached cigar JSON")

    posts = json.loads(CIGARS_JSON.read_text())
    catalog = build_catalog(posts)
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
