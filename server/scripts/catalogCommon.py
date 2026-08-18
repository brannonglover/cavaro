#!/usr/bin/env python3
"""Shared helpers for official cigar-catalog scrapers."""

from __future__ import annotations

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

BG_RGB = (0x21, 0x19, 0x12)
CHROME_UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/128.0.0.0 Safari/537.36"
)
FRAC = {
    "½": "1/2",
    "¼": "1/4",
    "¾": "3/4",
    "⅛": "1/8",
    "⅜": "3/8",
    "⅝": "5/8",
    "⅞": "7/8",
}
DEC_FRAC = {
    0.0: "",
    0.125: "1/8",
    0.25: "1/4",
    0.375: "3/8",
    0.5: "1/2",
    0.5625: "9/16",
    0.625: "5/8",
    0.75: "3/4",
    0.875: "7/8",
}


def slugify(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", value.lower()).strip("_")


def replace_frac(text: str) -> str:
    for k, v in FRAC.items():
        text = text.replace(k, f" {v} ")
    return text


def html_to_text(html: str) -> str:
    t = unescape(html or "")
    t = re.sub(r"<br\s*/?>", "\n", t, flags=re.I)
    t = re.sub(r"</(p|div|h\d|li|td|section)>", "\n", t, flags=re.I)
    t = re.sub(r"<script[\s\S]+?</script>", " ", t, flags=re.I)
    t = re.sub(r"<style[\s\S]+?</style>", " ", t, flags=re.I)
    t = re.sub(r"<[^>]+>", " ", t)
    t = t.replace("\xa0", " ").replace("&nbsp;", " ")
    t = replace_frac(t)
    t = t.replace("×", "x").replace("–", "-").replace("—", "-")
    t = re.sub(r"[ \t]+", " ", t)
    t = re.sub(r"\n+", "\n", t)
    return t.strip()


def decimal_inches_to_frac(raw: str) -> str:
    s = unescape(str(raw)).strip().replace('"', "").replace("''", "")
    s = replace_frac(s)
    s = re.sub(r"\s+", " ", s).strip()
    m = re.match(r"^(\d+)\.(\d+)$", s)
    if not m:
        return s
    whole = int(m.group(1))
    frac = float(f"0.{m.group(2)}")
    closest = min(DEC_FRAC, key=lambda x: abs(x - frac))
    if abs(closest - frac) > 0.04:
        return s.rstrip("0").rstrip(".")
    token = DEC_FRAC[closest]
    if not token:
        return str(whole)
    return f"{whole} {token}" if whole else token


def normalize_length(length: str, ring: str) -> str:
    length = decimal_inches_to_frac(re.sub(r"\s+", " ", length).strip())
    ring = re.sub(r"[^\d]", "", ring)
    return f"{length}x{ring}"


def encode_url(url: str) -> str:
    parts = urllib.parse.urlsplit(url)
    path = urllib.parse.quote(parts.path, safe="/%")
    query = urllib.parse.quote(parts.query, safe="=&%")
    return urllib.parse.urlunsplit(
        (parts.scheme, parts.netloc, path, query, parts.fragment)
    )


def fetch(url: str, ua: str = CHROME_UA) -> bytes:
    ctx = ssl.create_default_context()
    req = urllib.request.Request(encode_url(url), headers={"User-Agent": ua, "Accept": "*/*"})
    with urllib.request.urlopen(req, timeout=90, context=ctx) as r:
        return r.read()


def fetch_text(url: str, ua: str = CHROME_UA) -> str:
    return fetch(url, ua=ua).decode("utf-8", "ignore")


def fetch_json(url: str, ua: str = CHROME_UA):
    return json.loads(fetch_text(url, ua=ua))


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
    dest_path.parent.mkdir(parents=True, exist_ok=True)
    out.save(dest_path, "JPEG", quality=90, optimize=True)


def strip_private(rows: list[dict]) -> list[dict]:
    return [{k: v for k, v in r.items() if not k.startswith("_")} for r in rows]


def download_blend_images(catalog: list[dict], processed: Path, raw: Path) -> dict[str, str]:
    processed.mkdir(parents=True, exist_ok=True)
    raw.mkdir(parents=True, exist_ok=True)
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
        dest = processed / f"{slugify(name)}.jpg"
        if dest.exists() and dest.stat().st_size > 0:
            blend_images[name] = str(dest)
            continue
        try:
            data = fetched.get(url) or fetch(url)
            fetched[url] = data
            raw_path = raw / Path(urllib.parse.urlparse(url).path).name
            if not raw_path.suffix:
                raw_path = raw / f"{slugify(name)}.bin"
            raw_path.write_bytes(data)
            recolor_and_crop(data, dest)
            blend_images[name] = str(dest)
            print(f"  processed: {name}")
            time.sleep(0.08)
        except Exception as exc:
            print(f"  image fail {name}: {exc}")
            blend_images[name] = ""
    return blend_images


def write_catalog(
    catalog: list[dict],
    assets: Path,
    tmp: Path,
    blend_images: dict[str, str] | None = None,
):
    assets.mkdir(parents=True, exist_ok=True)
    tmp.mkdir(parents=True, exist_ok=True)
    clean = strip_private(catalog)
    (assets / "catalog.json").write_text(
        json.dumps(clean, indent=2, ensure_ascii=False) + "\n"
    )
    (tmp / "catalog.json").write_text(
        json.dumps(catalog, indent=2, ensure_ascii=False) + "\n"
    )
    if blend_images is not None:
        (tmp / "blend-images.json").write_text(
            json.dumps(blend_images, indent=2, ensure_ascii=False) + "\n"
        )
    names = sorted({r["name"] for r in clean})
    print(f"Wrote {assets / 'catalog.json'} ({len(clean)} rows, {len(names)} blends)")
    for n in names:
        sizes = [r for r in clean if r["name"] == n]
        print(f"  - {n}: {len(sizes)} sizes")
    if blend_images:
        missing = [n for n in names if not blend_images.get(n)]
        if missing:
            print(f"Missing images ({len(missing)}): {missing}")


def clip_desc(text: str, limit: int = 900) -> str:
    cut = re.sub(r"\s+", " ", text or "").strip()
    if len(cut) > limit:
        cut = cut[:limit].rsplit(".", 1)[0] + "."
    return cut
