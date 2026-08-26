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


def _hex_to_rgb(value: str) -> tuple[int, int, int]:
    hex_value = value.replace("#", "").strip()
    return int(hex_value[0:2], 16), int(hex_value[2:4], 16), int(hex_value[4:6], 16)


def _soft_key_white(rgb, alpha=None, bg_rgb: tuple[int, int, int] = BG_RGB):
    """Replace studio white / light-gray with `bg_rgb`, keeping cigar chroma."""
    try:
        import numpy as np
    except ImportError:
        return None

    arr = np.asarray(rgb, dtype=np.float32)
    r, g, b = arr[..., 0], arr[..., 1], arr[..., 2]
    mx = np.maximum(np.maximum(r, g), b)
    mn = np.minimum(np.minimum(r, g), b)
    chroma = mx - mn
    luma = (r + g + b) / 3.0

    low, high = 178.0, 242.0
    t = np.clip((luma - low) / (high - low), 0.0, 1.0)
    t = t * t * (3.0 - 2.0 * t)
    chroma_keep = np.clip((chroma - 22.0) / 36.0, 0.0, 1.0)
    t = t * (1.0 - chroma_keep)

    if alpha is not None:
        a = np.asarray(alpha, dtype=np.float32) / 255.0
        t = 1.0 - (1.0 - t) * a

    mask = (t > 0.15).astype(np.uint8)
    padded = np.pad(mask, 1, mode="edge")
    dilated = np.maximum.reduce(
        [
            padded[0:-2, 0:-2],
            padded[0:-2, 1:-1],
            padded[0:-2, 2:],
            padded[1:-1, 0:-2],
            padded[1:-1, 1:-1],
            padded[1:-1, 2:],
            padded[2:, 0:-2],
            padded[2:, 1:-1],
            padded[2:, 2:],
        ]
    ).astype(np.float32)
    fringe = np.clip(dilated - mask.astype(np.float32), 0.0, 1.0)
    fringe_t = fringe * np.clip((luma - 160.0) / 70.0, 0.0, 1.0) * 0.85
    t = np.maximum(t, fringe_t)

    bg = np.array(bg_rgb, dtype=np.float32)
    keyed = arr * (1.0 - t[..., None]) + bg * t[..., None]
    return keyed


def _luma_chroma(arr):
    mx = arr.max(axis=2)
    mn = arr.min(axis=2)
    return arr.mean(axis=2), mx - mn


def _tobacco_mask(arr):
    """Pixels that look like cigar wrapper: mid luma, warm, moderately saturated.

    Deliberately excludes studio reflections (bright, neutral), black marketing
    panels and white paper, which is what makes it useful for finding the stick
    inside a branded graphic.
    """
    luma, chroma = _luma_chroma(arr)
    warm = arr[..., 0] > arr[..., 2] + 5
    return (luma > 42) & (luma < 190) & warm & (chroma > 8) & (chroma < 120)


def _backdrop_color(arr, bg):
    """Median colour of the outer frame, or the app surface when the frame is busy."""
    import numpy as np

    surface = np.asarray(bg, dtype=np.float32)
    h, w = arr.shape[:2]
    m = max(1, int(min(h, w) * 0.02))
    frame = np.concatenate(
        [
            arr[:m].reshape(-1, 3),
            arr[-m:].reshape(-1, 3),
            arr[:, :m].reshape(-1, 3),
            arr[:, -m:].reshape(-1, 3),
        ]
    )
    median = np.median(frame, axis=0)
    if float(np.abs(frame - median).mean()) > 26.0:
        return surface
    return median


def _subject_mask(arr, bg):
    """Everything that is neither the shot's own backdrop nor the app surface."""
    import numpy as np

    backdrop = _backdrop_color(arr, bg)
    surface = np.asarray(bg, dtype=np.float32)
    off_backdrop = np.linalg.norm(arr - backdrop, axis=2) > 26.0
    off_surface = np.linalg.norm(arr - surface, axis=2) > 16.0
    return off_backdrop & off_surface


