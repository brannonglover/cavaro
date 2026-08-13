#!/usr/bin/env python3
"""
Parse Plasencia catalog from:
  1) Official site collection pages (sizes + blend metadata)
  2) SharePoint TOOLKIT/Cigar Portfolio (product list + single-cigar images)

Writes:
  assets/plasencia/catalog.json
  tmp/plasencia/blend-images.json
  tmp/plasencia/processed/*.jpg  (optional, after image download)

Usage (from repo root or server/):
  python3 scripts/parsePlasenciaCatalog.py
  python3 scripts/parsePlasenciaCatalog.py --download-images
  python3 scripts/parsePlasenciaCatalog.py --refresh-web
"""

from __future__ import annotations

import argparse
import json
import re
import ssl
import time
import urllib.parse
import urllib.request
import http.cookiejar
from html import unescape
import unicodedata
from pathlib import Path
from xml.etree import ElementTree as ET

REPO = Path(__file__).resolve().parents[2]
TMP = REPO / "tmp" / "plasencia"
ASSETS = REPO / "assets" / "plasencia"
PROCESSED = TMP / "processed"

SHARE_URL = (
    "https://appriver3651015461.sharepoint.com/:f:/s/marketing/"
    "IgDYULzwpTeRTanKEfNU2Y6iAYtiXRhxBJ1-veV3VC0YlaY?e=amy5rg"
)
SP_BASE = "https://appriver3651015461.sharepoint.com/sites/marketing"
SP_PORTFOLIO = (
    "/sites/marketing/Dropbox Migrations/PLA SALES HUB/MARKETING/BRANDING/"
    "TOOLKIT/Cigar Portfolio"
)
SITE = "https://www.plasenciacigars.com"

FRAC = re.compile(
    r"(\d+)\s*(?:<small[^>]*>\s*)?<sup>(\d+)</sup>\s*/\s*<sub>(\d+)</sub>\s*(?:</small>)?",
    re.I,
)
SIZE = re.compile(r"(\d+(?:\s+\d+/\d+)?)\s*[xX×]\s*(\d{2,3})")

# SharePoint folder name → catalog blend `name`
SP_LINE_TO_NAME = {
    "Alma del Campo": "Alma del Campo",
    "Alma del Cielo": "Alma del Cielo",
    "Alma del Fuego": "Alma del Fuego",
    "Alma Fuerte Black": "Alma Fuerte",
    "Alma Fuerte Green": "Alma Fuerte Colorado Claro",
    "Cosecha 149": "Cosecha 149",
    "Cosecha 151": "Cosecha 151",
    "Reserva Original": "Reserva Original",
    "Triunfal 2026": "Triunfal",
}

# Website collection slug → catalog blend `name` (default = title-cased slug)
WEB_SLUG_TO_NAME = {
    "alma-del-campo": "Alma del Campo",
    "alma-del-cielo": "Alma del Cielo",
    "alma-del-fuego": "Alma del Fuego",
    "alma-fuerte": "Alma Fuerte",  # split further by vitola
    "cosecha-149": "Cosecha 149",
    "cosecha-151": "Cosecha 151",
    "reserva-original": "Reserva Original",
    "triunfal": "Triunfal",
    "year-of-the-horse-2026": "Year of the Horse",
}

# Alma Fuerte Colorado Claro vitola titles (website) / SharePoint Green folders
ALMA_FUERTE_COLORADO_CLARO = {
    "eduardo i",
    "robustus ii",
    "robusto corto",
    "rubustus corto",
    "sixto i",
}

# Skip non-product folders under lines (exact normalize_key match).
# Also skipped by substring: names containing "taa" or "2 pack".
SKIP_FOLDERS = {
    "2 pack",
    "2 pack (int only)",
    "5 pack",
    "5 packs",
    "accesories",
    "accessories",
    "beauty shots",
    "townhall",
    "web banners",
    "taa exclusive",
    "taa exclusive 2024",
    "cortez taa",
    "sixto i tubos",
    "sixto i tubos 3 pk",
}

