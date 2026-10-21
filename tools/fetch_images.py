# SPDX-License-Identifier: CC-BY-NC-SA-4.0
"""Element photographs (SPEC §12): images-of-elements.com first, Wikimedia Commons second.

    python tools/fetch_images.py --dry-run   list the candidates per element, download nothing big
    python tools/fetch_images.py             fetch pages and candidate files into tools/raw/
    (python tools/pipeline.py --all runs the fetch; tools/build_images.py selects and converts)

images-of-elements.com (Heinrich Pniok) licenses its photographs CC BY 3.0 "unless otherwise
noted", with attribution by a link to the element's page. Each element page is parsed for its
photographs and the caption text around them. Commons files are only looked at where
tools/curated/images.toml names them (pins), because Commons rate-limits shared addresses
heavily; every request honours its Retry-After (common.http_get).
"""

from __future__ import annotations

import argparse
import html
import json
import re
import sys
import tomllib
import urllib.parse
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from common import CURATED_DIR, SourceUnavailable, http_get, raw_path

SOURCE = "images_of_elements"
COMMONS = "commons"
SITE = "https://images-of-elements.com/"
INDEX_PAGE = "hydrogen.php"  # every page carries the full periodic table of links
COMMONS_API = "https://commons.wikimedia.org/w/api.php"
CANDIDATES_PER_ELEMENT = 6
COMMONS_WIDTH = 1600


def load_pins() -> dict[int, dict]:
    path = CURATED_DIR / "images.toml"
    if not path.exists():
        return {}
    rows = tomllib.loads(path.read_text(encoding="utf-8")).get("element", [])
    return {r["Z"]: r for r in rows}


# --- images-of-elements.com ---------------------------------------------------------------


def element_pages() -> dict[int, str]:
    """{Z: 'iron.php'} from the periodic table on every page of the site (deuterium skipped)."""
    text = raw_path(SOURCE, "page_" + INDEX_PAGE).read_text(encoding="utf-8", errors="replace")
    out: dict[int, str] = {}
    for z, href in re.findall(r'<div class="number">&nbsp;(\d+)</div>\s*<a href="([^"]+\.php)"', text):
        if href != "deuterium.php":
            out.setdefault(int(z), href)
    return out


_IMG = re.compile(
    r'<a href="(?P<full>[^"]+\.(?:jpg|jpeg|png))"[^>]*>\s*<img src="(?P<small>[^"]+)"[^>]*?'
    r'(?:width="(?P<w>\d+)")?[^>]*?(?:height="(?P<h>\d+)")?[^>]*?alt="(?P<alt>[^"]*)"',
    re.IGNORECASE,
)


def _plain(fragment: str) -> str:
    text = html.unescape(re.sub(r"<[^>]+>", " ", fragment))
    return re.sub(r"\s+", " ", text).strip()


def parse_page(text: str) -> dict:
    """{title, intro, photos: [{file, alt, context}], notes: [...]} for one element page.

    `context` is the caption text that follows the photograph up to the next one (the site writes
    "Left: … Right: …" under each pair); `notes` collects any sentence that credits someone other
    than the site, which overrides its default licence ("unless otherwise noted")."""
    body = text[text.find("<h1>") :] if "<h1>" in text else text
    end = body.find("The images are licensed under")
    body = body[:end] if end > 0 else body
    title = _plain(body[: body.find("</h1>")]) if "</h1>" in body else ""
    matches = list(_IMG.finditer(body))
    photos = []
    for i, m in enumerate(matches):
        nxt = matches[i + 1].start() if i + 1 < len(matches) else len(body)
        # Text after this photo up to the next photo; for the left photo of a pair this is the
        # shared caption block, which names both.
        context = _plain(body[m.end() : nxt])
        if not context and i + 1 < len(matches):
            context = _plain(body[matches[i + 1].end() : matches[i + 2].start() if i + 2 < len(matches) else len(body)])
        photos.append({"file": m.group("full"), "alt": html.unescape(m.group("alt")), "context": context[:600]})
    intro = _plain(body[body.find("</h1>") + 5 : matches[0].start()]) if matches and "</h1>" in body else ""
    notes = [
        s.strip()
        for s in re.split(r"(?<=[.!?])\s", _plain(body))
        if re.search(r"(?i)\b(courtesy|wikimedia|wikipedia|photo(?:graph)? by|image by|©|copyright|public domain)\b", s)
    ]
    return {"title": title, "intro": intro[:600], "photos": photos, "notes": notes}


def page_file(href: str) -> str:
    return "page_" + href


def photo_file(z: int, name: str) -> str:
    return f"photo_{z:03d}_{re.sub(r'[^A-Za-z0-9._-]', '_', name)}"