def _runs(flags):
    """Inclusive (lo, hi) index pairs for each contiguous True stretch."""
    spans = []
    start = None
    for i, on in enumerate(flags):
        if on and start is None:
            start = i
        elif not on and start is not None:
            spans.append((start, i - 1))
            start = None
    if start is not None:
        spans.append((start, len(flags) - 1))
    return spans


def _otsu_split(values):
    """(threshold, dark mean, light mean) for the best two-class split, or None."""
    import numpy as np

    lo, hi = float(values.min()), float(values.max())
    if hi - lo < 1.0:
        return None
    best = None
    best_var = -1.0
    for threshold in np.linspace(lo, hi, 48)[1:-1]:
        dark = values <= threshold
        weight = float(dark.mean())
        if weight <= 0.0 or weight >= 1.0:
            continue
        dark_mean = float(values[dark].mean())
        light_mean = float(values[~dark].mean())
        variance = weight * (1.0 - weight) * (light_mean - dark_mean) ** 2
        if variance > best_var:
            best_var = variance
            best = (float(threshold), dark_mean, light_mean)
    return best


def _dominant_run(profile, hi_frac=0.55, lo_frac=0.30, min_len=4):
    """Heaviest contiguous run of a 1-D profile, ignoring faint neighbours."""
    peak = float(profile.max()) if profile.size else 0.0
    if peak <= 0.0:
        return None
    runs = _runs(profile >= peak * lo_frac)
    runs = [
        r
        for r in runs
        if (r[1] - r[0] + 1) >= min_len and float(profile[r[0] : r[1] + 1].max()) >= peak * hi_frac
    ]
    if not runs:
        return None
    return max(runs, key=lambda r: float(profile[r[0] : r[1] + 1].sum()))


def _slice_across(arr, run, across_rows, pad_frac=0.02):
    import numpy as np

    lo, hi = run
    limit = (arr.shape[0] if across_rows else arr.shape[1]) - 1
    pad = max(1, int((hi - lo + 1) * pad_frac))
    lo = max(0, lo - pad)
    hi = min(limit, hi + pad)
    section = arr[lo : hi + 1, :] if across_rows else arr[:, lo : hi + 1]
    return np.array(section, copy=True)


REFLECTION_GAP = 18.0
REFLECTION_LIMIT = 0.20


def _shed_reflection(arr, across_rows):
    """Drop the studio-floor reflection under a cigar that's lying on its side.

    Standing product shots only have cylinder shading, so they are left alone.
    Landscape marketing shots put a washed-out copy of the stick on the table;
    after white-keying that copy is a bright ridge along one long edge. Bands
    make a global dark/light split unreliable, so we only look near the ends
    and only keep a cut that leaves most of the stick.
    """
    if not across_rows:
        return arr
    import numpy as np

    luma = arr.mean(axis=2)
    count = luma.shape[0]
    if count < 16:
        return arr
    profile = np.percentile(luma, 30, axis=1)
    cap = max(4, int(count * REFLECTION_LIMIT))
    lo, hi = 0, count - 1
    inner = profile[cap : count - cap] if count > 2 * cap else profile
    body = float(np.median(inner)) if inner.size else float(np.median(profile))

    search = profile[count - cap :]
    if search.size >= 3:
        i = count - cap + int(np.argmax(search))
        ridge = float(profile[i])
        interior = profile[max(0, i - 14) : i]
        if interior.size >= 5:
            interior_med = float(np.median(interior))
            if ridge - interior_med >= REFLECTION_GAP and ridge > body + 8:
                j = i
                while j > 0 and profile[j] > interior_med + 4:
                    j -= 1
                if j >= count - cap and (j - lo + 1) >= count * 0.55:
                    hi = j

    search = profile[:cap]
    if search.size >= 3:
        i = int(np.argmax(search))
        ridge = float(profile[i])
        interior = profile[i + 1 : i + 15]
        if interior.size >= 5:
            interior_med = float(np.median(interior))
            if ridge - interior_med >= REFLECTION_GAP and ridge > body + 8:
                j = i
                while j < count - 1 and profile[j] > interior_med + 4:
                    j += 1
                if j <= cap and (hi - j + 1) >= count * 0.55:
                    lo = j

    if lo == 0 and hi == count - 1:
        return arr
    return _slice_across(arr, (lo, hi), across_rows, pad_frac=0.0)


