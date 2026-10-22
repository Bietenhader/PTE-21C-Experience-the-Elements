# SPDX-License-Identifier: CC-BY-NC-SA-4.0
"""Select, convert and credit the element photographs (SPEC §12, §15.3–15.4).

Reads tools/curated/images.toml (what each element shows), the cached element pages and photos
of images-of-elements.com and the cached Commons file records (tools/fetch_images.py), and writes

    public/img/elements/{Z}/{k}-800.webp and {k}-320.webp   resized only: never cropped or recoloured
    public/img/elements/{Z}/credits.json                    title, author, licence, source, attribution
    tools/images-report.md (+ a copy in tools/raw/)          candidates per element, and why each
                                                             was accepted or rejected (Fin reviews it)

and returns, per element, the ImageRef / ImagePlaceholder list for index.json. A source file
that is not cached keeps the previously built WebP files if their credits still match; otherwise
the element falls back to its placeholder and the report says so loudly.
"""

from __future__ import annotations

import html
import json
import re
import shutil
import tomllib
from pathlib import Path

import fetch_images
from common import CURATED_DIR, NUM_ELEMENTS, REPO_ROOT, TOOLS_DIR, raw_path

IMG_DIR = REPO_ROOT / "public" / "img" / "elements"
SIZES = (800, 320)
WEBP_QUALITY = 82
SITE = fetch_images.SITE

# SPEC §15.3 allow-list. Name → licence URL. CC BY-SA, FAL and GFDL files are shown unmodified
# (resized only) with full credit; NC and ND licences are not on the list.
LICENCES = {
    "Public domain": "https://creativecommons.org/publicdomain/mark/1.0/",
    "CC0 1.0": "https://creativecommons.org/publicdomain/zero/1.0/",
    "CC BY 2.0": "https://creativecommons.org/licenses/by/2.0/",
    "CC BY 2.5": "https://creativecommons.org/licenses/by/2.5/",
    "CC BY 3.0": "https://creativecommons.org/licenses/by/3.0/",
    "CC BY 4.0": "https://creativecommons.org/licenses/by/4.0/",
    "CC BY-SA 2.0": "https://creativecommons.org/licenses/by-sa/2.0/",
    "CC BY-SA 2.5": "https://creativecommons.org/licenses/by-sa/2.5/",
    "CC BY-SA 3.0": "https://creativecommons.org/licenses/by-sa/3.0/",
    "CC BY-SA 4.0": "https://creativecommons.org/licenses/by-sa/4.0/",
    "FAL 1.3": "https://artlibre.org/licence/lal/en/",
    "GFDL 1.2": "https://www.gnu.org/licenses/old-licenses/fdl-1.2.html",
    "GFDL 1.3": "https://www.gnu.org/licenses/fdl-1.3.html",
}
# Most permissive first (SPEC §12.3): a multi-licensed Commons file is credited under the first
# licence of this list that it offers.
PREFERENCE = list(LICENCES)
# Commons licence categories / short names → our names.
COMMONS_LICENCE = {
    "public domain": "Public domain",
    "pd": "Public domain",
    "cc0": "CC0 1.0",
    "cc by 2.0": "CC BY 2.0",
    "cc by 2.5": "CC BY 2.5",
    "cc by 3.0": "CC BY 3.0",
    "cc by 4.0": "CC BY 4.0",
    "cc by-sa 2.0": "CC BY-SA 2.0",
    "cc by-sa 2.5": "CC BY-SA 2.5",
    "cc by-sa 3.0": "CC BY-SA 3.0",
    "cc by-sa 4.0": "CC BY-SA 4.0",
    "fal": "FAL 1.3",
    "gfdl": "GFDL 1.2",
}
KINDS = {"sample", "discharge_tube", "crystal", "powder", "liquid", "historical"}
SITE_AUTHOR = "Jürgen Kummer (images-of-elements.com)"

PLACEHOLDER_TEXT = {
    "never_visible": "No photograph exists: {name} has never been produced in a visible quantity.",
    "no_free_photo": "No openly licensed photograph was found: {name} has been made in visible amounts, "
    "but every photograph we know of is under a restrictive licence.",
    "source_unavailable_at_build": "Photograph not yet downloaded: an openly licensed photograph of {name} has "
    "been chosen (Wikimedia Commons), but the server refused the download when this data was built; it appears "
    "after the next data update.",
}