def fetch_images_of_elements(refresh: bool, dry_run: bool, pins: dict[int, dict]) -> dict[int, dict]:
    http_get(SOURCE, SITE + INDEX_PAGE, page_file(INDEX_PAGE), refresh=refresh)
    pages = element_pages()
    out = {}
    for z, href in sorted(pages.items()):
        try:
            path = http_get(SOURCE, SITE + href, page_file(href), refresh=refresh)
        except SourceUnavailable as exc:
            print(f"!!! {exc}")
            continue
        page = parse_page(path.read_text(encoding="utf-8", errors="replace"))
        page["href"] = href
        out[z] = page
        if dry_run:
            continue
        wanted = [p["file"] for p in page["photos"][:CANDIDATES_PER_ELEMENT]]
        wanted += [f for f in pins.get(z, {}).get("pin", []) if not f.startswith("File:") and f not in wanted]
        for name in wanted:
            try:
                http_get(SOURCE, SITE + name, photo_file(z, name), refresh=refresh)
            except SourceUnavailable as exc:
                print(f"!!! {exc}")
    return out


# --- Wikimedia Commons ----------------------------------------------------------------------


def commons_info_file(title: str) -> str:
    return "info_" + re.sub(r"[^A-Za-z0-9._-]", "_", title.removeprefix("File:")) + ".json"


def commons_photo_file(title: str) -> str:
    return "file_" + re.sub(r"[^A-Za-z0-9._-]", "_", title.removeprefix("File:"))


def commons_info_url(title: str) -> str:
    query = {
        "action": "query",
        "format": "json",
        "formatversion": "2",
        "titles": title,
        "prop": "imageinfo|categories",
        "iiprop": "url|extmetadata|size|mime",
        "iiurlwidth": str(COMMONS_WIDTH),
        "cllimit": "max",
    }
    return COMMONS_API + "?" + urllib.parse.urlencode(query)


def fetch_commons(refresh: bool, dry_run: bool, pins: dict[int, dict]) -> None:
    titles = sorted({f for row in pins.values() for f in row.get("pin", []) if f.startswith("File:")})
    for title in titles:
        info_path = http_get(COMMONS, commons_info_url(title), commons_info_file(title), refresh=refresh)
        if dry_run:
            continue
        page = json.loads(info_path.read_text(encoding="utf-8"))["query"]["pages"][0]
        if "imageinfo" not in page:
            print(f"!!! commons: {title} does not exist")
            continue
        info = page["imageinfo"][0]
        url = info.get("thumburl") or info["url"]
        http_get(COMMONS, url, commons_photo_file(title), refresh=refresh)


def fetch(refresh: bool = False, dry_run: bool = False) -> None:
    pins = load_pins()
    pages = fetch_images_of_elements(refresh, dry_run, pins)
    if not pages:
        raise SourceUnavailable(f"{SOURCE}: no element page could be read")
    try:
        fetch_commons(refresh, dry_run, pins)
    except SourceUnavailable as exc:
        print(f"!!! {exc}")
    if dry_run:
        for z, page in sorted(pages.items()):
            print(f"Z={z:3d} {page['href']}: " + "; ".join(f"{p['file']} ({p['alt']})" for p in page["photos"]))


def parse() -> dict[int, dict]:
    """{Z: parsed element page} from the cache."""
    if not raw_path(SOURCE, page_file(INDEX_PAGE)).exists():
        raise SourceUnavailable(f"{SOURCE}: nothing cached in tools/raw/{SOURCE}")
    out = {}
    for z, href in element_pages().items():
        path = raw_path(SOURCE, page_file(href))
        if path.exists():
            page = parse_page(path.read_text(encoding="utf-8", errors="replace"))
            page["href"] = href
            out[z] = page
    return out


def commons_info(title: str) -> dict | None:
    path = raw_path(COMMONS, commons_info_file(title))
    if not path.exists():
        return None
    page = json.loads(path.read_text(encoding="utf-8"))["query"]["pages"][0]
    if "imageinfo" not in page:
        return None
    info = page["imageinfo"][0]
    meta = {k: v.get("value") for k, v in info.get("extmetadata", {}).items()}
    return {
        "title": page["title"],
        "url": info["url"],
        "descriptionUrl": info.get("descriptionurl", ""),
        "width": info.get("width"),
        "height": info.get("height"),
        "mime": info.get("mime"),
        "meta": meta,
        "categories": [c["title"] for c in page.get("categories", [])],
        "file": raw_path(COMMONS, commons_photo_file(page["title"])),
    }


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dry-run", action="store_true", help="list candidates only")
    ap.add_argument("--refresh", action="store_true")
    args = ap.parse_args(argv)
    fetch(refresh=args.refresh, dry_run=args.dry_run)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