WING_DENSITY = 0.70
WING_LIMIT = 0.20


def _trim_faint_wings(arr, bg, across_rows):
    """Shave the translucent duplicate stick that branded art leaves alongside.

    A ghost never covers its lane as solidly as the cigar does, so we walk in
    from each edge while tobacco stays faint. Only the outermost 20% of lanes
    are eligible, so a real stick can never be narrowed.
    """
    import numpy as np

    tobacco = _tobacco_mask(arr)
    lanes = tobacco.mean(axis=1) if across_rows else tobacco.mean(axis=0)
    count = lanes.size
    if count < 16:
        return arr
    thresh = float(np.percentile(lanes, 85)) * WING_DENSITY
    if thresh <= 0.0:
        return arr
    cap = max(2, int(count * WING_LIMIT))
    lo = 0
    while lo < cap and float(lanes[lo]) < thresh:
        lo += 1
    hi = count - 1
    while hi > count - 1 - cap and float(lanes[hi]) < thresh:
        hi -= 1
    if lo == 0 and hi == count - 1:
        return arr
    if hi - lo + 1 < count * 0.55:
        return arr
    return _slice_across(arr, (lo, hi), across_rows, pad_frac=0.0)


def _cigar_lies_horizontal(arr):
    """True when the stick is lying on its side in this frame.

    Landscape marketing shots put extras (copy, a floor reflection) above and
    below a horizontal cigar, so we slice across rows. A square frame of a
    standing cigar must not be treated the same way — `w >= h` would slice it
    into a ribbon. Already-tall portraits (including dark wrappers on the app
    surface, where the tobacco mask goes patchy) stay standing.
    """
    h, w = arr.shape[:2]
    if h >= int(w * 1.35):
        return False
    if w >= int(h * 1.35):
        return True
    tobacco = _tobacco_mask(arr)
    row_run = _dominant_run(tobacco.mean(axis=1))
    col_run = _dominant_run(tobacco.mean(axis=0))

    def frac(run, n):
        if run is None:
            return None
        return (run[1] - run[0] + 1) / max(n, 1)

    row_frac, col_frac = frac(row_run, h), frac(col_run, w)
    if row_frac is None and col_frac is None:
        return w > h
    if row_frac is None:
        return False
    if col_frac is None:
        return True
    if abs(row_frac - col_frac) < 0.12:
        return w > h
    return row_frac < col_frac


def _isolate_stick(arr, bg):
    """Crop across the stick so reflections, watermark text and banners fall away.

    Product shots stack extras along the short axis: a mirrored stick under the
    cigar, a paragraph of copy beside it, or a black marketing panel above it.
    None of those read as tobacco, so the heaviest tobacco run is the cigar.
    """
    across_rows = _cigar_lies_horizontal(arr)
    tobacco = _tobacco_mask(arr)
    profile = tobacco.mean(axis=1) if across_rows else tobacco.mean(axis=0)
    run = _dominant_run(profile)
    if run is not None:
        arr = _slice_across(arr, run, across_rows)
    arr = _shed_reflection(arr, across_rows)
    return _trim_faint_wings(arr, bg, across_rows)


def _flatten_backdrop(arr, bg):
    """Fold whatever backdrop survived keying (black boxes, grey seamless) into the surface."""
    import numpy as np

    backdrop = _backdrop_color(arr, bg)
    surface = np.asarray(bg, dtype=np.float32)
    if float(np.linalg.norm(backdrop - surface)) < 12.0:
        return arr
    dist = np.linalg.norm(arr - backdrop, axis=2)
    t = np.clip(1.0 - dist / 26.0, 0.0, 1.0)[..., None]
    return arr * (1.0 - t) + surface * t