def load_rows() -> dict[int, dict]:
    rows = tomllib.loads((CURATED_DIR / "images.toml").read_text(encoding="utf-8")).get("element", [])
    out = {}
    for r in rows:
        if r["Z"] in out:
            raise ValueError(f"images.toml: Z={r['Z']} listed twice")
        for f, k in r.get("kind", {}).items():
            if k not in KINDS:
                raise ValueError(f"images.toml: Z={r['Z']} {f}: unknown kind {k!r}")
        out[r["Z"]] = r
    return out


def _strip(text: str | None) -> str:
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", text or ""))).strip()


def clean_author(text: str) -> str:
    """Commons' Artist field without wiki leftovers: "Alchemist-hp ( talk ) ( www.x.de )" → "Alchemist-hp (www.x.de)",
    and "Unknown author Unknown author" (a template rendered twice) → "Unknown author"."""
    t = re.sub(r"\(\s*(talk|contribs)\s*\)", "", text, flags=re.IGNORECASE)
    t = re.sub(r"\(\s+", "(", t)
    t = re.sub(r"\s+\)", ")", t)
    t = re.sub(r"\s+", " ", t).strip()
    words = t.split(" ")
    half = len(words) // 2
    if len(words) % 2 == 0 and half and words[:half] == words[half:]:
        t = " ".join(words[:half])
    return t


def commons_licence(info: dict) -> str | None:
    """The most permissive allow-listed licence the Commons file offers, or None."""
    offered = set()
    short = (info["meta"].get("LicenseShortName") or "").strip().lower()
    if short in COMMONS_LICENCE:
        offered.add(COMMONS_LICENCE[short])
    for cat in info["categories"]:
        c = cat.removeprefix("Category:").lower().replace("-", " ").replace("_", " ")
        c = re.sub(r"^cc (by(?: sa)?) (\d\.\d).*$", r"cc \1 \2", c).replace("cc by sa", "cc by-sa")
        if c.startswith("pd ") or c.startswith("public domain"):
            offered.add("Public domain")
        elif c in COMMONS_LICENCE:
            offered.add(COMMONS_LICENCE[c])
        elif c.startswith("fal") or "free art license" in c:
            offered.add("FAL 1.3")
        elif c.startswith("gfdl"):
            offered.add("GFDL 1.2")
    for name in PREFERENCE:
        if name in offered:
            return name
    return None


def candidates(z: int, page: dict | None, row: dict) -> list[dict]:
    """Every photo considered for the element, with its status and reason (for the report)."""
    out = []
    pins = row.get("pin", [])
    excluded = set(row.get("exclude", []))
    if page:
        for ph in page["photos"]:
            name = ph["file"]
            status = "selected" if name in pins else "rejected"
            reason = "pinned in images.toml" if name in pins else ""
            if name in excluded:
                reason = "excluded in images.toml (not the element, an illustration, or not freely licensed)"
            elif status == "rejected":
                reason = "not chosen: another photo of this element shows it better or differently"
            out.append({"file": name, "alt": ph["alt"], "status": status, "reason": reason, "source": "site"})
    for name in pins:
        if name.startswith("File:"):
            out.append(
                {
                    "file": name,
                    "alt": name[5:],
                    "status": "selected",
                    "reason": "pinned in images.toml",
                    "source": "commons",
                }
            )
    return out


def site_image(z: int, name: str, row: dict, page: dict, element_name: str) -> dict:
    src = raw_path(fetch_images.SOURCE, fetch_images.photo_file(z, name))
    credit = row.get("credit", {}).get(name)
    url = SITE + page["href"]
    if credit:
        licence = credit["licence"]
        author = credit["author"]
        attribution = (
            f"{author}, {licence}"
            + ("" if licence == "Public domain" else f" — {LICENCES[licence]}")
            + f"; via images-of-elements.com ({url})"
        )
        note = credit.get("note")
    else:
        licence, author = "CC BY 3.0", SITE_AUTHOR
        # The site asks for attribution by a link to the element page (SPEC §6.1, §15.4).
        attribution = f"Photo: Jürgen Kummer, images-of-elements.com — {url} — CC BY 3.0"
        note = None
    return {
        "src": src,
        "title": row.get("title", {}).get(name)
        or next((p["alt"] for p in page["photos"] if p["file"] == name), element_name),
        "author": author,
        "licence": licence,
        "sourceUrl": url,
        "source": "images_of_elements",
        "attribution": attribution,
        "note": note,
    }