# Known tobacco / descriptions when website table is messy
BLEND_META = {
    "Alma Fuerte": {
        "wrapper": "Nicaragua",
        "binder": "Nicaragua",
        "filler": "Nicaragua",
        "description": (
            "Plasencia Alma Fuerte, a unique blend of our best-aged tobaccos, "
            "grown in our highest quality soil, accentuating their bold, vibrant "
            "and intense flavors. With hints of dark chocolate, plum, and cinnamon, "
            "the taste is rounded out with finishing notes of oak and molasses."
        ),
    },
    "Alma Fuerte Colorado Claro": {
        "wrapper": "Nicaragua Colorado Claro",
        "binder": "Nicaragua",
        "filler": "Nicaragua",
        "description": (
            "Plasencia Alma Fuerte Colorado Claro uses a 10-year-aged Colorado Claro "
            "wrapper over the Alma Fuerte core blend, delivering cocoa and almonds "
            "with hints of nutmeg and cedar."
        ),
    },
    "Alma del Campo": {
        "wrapper": "Nicaragua",
        "binder": "Nicaragua",
        "filler": "Nicaragua",
        "description": (
            "Plasencia Alma del Campo, a complex smoke with a perfect balance "
            "delivering notes of coffee and nuts. A very creamy cigar with a touch "
            "of spice. The finish leaves a lasting impression on the palate."
        ),
    },
    "Alma del Fuego": {
        "wrapper": "Nicaragua Sun Grown",
        "binder": "Nicaragua",
        "filler": "Nicaragua",
        "description": (
            "Plasencia Alma del Fuego radiates passion and highlights the strong "
            "character of the volcanic soil that stems from the Ometepe Island. "
            "The cigar offers a hint of spice, complemented by savory notes of "
            "tangerine, roasted cashews, and guava wood."
        ),
    },
    "Alma del Cielo": {
        "wrapper": "Nicaragua",
        "binder": "Nicaragua",
        "filler": "Nicaragua",
        "description": (
            "The world's highest elevation cigar, grown at 1,300 meters above sea "
            "level at Finca San Julián in Condega. Opens with marzipan and honey, "
            "then earthy undertones and orange zest, finishing with cedar, nougat, "
            "and ginger spice."
        ),
    },
    "Cosecha 149": {
        "wrapper": "Honduras",
        "binder": "Honduras",
        "filler": "Honduras",
        "description": (
            "Plasencia Cosecha 149 is a rich, balanced puro and our first "
            "all-Honduran cigar. Full-bodied, medium- to full-strength, with notes "
            "of cream, dark chocolate, and a subtle earthy hint of cedar."
        ),
    },
    "Cosecha 151": {
        "wrapper": "Honduras",
        "binder": "Honduras",
        "filler": "Honduras",
        "description": (
            "Plasencia Cosecha 151 is a bold, full-bodied 100% Honduran cigar "
            "commemorating the 151st continuous harvest. Notes of roasted coffee "
            "and pecans, dark chocolate and prunes, with cinnamon and oak."
        ),
    },
    "Reserva Original": {
        "wrapper": "Nicaragua Organic",
        "binder": "Nicaragua Organic",
        "filler": "Nicaragua Organic",
        "description": (
            "Plasencia Reserva Original features notes of nuts, fruits, and caramel "
            "with delicate nuances of marzipan and final hints of cedar. The world's "
            "first certified organic cigar."
        ),
    },
    "Triunfal": {
        "wrapper": "Nicaragua",
        "binder": "Nicaragua",
        "filler": "Nicaragua",
        "description": (
            "Plasencia Triunfal is the 2026 Mundial Limited Edition, a tribute to "
            "unity and triumph."
        ),
    },
    "Year of the Horse": {
        "wrapper": "Nicaragua",
        "binder": "Nicaragua",
        "filler": "Nicaragua",
        "description": "Plasencia Year of the Horse 2026 limited edition.",
    },
}