def _tight_bbox(arr, bg, floor=0.15):
    """Bounding box of the stick, ignoring stray specks along either axis."""
    import numpy as np

    subject = _subject_mask(arr, bg)
    if subject.sum() < 200:
        return None
    rows = np.where(subject.mean(axis=1) >= floor)[0]
    cols = np.where(subject.mean(axis=0) >= floor)[0]
    if rows.size < 4 or cols.size < 4:
        return None
    return int(cols.min()), int(rows.min()), int(cols.max()), int(rows.max())


FOOT_RIBBON_GAP = 0.10
FOOT_RIBBON_MARGIN = 0.08
TIP_TAPER_RATIO = 1.6
TIP_TAPER_FLOOR = 0.05
TIP_TAPER_HOLD_RATIO = 2.0
TIP_TAPER_HOLD_FLOOR = 0.08
BAND_CENTROID_MARGIN = 0.10


def _tip_taper(width_profile, frac=0.07):
    """How much the outermost slice narrows against the stick just inside it.

    A cap is rounded or pointed, so it sheds width in the last few percent; a
    cut foot stays full width to the edge. Comparing against a *local* body
    width rather than the whole stick keeps a printed sleeve — which is simply
    narrower than the cigar over its whole length — from posing as a cap.
    """
    import numpy as np

    n = width_profile.size
    k = max(4, int(n * frac))
    if n < 3 * k:
        return 0.0
    local = float(np.median(width_profile[k : 3 * k]))
    if local <= 0.0:
        return 0.0
    return float(np.clip(local - width_profile[:k], 0.0, None).sum()) / (local * k)


def _band_rows(arr, subject, width_profile, body):
    """Rows covered by paper, foil or printed sleeve rather than wrapper."""
    import numpy as np

    band = (subject & ~_tobacco_mask(arr)).sum(axis=1) / max(body, 1.0)
    return np.where((band >= 0.45) & (width_profile >= body * 0.8))[0], band


def _band_centroid(band_coverage):
    """Vertical centre of mass of the bands, 0 at the top edge and 1 at the foot."""
    import numpy as np

    score = np.clip(band_coverage - 0.35, 0.0, None)
    total = float(score.sum())
    if total <= 0.0:
        return None
    ys = np.arange(score.size, dtype=np.float32)
    return float((score * ys).sum() / total) / float(score.size)


def _cap_at_top(arr, bg):
    """Rotate 180 when the cigar is standing on its head.

    Three signals in descending order of confidence:
      1. Ribbon position — printing flush with one end is a foot ribbon or a
         sleeve; head bands always sit back from the cap.
      2. Silhouette — only a cap sheds width in the last few percent, and it
         shed a good deal more of it than the opposite end does.
      3. Band mass — failing both, bands cluster nearer the head.

    Each signal needs a clear margin before it is allowed to act, so a stick
    that reads as roughly symmetric is left exactly as it came in. Every signal
    is antisymmetric under a 180 rotation, so running this on its own output
    can never flip an already-correct image.
    """
    import numpy as np

    height = arr.shape[0]
    if height < 24:
        return arr
    subject = _subject_mask(arr, bg)
    width_profile = subject.sum(axis=1).astype(np.float32)
    body = float(np.percentile(width_profile, 85))
    if body <= 0.0:
        return arr

    rows, coverage = _band_rows(arr, subject, width_profile, body)
    if rows.size:
        top_gap = float(rows.min()) / height
        bottom_gap = float(height - 1 - rows.max()) / height
        flush = min(top_gap, bottom_gap) <= FOOT_RIBBON_GAP
        if flush and abs(top_gap - bottom_gap) >= FOOT_RIBBON_MARGIN:
            return np.rot90(arr, 2) if top_gap < bottom_gap else arr

    # Figurados taper hard at both ends, so compare the tips as a ratio rather
    # than a difference; a fixed floor keeps sensor noise on a parejo out of it.
    top_tip = _tip_taper(width_profile)
    bottom_tip = _tip_taper(width_profile[::-1])
    if bottom_tip >= max(top_tip * TIP_TAPER_RATIO, top_tip + TIP_TAPER_FLOOR):
        return np.rot90(arr, 2)
    if top_tip >= max(
        bottom_tip * TIP_TAPER_HOLD_RATIO, bottom_tip + TIP_TAPER_HOLD_FLOOR
    ):
        return arr

    centroid = _band_centroid(coverage)
    if centroid is None or abs(centroid - 0.5) < BAND_CENTROID_MARGIN:
        return arr
    return np.rot90(arr, 2) if centroid > 0.5 else arr