def commons_image(name: str, row: dict, element_name: str) -> dict | None:
    info = fetch_images.commons_info(name)
    if info is None:
        return None
    licence = commons_licence(info)
    if licence is None:
        raise ValueError(f"{name}: no licence on the allow-list ({info['meta'].get('LicenseShortName')})")
    author = clean_author(_strip(info["meta"].get("Artist"))) or "Unknown author"
    page_url = info["descriptionUrl"] or f"https://commons.wikimedia.org/wiki/{name.replace(' ', '_')}"
    attribution = (
        f"{author}, {licence}" + ("" if licence == "Public domain" else f" — {LICENCES[licence]}") + f"; {page_url}"
    )
    return {
        "src": info["file"],
        "title": row.get("title", {}).get(name) or _strip(info["meta"].get("ImageDescription"))[:120] or element_name,
        "author": author,
        "licence": licence,
        "sourceUrl": page_url,
        "source": "commons",
        "attribution": attribution,
        "note": None,
    }


def convert(src: Path, dest_dir: Path, k: int) -> tuple[int, int]:
    """Resize (never crop or recolour) to 800 and 320 px on the long side; WebP quality 82."""
    from PIL import Image  # Pillow is needed only when photos are (re)built

    with Image.open(src) as im:
        im.load()
        if im.mode not in ("RGB", "RGBA"):
            im = im.convert("RGBA" if "transparency" in im.info or im.mode in ("LA", "P") else "RGB")
        size = None
        for px in SIZES:
            copy = im.copy()
            copy.thumbnail((px, px), Image.Resampling.LANCZOS)  # never enlarges
            out = dest_dir / f"{k}-{px}.webp"
            copy.save(out, "WEBP", quality=WEBP_QUALITY, method=6)
            if size is None:
                size = copy.size
    return size


HALF_LIFE_UNITS = {"Y": "years", "d": "days", "h": "hours", "m": "minutes", "s": "seconds", "ms": "milliseconds"}
_SUP = str.maketrans("0123456789-+", "⁰¹²³⁴⁵⁶⁷⁸⁹⁻⁺")


def readable_half_life(text: str) -> str:
    """IAEA's "4.21E+6 Y" as "4.21 × 10⁶ years" for the placeholder sentence (the note keeps the original)."""
    m = re.fullmatch(r"([\d.]+)(?:E([+-]?\d+))?\s*([A-Za-z]+)", text.strip())
    if not m or m.group(3) not in HALF_LIFE_UNITS:
        return text
    number = m.group(1)
    if m.group(2):
        number += " × 10" + str(int(m.group(2))).translate(_SUP)
    return f"{number} {HALF_LIFE_UNITS[m.group(3)]}"


def placeholder(z: int, kind: str, name: str, iso: list[dict] | None) -> dict:
    text = PLACEHOLDER_TEXT[kind].format(name=name)
    out: dict = {"kind": "placeholder", "reason": kind}
    best = None
    if iso:
        timed = [x for x in iso if x.get("halfLifeS")]
        best = max(timed, key=lambda x: x["halfLifeS"]) if timed else None
    if best:
        out["longestLived"] = {
            "A": best["A"],
            "halfLife": {
                "value": best["halfLifeS"],
                "unit": "s",
                "source": "iaea_livechart",
                "note": f"IAEA: t½ = {best['halfLifeText']}.",
            },
        }
        text += (
            f" Longest-lived isotope: {name.lower()}-{best['A']}, half-life {readable_half_life(best['halfLifeText'])}."
        )
    out["text"] = text
    return out