def slugify(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", value.lower()).strip("_")


def normalize_key(value: str) -> str:
    """Lowercase ASCII key; strip accents (incl. Ú/ú) so LA MÚSICA == La Musica."""
    value = unescape(value or "")
    value = unicodedata.normalize("NFD", value)
    value = "".join(c for c in value if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9]+", " ", value.lower()).strip()


def should_skip_folder(name: str) -> bool:
    key = normalize_key(name)
    if key in SKIP_FOLDERS:
        return True
    if "taa" in key or "2 pack" in key:
        return True
    return False


def normalize_length(text: str) -> tuple[str | None, str]:
    t = FRAC.sub(r"\1 \2/\3", text)
    t = re.sub(r"<[^>]+>", " ", t)
    t = unescape(t).replace("\u2013", "-").replace("\u2014", "-")
    t = re.sub(r"(\d+)\s*[-–]?\s*(\d+)\s*/\s*(\d+)", r"\1 \2/\3", t)
    t = re.sub(r"\s+", " ", t).strip()
    m = SIZE.search(t)
    if not m:
        return None, t
    length = f"{m.group(1)}x{m.group(2)}"
    length = re.sub(r"\s*x\s*", "x", length)
    return length, t


class Http:
    def __init__(self):
        ctx = ssl.create_default_context()
        self.cj = http.cookiejar.CookieJar()
        self.opener = urllib.request.build_opener(
            urllib.request.HTTPCookieProcessor(self.cj),
            urllib.request.HTTPSHandler(context=ctx),
        )

    def fetch(self, url: str, accept: str | None = None) -> bytes:
        headers = {"User-Agent": "Mozilla/5.0"}
        if accept:
            headers["Accept"] = accept
        req = urllib.request.Request(url, headers=headers)
        with self.opener.open(req, timeout=90) as r:
            return r.read()

    def fetch_text(self, url: str) -> str:
        return self.fetch(url).decode("utf-8", "ignore")

    def sp_auth(self):
        self.fetch(SHARE_URL)

    def sp_json(self, url: str) -> dict:
        return json.loads(self.fetch(url, "application/json;odata=verbose").decode())

    def sp_list_folders(self, server_rel: str) -> list[tuple[str, str]]:
        enc = urllib.parse.quote(server_rel)
        url = (
            f"{SP_BASE}/_api/web/GetFolderByServerRelativePath(decodedurl='{enc}')"
            f"/Folders?$select=Name,ServerRelativeUrl"
        )
        data = self.sp_json(url)
        return [(i["Name"], i["ServerRelativeUrl"]) for i in data["d"]["results"]]

    def sp_list_files(self, server_rel: str) -> list[tuple[str, str, int | None]]:
        enc = urllib.parse.quote(server_rel)
        url = (
            f"{SP_BASE}/_api/web/GetFolderByServerRelativePath(decodedurl='{enc}')"
            f"/Files?$select=Name,ServerRelativeUrl,Length"
        )
        data = self.sp_json(url)
        return [
            (i["Name"], i["ServerRelativeUrl"], i.get("Length"))
            for i in data["d"]["results"]
        ]

    def sp_download(self, server_rel: str) -> bytes:
        enc = urllib.parse.quote(server_rel)
        url = f"{SP_BASE}/_api/web/GetFileByServerRelativePath(decodedurl='{enc}')/$value"
        return self.fetch(url)


def tidy_title(title: str) -> str:
    """Fix mashed titles like RubustusCorto / GranToro / ParejoGordo."""
    title = re.sub(r"\s+", " ", title).strip()
    fixes = {
        "rubustuscorto": "Robusto Corto",
        "robustuscorto": "Robusto Corto",
        "grantoro": "Gran Toro",
        "parejogordo": "Parejo Gordo",
        "travesia box pressed": "Travesía",
        "travesía box pressed": "Travesía",
    }
    key = normalize_key(title)
    if key in fixes:
        return fixes[key]
    # Insert space before capitals in CamelCase mashed words
    if " " not in title and re.search(r"[a-z][A-Z]", title):
        title = re.sub(r"([a-z])([A-Z])", r"\1 \2", title)
    return title


def parse_collection_items(html: str) -> list[dict]:
    items = []
    for m in re.finditer(r'<div class="item">([\s\S]*?)</div>', html):
        block = m.group(1)
        title_m = re.search(r'<h3 class="title[^"]*">([\s\S]*?)</h3>', block)
        sub_m = re.search(r'<h3 class="subtitle[^"]*">([\s\S]*?)</h3>', block)
        img_m = re.search(r'src="([^"]+)"', block)
        if not title_m:
            continue
        title = tidy_title(
            re.sub(r"<[^>]+>", "", unescape(title_m.group(1))).strip()
        )
        subtitle_html = sub_m.group(1) if sub_m else ""
        length, subtitle_text = (
            normalize_length(subtitle_html) if subtitle_html else (None, "")
        )
        size_label = subtitle_text
        if length:
            size_label = SIZE.sub("", size_label).strip(" -–")
        size_label = re.sub(r"\s+", " ", size_label).strip()
        items.append(
            {
                "title": title,
                "size_label": size_label or title,
                "length": length,
                "web_image": img_m.group(1) if img_m else "",
            }
        )
    return items


def resolve_blend_name(collection_slug: str, vitola_title: str) -> str:
    if collection_slug == "alma-fuerte":
        key = normalize_key(vitola_title)
        if key in ALMA_FUERTE_COLORADO_CLARO:
            return "Alma Fuerte Colorado Claro"
        return "Alma Fuerte"
    return WEB_SLUG_TO_NAME.get(collection_slug, collection_slug.replace("-", " ").title())


def refresh_web(http: Http) -> dict:
    TMP.mkdir(parents=True, exist_ok=True)
    cigar_xml = http.fetch_text(f"{SITE}/cigar-sitemap.xml")
    coll_xml = http.fetch_text(f"{SITE}/collection-sitemap.xml")
    (TMP / "cigar-sitemap.xml").write_text(cigar_xml)
    (TMP / "collection-sitemap.xml").write_text(coll_xml)

    collections = [
        loc.text
        for loc in ET.fromstring(coll_xml).findall(
            ".//{http://www.sitemaps.org/schemas/sitemap/0.9}loc"
        )
        if loc.text and loc.text.rstrip("/") != f"{SITE}/collection"
    ]

    parsed = {}
    for url in collections:
        slug = url.rstrip("/").split("/")[-1]
        html = http.fetch_text(url)
        (TMP / f"collection_{slug}.html").write_text(html)
        items = parse_collection_items(html)
        parsed[slug] = {"url": url, "items": items}
        print(f"  web {slug}: {len(items)} vitolas")
        time.sleep(0.1)
    (TMP / "parsed_collections.json").write_text(
        json.dumps(parsed, indent=2, ensure_ascii=False)
    )
    return parsed


def load_web_sizes() -> dict[str, dict]:
    """Map normalize_key(vitola title) → {length, size_label, collection, web_image}."""
    parsed_path = TMP / "parsed_collections.json"
    if parsed_path.exists():
        parsed = json.loads(parsed_path.read_text())
    else:
        parsed = {}
        for html_path in TMP.glob("collection_*.html"):
            slug = html_path.stem.replace("collection_", "")
            items = parse_collection_items(html_path.read_text())
            parsed[slug] = {"items": items}
            print(f"  local web {slug}: {len(items)} vitolas")

    by_vitola: dict[str, dict] = {}
    for slug, data in parsed.items():
        for item in data.get("items") or []:
            key = normalize_key(item["title"])
            blend = resolve_blend_name(slug, item["title"])
            by_vitola[key] = {
                "vitola": item["title"],
                "size_label": item.get("size_label") or item["title"],
                "length": item.get("length"),
                "blend": blend,
                "line": WEB_SLUG_TO_NAME.get(
                    slug, slug.replace("-", " ").title()
                )
                if slug != "alma-fuerte"
                else blend,
                "web_image": item.get("web_image") or "",
                "collection_slug": slug,
            }
            # also index under size_label for Reserva Original where title==Robusto
            by_vitola[normalize_key(f"{blend} {item['title']}")] = by_vitola[key]
    return by_vitola


def pick_single_image(files: list[tuple[str, str, int | None]]) -> tuple[str, str] | None:
    """Prefer WEB vertical single cigar images."""
    candidates = []
    for name, rel, size in files:
        lower = name.lower()
        if not lower.endswith((".jpg", ".jpeg", ".png", ".webp")):
            continue
        if "single" not in lower:
            continue
        if "box" in lower and "single" not in lower:
            continue
        score = 0
        if "web" in lower:
            score += 10
        if "vert" in lower:
            score += 5
        if "horiz" in lower:
            score += 2
        if "box pressed" in lower or "box_pressed" in lower:
            score -= 1
        if "hr" in lower or "hires" in lower or "hi-res" in lower:
            score -= 3
        candidates.append((score, size or 0, name, rel))
    if not candidates:
        # fallback: any image with 'cigar' and not box
        for name, rel, size in files:
            lower = name.lower()
            if lower.endswith((".jpg", ".jpeg", ".png", ".webp")) and "box" not in lower:
                if "cigar" in lower or "beauty" in lower:
                    candidates.append((0, size or 0, name, rel))
    if not candidates:
        return None
    candidates.sort(key=lambda x: (-x[0], x[1]))  # best score, then smaller (web)
    return candidates[0][2], candidates[0][3]


def walk_sharepoint_portfolio(http: Http) -> list[dict]:
    http.sp_auth()
    products = []
    line_folders = http.sp_list_folders(SP_PORTFOLIO)

    # Optional archived singles map for empty active folders (e.g. Alma del Fuego)
    archived_singles: dict[str, list[tuple[str, str, int | None]]] = {}
    archived_root = f"{SP_PORTFOLIO}/AArchived High Resolution/2 High Res CIGARS"
    try:
        for name, url in http.sp_list_folders(archived_root):
            # e.g. "Alma del Fuego - Singles"
            key = normalize_key(name.replace("- Singles", "").replace("Singles", ""))
            files = []
            for sub_name, sub_url in http.sp_list_folders(url):
                files.extend(http.sp_list_files(sub_url))
            files.extend(http.sp_list_files(url))
            archived_singles[key] = files
            print(f"  archived singles: {name} ({len(files)} files)")
    except Exception as e:
        print(f"  archived singles unavailable: {e}")

    for line_name, line_url in sorted(line_folders, key=lambda x: x[0].lower()):
        if line_name.startswith("AARCHIVED") or line_name.startswith("AArchived"):
            continue
        if line_name.startswith("Coleccion"):
            continue  # multi-pack collections, not single blends
        if line_name.endswith("Exclusive"):
            continue
        if line_name not in SP_LINE_TO_NAME and "Year" not in line_name and "Horse" not in line_name:
            print(f"  skip SP line: {line_name}")
            continue

        blend = SP_LINE_TO_NAME.get(line_name, line_name)
        vitola_folders = http.sp_list_folders(line_url)
        files_at_line = http.sp_list_files(line_url)

        # Triunfal may store singles at line root / Beauty Shots
        if line_name.startswith("Triunfal"):
            img = pick_single_image(files_at_line)
            for sub_name, sub_url in vitola_folders:
                if "beauty" in normalize_key(sub_name):
                    img = pick_single_image(http.sp_list_files(sub_url)) or img
            products.append(
                {
                    "blend": "Triunfal",
                    "line": "Triunfal",
                    "vitola": "Gran Toro",
                    "sp_folder": line_name,
                    "image_rel": img[1] if img else None,
                    "image_name": img[0] if img else None,
                }
            )
            print(f"  SP Triunfal / Gran Toro: {'img=' + img[0] if img else 'NO IMAGE'}")
            continue

        if not vitola_folders:
            # Empty active line — synthesize from website vitolas + archived images
            print(f"  empty SP line {line_name}; will fill from website")
            continue

        for vitola_name, vitola_url in sorted(vitola_folders, key=lambda x: x[0].lower()):
            if should_skip_folder(vitola_name):
                continue
            if "tubos" in normalize_key(vitola_name):
                continue
            files = http.sp_list_files(vitola_url)
            img = pick_single_image(files)
            if not img:
                # try archived singles for this blend
                arch = archived_singles.get(normalize_key(blend)) or archived_singles.get(
                    normalize_key(line_name)
                )
                if arch:
                    # filter files matching vitola token
                    token = normalize_key(vitola_name).split()[0]
                    filtered = [f for f in arch if token in normalize_key(f[0])]
                    img = pick_single_image(filtered or arch)
            products.append(
                {
                    "blend": blend,
                    "line": blend,
                    "vitola": vitola_name,
                    "sp_folder": f"{line_name}/{vitola_name}",
                    "image_rel": img[1] if img else None,
                    "image_name": img[0] if img else None,
                }
            )
            print(
                f"  SP {blend} / {vitola_name}: "
                f"{'img=' + img[0] if img else 'NO IMAGE'}"
            )
            time.sleep(0.05)
    return products


def match_size(product: dict, web_by_vitola: dict) -> dict | None:
    candidates = [
        normalize_key(product["vitola"]),
        normalize_key(product["vitola"].replace("Madrono", "Madroño")),
        normalize_key(product["vitola"].replace("Generacion", "Generación")),
        normalize_key(product["vitola"].replace("Nestor", "Néstor")),
        normalize_key(product["vitola"].replace("Travesia", "Travesía")),
        normalize_key(product["vitola"].replace("Concepcion", "Concepción")),
        normalize_key(product["vitola"].replace("La Musica", "La Música")),
        normalize_key(product["vitola"].replace("La Tradicion", "La Tradición")),
        normalize_key(product["vitola"].replace("Nesticos", "Nestico")),
        normalize_key(product["vitola"].replace("Robustus Corto", "Robusto Corto")),
        normalize_key(product["vitola"].replace("Robustus I", "Robustus")),
    ]
    # Reserva Original: folder name IS the size label
    blend_key = normalize_key(f"{product['blend']} {product['vitola']}")
    candidates.append(blend_key)

    for key in candidates:
        hit = web_by_vitola.get(key)
        if hit and hit.get("length"):
            # Prefer matching blend when multiple
            if normalize_key(hit["blend"]) == normalize_key(product["blend"]):
                return hit
            if not normalize_key(hit["blend"]).startswith("alma fuerte") or normalize_key(
                product["blend"]
            ).startswith("alma fuerte"):
                return hit
    for key in candidates:
        if key in web_by_vitola and web_by_vitola[key].get("length"):
            return web_by_vitola[key]
    return None


# Manual size fallbacks when website missing (SharePoint-only / limited)
MANUAL_SIZES = {
    ("reserva original", "churchill"): ("Churchill", "7x48"),
    ("reserva original", "corona"): ("Corona", "6 1/4x44"),
    ("reserva original", "nesticos"): ("Nestico", "4 1/2x36"),
    ("reserva original", "nestico"): ("Nestico", "4 1/2x36"),
    ("triunfal", "gran toro"): ("Gran Toro", "6 1/4x54"),
    ("triunfal", "triunfal 2026"): ("Gran Toro", "6 1/4x54"),
    ("year of the horse", "parejo gordo"): ("Parejo Gordo", "7x58"),
}

# Extra web-image fallbacks for lines with empty SP folders (Alma del Fuego)
WEB_VITOLA_IMAGES = {
    ("alma del fuego", "candente"): (
        "https://cdn.republicahavas.com/sites/pc/uploads/2019/06/"
        "plasencia-alma-del-fuego-robusto-Vitola-0519-V1.png"
    ),
    ("alma del fuego", "flama"): (
        "https://cdn.republicahavas.com/sites/pc/uploads/2019/06/"
        "plasencia-alma-del-fuego-panatela-vitola-0519-V1.png"
    ),
    ("alma del fuego", "concepcion"): (
        "https://cdn.republicahavas.com/sites/pc/uploads/2019/06/"
        "plasencia-alma-del-fuego-toro-Vitola-0519-V1.png"
    ),
    ("alma del fuego", "concepción"): (
        "https://cdn.republicahavas.com/sites/pc/uploads/2019/06/"
        "plasencia-alma-del-fuego-toro-Vitola-0519-V1.png"
    ),
}


def build_catalog(sp_products: list[dict], web_by_vitola: dict) -> list[dict]:
    rows = []
    seen = set()

    # Prefer SharePoint as product authority (current portfolio)
    for product in sp_products:
        web = match_size(product, web_by_vitola)
        vitola = product["vitola"]
        # Normalize display names
        display_vitola = vitola
        renames = {
            "Concepcion": "Concepción",
            "Madrono": "Madroño",
            "Generacion V": "Generación V",
            "Nestor IV": "Néstor IV",
            "Travesia": "Travesía",
            "La Musica": "La Música",
            "La Tradicion": "La Tradición",
            "Nesticos": "Nestico",
            "Robustus Corto": "Robusto Corto",
            "Robustus I": "Robustus I",
        }
        display_vitola = renames.get(vitola, vitola)

        length = web["length"] if web else None
        size_label = web["size_label"] if web else None
        if not length:
            manual = MANUAL_SIZES.get(
                (normalize_key(product["blend"]), normalize_key(vitola))
            )
            if manual:
                size_label, length = manual

        if not length:
            print(f"  WARN no size for {product['blend']} / {display_vitola}")
            continue

        # Plasencia size_name = branded vitola name (Candente, Guajiro, …)
        size_name = display_vitola
        blend = product["blend"]
        meta = BLEND_META.get(blend, {})
        key = (blend, size_name, length)
        if key in seen:
            continue
        seen.add(key)
        web_image = (web.get("web_image") if web else "") or ""
        if not web_image:
            web_image = WEB_VITOLA_IMAGES.get(
                (normalize_key(blend), normalize_key(size_name)), ""
            )
        rows.append(
            {
                "brand": "Plasencia",
                "name": blend,
                "line": blend,
                "description": meta.get("description", ""),
                "wrapper": meta.get("wrapper", ""),
                "binder": meta.get("binder", ""),
                "filler": meta.get("filler", ""),
                "length": length,
                "size_name": size_name,
                "image": "",
                "_sp_image_rel": product.get("image_rel"),
                "_sp_image_name": product.get("image_name"),
                "_web_image": web_image,
                "_shape": size_label or "",
            }
        )

    # Add website-only current products missing from SharePoint (e.g. Alma del Fuego, Year of Horse)
    sp_keys = {(normalize_key(r["name"]), normalize_key(r["size_name"])) for r in rows}
    for web in web_by_vitola.values():
        blend = web["blend"]
        vitola = web["vitola"]
        # skip duplicate object aliases
        k = (normalize_key(blend), normalize_key(vitola))
        if k in sp_keys:
            continue
        if not web.get("length"):
            continue
        # Skip discontinued Cosecha 146 if somehow present
        if "146" in blend:
            continue
        meta = BLEND_META.get(blend, {})
        rows.append(
            {
                "brand": "Plasencia",
                "name": blend,
                "line": blend,
                "description": meta.get("description", ""),
                "wrapper": meta.get("wrapper", ""),
                "binder": meta.get("binder", ""),
                "filler": meta.get("filler", ""),
                "length": web["length"],
                "size_name": vitola,
                "image": "",
                "_sp_image_rel": None,
                "_sp_image_name": None,
                "_web_image": web.get("web_image") or "",
                "_shape": web.get("size_label") or "",
            }
        )
        sp_keys.add(k)
        print(f"  + web-only {blend} / {vitola} ({web['length']})")

    rows.sort(key=lambda r: (r["name"].lower(), r["size_name"].lower(), r["length"]))
    return rows


def download_images(http: Http, catalog: list[dict]) -> dict[str, str]:
    """Download one image per blend+vitola; return map size key → local path.

    Import script keys images by blend name (shared), but Plasencia vitolas look
    different — store per vitola and let import attach per-row when available.
    """
    PROCESSED.mkdir(parents=True, exist_ok=True)
    http.sp_auth()
    blend_images: dict[str, str] = {}  # "blend||size_name" → path; also blend → first

    for row in catalog:
        key = f"{row['name']}||{row['size_name']}"
        out_name = slugify(f"{row['name']}_{row['size_name']}") + ".jpg"
        out_path = PROCESSED / out_name
        if out_path.exists() and out_path.stat().st_size > 0:
            blend_images[key] = str(out_path)
            blend_images.setdefault(row["name"], str(out_path))
            continue

        data = None
        if row.get("_sp_image_rel"):
            try:
                data = http.sp_download(row["_sp_image_rel"])
                print(f"  ↓ SP {row['name']} / {row['size_name']}")
            except Exception as e:
                print(f"  SP fail {row['name']}/{row['size_name']}: {e}")
        if data is None and row.get("_web_image"):
            try:
                data = http.fetch(row["_web_image"])
                print(f"  ↓ web {row['name']} / {row['size_name']}")
            except Exception as e:
                print(f"  web fail {row['name']}/{row['size_name']}: {e}")
        if not data:
            continue

        # Convert PNG→JPEG via Pillow if available; else write raw and rename
        try:
            from io import BytesIO
            from PIL import Image

            im = Image.open(BytesIO(data)).convert("RGBA")
            # composite onto dark brown similar to RP
            bg = Image.new("RGBA", im.size, (33, 25, 18, 255))
            composed = Image.alpha_composite(bg, im).convert("RGB")
            composed.save(out_path, "JPEG", quality=90)
        except Exception:
            # raw write
            raw_path = out_path.with_suffix(Path(row.get("_sp_image_name") or row.get("_web_image") or "x.jpg").suffix or ".jpg")
            raw_path.write_bytes(data)
            if raw_path != out_path:
                try:
                    from io import BytesIO
                    from PIL import Image

                    im = Image.open(raw_path).convert("RGB")
                    im.save(out_path, "JPEG", quality=90)
                    raw_path.unlink(missing_ok=True)
                except Exception:
                    out_path = raw_path

        blend_images[key] = str(out_path)
        blend_images.setdefault(row["name"], str(out_path))
        time.sleep(0.05)

    return blend_images


def strip_private(rows: list[dict]) -> list[dict]:
    clean = []
    for r in rows:
        clean.append({k: v for k, v in r.items() if not k.startswith("_")})
    return clean


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--refresh-web", action="store_true")
    parser.add_argument("--download-images", action="store_true")
    parser.add_argument("--skip-sharepoint", action="store_true")
    args = parser.parse_args()

    TMP.mkdir(parents=True, exist_ok=True)
    ASSETS.mkdir(parents=True, exist_ok=True)
    http = Http()

    if args.refresh_web or not list(TMP.glob("collection_*.html")):
        print("Refreshing website collection pages…")
        refresh_web(http)
    else:
        print("Using cached collection HTML in tmp/plasencia/")

    print("Parsing website sizes…")
    web_by_vitola = load_web_sizes()
    print(f"  {len(web_by_vitola)} web vitola keys")

    if args.skip_sharepoint and (TMP / "sp_products.json").exists():
        sp_products = json.loads((TMP / "sp_products.json").read_text())
        print(f"Using cached SP products: {len(sp_products)}")
    else:
        print("Walking SharePoint Cigar Portfolio…")
        sp_products = walk_sharepoint_portfolio(http)
        (TMP / "sp_products.json").write_text(
            json.dumps(sp_products, indent=2, ensure_ascii=False)
        )
        print(f"  {len(sp_products)} SP products")

    catalog = build_catalog(sp_products, web_by_vitola)
    print(f"Catalog rows: {len(catalog)}")

    if args.download_images:
        print("Downloading images…")
        blend_images = download_images(http, catalog)
        (TMP / "blend-images.json").write_text(json.dumps(blend_images, indent=2))
        print(f"  images: {len(blend_images)}")

    clean = strip_private(catalog)
    out = ASSETS / "catalog.json"
    out.write_text(json.dumps(clean, indent=2, ensure_ascii=False) + "\n")
    (TMP / "catalog.json").write_text(json.dumps(catalog, indent=2, ensure_ascii=False) + "\n")

    names = sorted({r["name"] for r in clean})
    print(f"Wrote {out} ({len(clean)} rows, {len(names)} blends)")
    for n in names:
        sizes = [r for r in clean if r["name"] == n]
        print(f"  - {n}: {len(sizes)} sizes")


if __name__ == "__main__":
    main()