def _crop_to_subject(arr, bg_rgb: tuple[int, int, int] = BG_RGB):
    try:
        import numpy as np
    except ImportError:
        return arr

    bg = np.array(bg_rgb, dtype=np.float32)
    arr = _flatten_backdrop(arr, bg)
    arr = _isolate_stick(arr, bg)
    bbox = _tight_bbox(arr, bg)
    if bbox is None:
        return arr
    x0, y0, x1, y1 = bbox
    crop = np.array(arr[y0 : y1 + 1, x0 : x1 + 1], copy=True)
    if crop.shape[1] > crop.shape[0]:
        crop = np.rot90(crop, 1)
    crop = _cap_at_top(crop, bg)

    bh, bw = crop.shape[0], crop.shape[1]
    cigar_width_frac = 0.68
    vert_pad_frac = 0.04
    pad_y = max(6, int(bh * vert_pad_frac))
    want_w = max(bw + 16, int(bw / cigar_width_frac))
    canvas = np.zeros((bh + pad_y * 2, want_w, 3), dtype=np.float32)
    canvas[:] = bg
    ox = (want_w - bw) // 2
    canvas[pad_y : pad_y + bh, ox : ox + bw] = crop
    return canvas


def recolor_and_crop(src: bytes, dest_path: Path, bg_rgb: tuple[int, int, int] = BG_RGB):
    """Soft-key white studio backdrops onto the app surface and crop to the cigar."""
    im = Image.open(io.BytesIO(src))
    has_alpha = im.mode in ("RGBA", "LA") or (im.mode == "P" and "transparency" in im.info)
    rgba = im.convert("RGBA") if has_alpha else None
    rgb = im.convert("RGB")

    keyed = _soft_key_white(
        rgb,
        alpha=rgba.split()[-1] if rgba is not None else None,
        bg_rgb=bg_rgb,
    )
    if keyed is not None:
        keyed = _crop_to_subject(keyed, bg_rgb=bg_rgb)
        try:
            import numpy as np

            out = Image.fromarray(np.clip(keyed, 0, 255).astype(np.uint8), "RGB")
        except ImportError:
            out = rgb
    else:
        if rgba is None:
            luma = rgb.convert("L")

            def to_alpha(p: int) -> int:
                if p >= 242:
                    return 0
                if p <= 198:
                    return 255
                return int((242 - p) * 255 / 44)

            rgba = rgb.convert("RGBA")
            rgba.putalpha(luma.point(to_alpha))

        alpha = rgba.split()[-1]
        bbox = alpha.getbbox()
        if bbox:
            x0, y0, x1, y1 = bbox
            pad_x = max(8, int((x1 - x0) * 0.12))
            pad_y = max(8, int((y1 - y0) * 0.04))
            x0 = max(0, x0 - pad_x)
            y0 = max(0, y0 - pad_y)
            x1 = min(rgba.width, x1 + pad_x)
            y1 = min(rgba.height, y1 + pad_y)
            rgba = rgba.crop((x0, y0, x1, y1))

        bg = Image.new("RGBA", rgba.size, (*bg_rgb, 255))
        out = Image.alpha_composite(bg, rgba).convert("RGB")
        if out.size[0] > out.size[1]:
            out = out.rotate(90, expand=True)

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


if __name__ == "__main__":
    import sys

    if len(sys.argv) < 3:
        print("Usage: catalogCommon.py SRC DST [BG_HEX]", file=sys.stderr)
        sys.exit(1)
    src_path = Path(sys.argv[1])
    dest_path = Path(sys.argv[2])
    bg = _hex_to_rgb(sys.argv[3]) if len(sys.argv) > 3 else BG_RGB
    recolor_and_crop(src_path.read_bytes(), dest_path, bg_rgb=bg)
    print(dest_path)