def build_images(names: dict[int, str], iaea: dict[int, list[dict]] | None, report) -> dict[int, list[dict]]:
    rows = load_rows()
    try:
        pages = fetch_images.parse()
    except Exception as exc:
        pages = {}
        report.unavailable("images_of_elements", str(exc))
    out: dict[int, list[dict]] = {}
    lines = [
        "<!-- SPDX-License-Identifier: CC-BY-NC-SA-4.0 -->",
        "<!-- GENERATED by tools/build_images.py — do not edit by hand. -->",
        "# Images report",
        "",
        "Every photograph considered for each element, and why it was accepted or rejected (SPEC §12).",
        "The choice is made by eye and recorded in `tools/curated/images.toml`; nothing here is automatic.",
        "Sources: images-of-elements.com (CC BY 3.0 unless the page credits someone else) and Wikimedia",
        "Commons (allow-listed licences only). Elements without a free photograph get an honest placeholder.",
        "",
    ]
    for z in range(1, NUM_ELEMENTS + 1):
        row = rows.get(z, {"Z": z})
        name = names[z]
        dest = IMG_DIR / str(z)
        page = pages.get(z)
        built: list[dict] = []
        credits: list[dict] = []
        problems: list[str] = []
        previous = {}
        old_credits = dest / "credits.json"
        if old_credits.exists():
            previous = {c["pin"]: c for c in json.loads(old_credits.read_text(encoding="utf-8"))["images"]}
        tmp = IMG_DIR / f".{z}.tmp"
        if tmp.exists():
            shutil.rmtree(tmp)
        tmp.mkdir(parents=True)
        k = 0
        uncached = 0
        for pin in row.get("pin", []):
            try:
                rec = (
                    commons_image(pin, row, name)
                    if pin.startswith("File:")
                    else (site_image(z, pin, row, page, name) if page else None)
                )
            except ValueError as exc:
                problems.append(str(exc))
                continue
            k += 1
            if rec is not None and rec["src"].exists():
                width, height = convert(rec["src"], tmp, k)
            elif pin in previous and (dest / f"{previous[pin]['k']}-800.webp").exists():
                # Source not cached here: keep the committed conversion and its credit.
                old = previous[pin]
                for px in SIZES:
                    shutil.copy(dest / f"{old['k']}-{px}.webp", tmp / f"{k}-{px}.webp")
                rec = {key: old[key] for key in ("title", "author", "licence", "sourceUrl", "source", "attribution")}
                rec["note"] = old.get("note")
                # A title or author correction applies without downloading the photo again.
                rec["title"] = row.get("title", {}).get(pin) or rec["title"]
                if rec["source"] == "commons":
                    cleaned = clean_author(rec["author"])
                    rec["attribution"] = rec["attribution"].replace(rec["author"], cleaned, 1)
                    rec["author"] = cleaned
                width, height = old["width"], old["height"]
            else:
                problems.append(f"{pin}: not cached and no earlier conversion — run tools/fetch_images.py")
                uncached += 1
                k -= 1
                continue
            kind = row.get("kind", {}).get(pin, "sample")
            ref = {
                "file": f"img/elements/{z}/{k}-800.webp",
                "thumb": f"img/elements/{z}/{k}-320.webp",
                "width": width,
                "height": height,
                "title": rec["title"],
                "author": rec["author"],
                "licence": rec["licence"],
                "licenceUrl": LICENCES[rec["licence"]],
                "sourceUrl": rec["sourceUrl"],
                "attribution": rec["attribution"],
                "source": rec["source"],
                "kind": kind,
            }
            built.append(ref)
            credits.append({**ref, "pin": pin, "k": k, **({"note": rec["note"]} if rec.get("note") else {})})
        if dest.exists():
            shutil.rmtree(dest)
        tmp.rename(dest)
        (dest / "credits.json").write_text(
            json.dumps({"Z": z, "images": credits}, ensure_ascii=False, indent=1) + "\n", encoding="utf-8"
        )
        refs: list[dict] = []
        kind = row.get("placeholder")
        if not kind and not built and uncached:
            kind = "source_unavailable_at_build"
            report.unavailable("commons", f"Z={z}: {uncached} chosen photograph(s) not downloaded")
        if kind or not built:
            refs.append(placeholder(z, kind or "no_free_photo", name, iaea.get(z) if iaea else None))
            if not kind:
                problems.append("no photograph could be built: placeholder shown")
        refs += built
        out[z] = refs[:3]
        # report
        lines.append(f"## {z} {name}")
        lines.append("")
        if page:
            lines.append(f"Element page: {SITE}{page['href']}")
            if page["notes"]:
                lines.append("")
                lines.append("Credits on the page (they override the site's CC BY 3.0): " + " / ".join(page["notes"]))
        lines.append("")
        cands = candidates(z, page, row)
        if cands:
            lines.append("| File | Caption on the source | Decision | Why |")
            lines.append("|---|---|---|---|")
            for c in cands:
                lines.append(f"| `{c['file']}` | {c['alt']} | {c['status']} | {c['reason']} |")
        else:
            lines.append("No candidate photographs.")
        lines.append("")
        shown = [
            f"{r['title']} — {r['licence']}" if r.get("kind") != "placeholder" else f"placeholder: {r['text']}"
            for r in refs[:3]
        ]
        lines.append("Shown: " + "; ".join(shown))
        for p in problems:
            lines.append(f"\n**Problem:** {p}")
            report.add("Images", f"Z={z}: {p}")
        lines.append("")
    text = "\n".join(lines) + "\n"
    (TOOLS_DIR / "images-report.md").write_text(text, encoding="utf-8")
    raw_path(fetch_images.SOURCE, "").mkdir(parents=True, exist_ok=True)
    (TOOLS_DIR / "raw" / "images-report.md").write_text(text, encoding="utf-8")
    return out
