#!/usr/bin/env python3
"""
WordPress REST API Migration Script for quinacare.org

Fetches posts, pages, and media from the live WordPress site via its
REST API + Polylang language endpoints, downloads media preserving the
wp-content/uploads/ directory structure, and outputs Markdoc files into
src/content/news/{nl,en,es}/.

Incremental by default: stores last run timestamp in .last_migration and
only fetches items modified after that date. Existing local files are
never overwritten.

Usage:
    uv run migrate.py                       # Incremental sync
    uv run migrate.py --full                # Full migration, ignore last-run timestamp
    uv run migrate.py --force               # Force overwrite existing posts/pages
    uv run migrate.py --skip-media          # Skip all media downloads
    uv run migrate.py --force --skip-media  # Re-import all content, no media downloads
    uv run migrate.py --clear               # Wipe local news + media, then migrate
    uv run migrate.py --dry-run             # Preview without writing
    uv run migrate.py --help                # Show all flags
"""

import argparse
import os
import re
import shutil
import sys
import time
from datetime import datetime, timezone
from html import unescape
from pathlib import Path
from typing import Optional
from urllib.parse import unquote, urlparse

import requests
from dotenv import load_dotenv

try:
    from markdownify import MarkdownConverter
except ImportError:
    print("Error: markdownify not installed. Run: uv add markdownify")
    sys.exit(1)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent
OUTPUT_BASE = PROJECT_ROOT / "src" / "content" / "news"
MEDIA_DIR = PROJECT_ROOT / "src" / "assets" / "media"

WP_BASE = "https://www.quinacare.org"
API_BASE = f"{WP_BASE}/wp-json/wp/v2"
PLL_API = f"{WP_BASE}/wp-json/pll/v1"
LANGUAGES = ("nl", "en", "es")
DEFAULT_LANGUAGE = "nl"

# Relative prefix from src/content/news/{lang}/ to src/assets/media/
FRONTMATTER_IMAGE_PREFIX = "../../../assets/media/"
BODY_IMAGE_PREFIX = "/media/"

# Rate limiting
REQUEST_DELAY = 0.15  # seconds between API requests
PER_PAGE = 50  # max items per API page (WP max is 100)

# Incremental sync state file
LAST_RUN_FILE = SCRIPT_DIR / ".last_migration"

# Size suffix pattern: image-300x200.jpg -> image.jpg
SIZE_SUFFIX_RE = re.compile(r"-\d+x\d+(\.\w+)$")

# Runtime state — load .env and configure auth
load_dotenv(Path(__file__).parent / ".env")
session = requests.Session()
session.headers.update({"User-Agent": "QuinaCare-Migration/1.0"})

_wp_user = os.environ.get("WP_USERNAME", "")
_wp_pass = os.environ.get("WP_PASSWORD", "")
_authenticated = False
downloaded_images: dict[str, str] = {}


def wp_login():
    """Authenticate via wp-login.php cookie auth + nonce."""
    global _authenticated
    if not _wp_user or not _wp_pass:
        return

    print(f"Logging in as {_wp_user}...")
    resp = session.post(
        f"{WP_BASE}/wp-login.php",
        data={
            "log": _wp_user,
            "pwd": _wp_pass,
            "wp-submit": "Log In",
            "redirect_to": f"{WP_BASE}/wp-admin/",
            "testcookie": "1",
        },
        allow_redirects=True,
        timeout=30,
    )

    # Check if login succeeded (cookies should contain wordpress_logged_in_*)
    logged_in = any("wordpress_logged_in" in name for name in session.cookies.keys())
    if not logged_in:
        print("  Login FAILED — falling back to public content only")
        return

    # Fetch the REST API nonce from wp-admin
    nonce_resp = session.get(f"{WP_BASE}/wp-admin/admin-ajax.php?action=rest-nonce", timeout=30)
    if nonce_resp.status_code == 200 and len(nonce_resp.text) < 50:
        session.headers.update({"X-WP-Nonce": nonce_resp.text.strip()})
        _authenticated = True
        print("  Login OK (cookie + nonce)")
    else:
        _authenticated = True
        print("  Login OK (cookie only)")
author_map: dict[int, str] = {}
category_map: dict[int, str] = {}
tag_map: dict[int, str] = {}
media_map: dict[int, dict] = {}  # {media_id: media API object}
used_slugs: dict[str, set[str]] = {lang: set() for lang in LANGUAGES}
last_run_iso: Optional[str] = None  # set from LAST_RUN_FILE or --full
skip_media: bool = False  # set from --skip-media
force_overwrite: bool = False  # set from --full or --skip-media


def load_last_run() -> Optional[str]:
    """Load the last successful run timestamp as an ISO 8601 string.

    Returns None if no previous run or file is missing.
    """
    if not LAST_RUN_FILE.exists():
        return None
    text = LAST_RUN_FILE.read_text().strip()
    if not text:
        return None
    return text


def save_last_run():
    """Save the current UTC timestamp as the last successful run."""
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S")
    LAST_RUN_FILE.write_text(ts + "\n")
    print(f"  Saved last-run timestamp: {ts}")


# ---------------------------------------------------------------------------
# API helpers
# ---------------------------------------------------------------------------
def api_get(url: str, params: dict | None = None) -> requests.Response:
    """GET with rate limiting and retry."""
    time.sleep(REQUEST_DELAY)
    for attempt in range(3):
        try:
            resp = session.get(url, params=params, timeout=30)
            resp.raise_for_status()
            return resp
        except requests.exceptions.RequestException as e:
            if attempt == 2:
                raise
            print(f"  [RETRY] {e}")
            time.sleep(2 ** attempt)
    raise RuntimeError("unreachable")


def fetch_all_pages(endpoint: str, params: dict | None = None) -> list[dict]:
    """Fetch all pages of a paginated WP REST API endpoint."""
    params = dict(params or {})
    params.setdefault("per_page", PER_PAGE)
    params["page"] = 1
    all_items: list[dict] = []

    while True:
        resp = api_get(endpoint, params)
        items = resp.json()
        if not isinstance(items, list):
            break
        all_items.extend(items)

        total_pages = int(resp.headers.get("X-WP-TotalPages", 1))
        if params["page"] >= total_pages:
            break
        params["page"] += 1

    return all_items


# ---------------------------------------------------------------------------
# Taxonomy & author lookups
# ---------------------------------------------------------------------------
def fetch_authors():
    """Fetch all WP users for author name resolution."""
    global author_map
    print("Fetching authors...")
    users = fetch_all_pages(f"{API_BASE}/users")
    author_map = {u["id"]: u["name"] for u in users}
    print(f"  {len(author_map)} authors")


def fetch_categories():
    """Fetch all WP categories."""
    global category_map
    print("Fetching categories...")
    cats = fetch_all_pages(f"{API_BASE}/categories", {"per_page": 100})
    category_map = {c["id"]: unescape(c["name"]) for c in cats}
    print(f"  {len(category_map)} categories")


def fetch_tags():
    """Fetch all WP tags."""
    global tag_map
    print("Fetching tags...")
    tags = fetch_all_pages(f"{API_BASE}/tags", {"per_page": 100})
    tag_map = {t["id"]: unescape(t["name"]) for t in tags}
    print(f"  {len(tag_map)} tags")


# ---------------------------------------------------------------------------
# Media pipeline
# ---------------------------------------------------------------------------
def fetch_all_media():
    """Fetch media items from WP REST API. Uses modified_after for incremental.

    When skip_media is set, always fetch all media (need full ID→URL map
    for resolving vc_single_image attachment IDs in content).
    """
    global media_map
    params: dict = {}
    if last_run_iso and not skip_media:
        params["modified_after"] = last_run_iso
        print(f"Fetching media index (modified since {last_run_iso})...")
    else:
        print("Fetching media index (all)...")
    items = fetch_all_pages(f"{API_BASE}/media", params)
    media_map = {m["id"]: m for m in items}
    print(f"  {len(media_map)} media items indexed")


def strip_size_suffix(url: str) -> str:
    """Convert image-300x200.jpg -> image.jpg to request the original."""
    return SIZE_SUFFIX_RE.sub(r"\1", url)


def get_best_media_url(media_obj: dict) -> str:
    """Get the best (largest) URL from a media object."""
    details = media_obj.get("media_details", {})
    sizes = details.get("sizes", {})

    # Prefer: full > original > 2048x2048 > largest available
    for size_key in ("full", "original", "2048x2048"):
        if size_key in sizes:
            return sizes[size_key].get("source_url", "")

    # Fall back to the main source_url (usually full size)
    return media_obj.get("source_url", "")


def download_image(url: str) -> Optional[str]:
    """Download an image, return its body path (/media/YYYY/MM/file.ext).

    Returns None on failure. Skips already-downloaded or existing files.
    """
    if not url:
        return None

    # Skip non-media file types
    ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".svg", ".webp", ".mp4", ".mp3", ".pdf"}
    ext = os.path.splitext(urlparse(url).path)[1].lower()
    if ext and ext not in ALLOWED_EXTENSIONS:
        return None

    if url.startswith("//"):
        url = "https:" + url
    elif url.startswith("/"):
        url = WP_BASE + url

    original_url = strip_size_suffix(url)

    for u in (original_url, url):
        if u in downloaded_images:
            return downloaded_images[u]

    parsed = urlparse(original_url)
    url_path = unquote(parsed.path)

    if "wp-content/uploads/" in url_path:
        rel_path = url_path.split("wp-content/uploads/")[-1]
    else:
        filename = os.path.basename(url_path) or "image"
        rel_path = f"other/{filename}"

    local_file = MEDIA_DIR / rel_path
    body_path = f"{BODY_IMAGE_PREFIX}{rel_path}"

    if local_file.exists():
        downloaded_images[original_url] = body_path
        downloaded_images[url] = body_path
        return body_path

    # With --skip-media, only resolve existing files, never download new ones
    if skip_media:
        return None

    for try_url in (original_url, url):
        try:
            resp = session.get(try_url, timeout=30, allow_redirects=True)
            resp.raise_for_status()
            content_type = resp.headers.get("content-type", "")
            if "text/html" in content_type:
                continue
            local_file.parent.mkdir(parents=True, exist_ok=True)
            with open(local_file, "wb") as f:
                f.write(resp.content)
            downloaded_images[original_url] = body_path
            downloaded_images[url] = body_path
            print(f"    [DL] {rel_path}")
            return body_path
        except Exception:
            continue

    print(f"    [SKIP] Failed: {original_url}")
    return None


def download_all_media():
    """Download all indexed media items. Skips files that already exist locally."""
    print(f"Downloading media ({len(media_map)} items, skipping existing)...")
    skipped = 0
    downloaded = 0
    for i, (mid, media_obj) in enumerate(media_map.items(), 1):
        url = get_best_media_url(media_obj)
        if not url:
            continue
        # Check if already on disk before downloading
        original_url = strip_size_suffix(url)
        url_path = unquote(urlparse(original_url).path)
        if "wp-content/uploads/" in url_path:
            rel_path = url_path.split("wp-content/uploads/")[-1]
        else:
            rel_path = f"other/{os.path.basename(url_path) or 'image'}"
        if (MEDIA_DIR / rel_path).exists():
            body_path = f"{BODY_IMAGE_PREFIX}{rel_path}"
            downloaded_images[original_url] = body_path
            downloaded_images[url] = body_path
            skipped += 1
            continue
        if (i - skipped) % 50 == 0:
            print(f"  Progress: {i}/{len(media_map)}")
        result = download_image(url)
        if result:
            downloaded += 1
    print(f"  Done: {downloaded} downloaded, {skipped} already existed")


def body_path_to_frontmatter_path(body_path: str) -> str:
    """Convert /media/... -> ../../../assets/media/..."""
    rel = body_path.removeprefix(BODY_IMAGE_PREFIX)
    return f"{FRONTMATTER_IMAGE_PREFIX}{rel}"


def resolve_featured_image(featured_media_id: int) -> tuple[Optional[str], dict[str, str]]:
    """Resolve a WP featured_media ID to a local frontmatter path + meta."""
    if not featured_media_id:
        return None, {}

    media_obj = resolve_media_by_id(featured_media_id)
    if not media_obj:
        return None, {}

    url = get_best_media_url(media_obj)
    body_path = download_image(url)
    if not body_path:
        return None, {}

    fm_path = body_path_to_frontmatter_path(body_path)

    meta: dict[str, str] = {}
    caption = unescape(re.sub(r"<[^>]+>", "", media_obj.get("caption", {}).get("rendered", ""))).strip()
    alt = media_obj.get("alt_text", "").strip()
    if caption:
        meta["caption"] = caption
    elif alt:
        meta["caption"] = alt

    return fm_path, meta


# ---------------------------------------------------------------------------
# Content processing
# ---------------------------------------------------------------------------
class ImageConverter(MarkdownConverter):
    """Custom markdownify converter that outputs {% image %} Markdoc tags."""

    def convert_img(self, el, text=None, *args, **kwargs):
        src = el.get("src", "")
        alt = el.get("alt", "")

        classes = el.get("class", "") or ""
        if isinstance(classes, list):
            classes = " ".join(classes)
        align = "center"
        if "alignleft" in classes:
            align = "left"
        elif "alignright" in classes:
            align = "right"

        local_path = download_image(src)
        if not local_path:
            return ""

        parts = [f'src="{local_path}"']
        if alt:
            parts.append(f'caption="{escape_markdoc_string(alt)}"')
        parts.append(f'align="{align}"')

        return f'{{% image {" ".join(parts)} /%}}\n\n'


def escape_markdoc_string(s: str) -> str:
    return s.replace('"', '\\"').replace("\n", " ").strip()


def escape_yaml_string(s: str) -> str:
    if not s:
        return '""'
    if any(c in s for c in ['"', "'", ":", "#", "\n", "[", "]", "{", "}"]):
        return '"' + s.replace("\\", "\\\\").replace('"', '\\"').replace("\n", " ") + '"'
    return f'"{s}"'


def normalize_quotes(content: str) -> str:
    """Replace curly/smart quotes with straight quotes for shortcode parsing."""
    content = content.replace("\u201c", '"').replace("\u201d", '"')  # left/right double quotes
    content = content.replace("\u2033", '"')  # double prime
    content = content.replace("\u2018", "'").replace("\u2019", "'")  # left/right single quotes
    content = content.replace("\u2032", "'")  # prime
    return content


def strip_shortcodes(content: str) -> str:
    """Strip WordPress shortcodes, preserving useful inner content."""
    if not content:
        return ""

    # Normalize smart/curly quotes so shortcode attribute regexes match
    content = normalize_quotes(content)

    # Remove duplicate VC responsive columns (mobile-hidden versions)
    content = re.sub(
        r'\[vc_row\]\[vc_column\s+offset="vc_hidden-lg[^"]*"\].*?\[/vc_column\]\[/vc_row\]',
        "", content, flags=re.DOTALL,
    )

    # Convert image-bearing VC shortcodes
    content = process_vc_single_image(content)
    content = process_vc_images_carousel(content)

    # Convert special shortcodes
    content = process_embedyt(content)
    content = process_info_box(content)

    # Extract text from vc_column_text
    content = re.sub(r"\[vc_column_text[^\]]*\]", "\n\n", content)
    content = re.sub(r"\[/vc_column_text\]", "\n\n", content)

    # Paired shortcodes: strip open + close tags
    for prefix in ["vc_", "et_", "bears_", "tbdonations", "contact-form", "embed"]:
        content = re.sub(rf"\[{prefix}[^\]]*\]", "", content)
        content = re.sub(rf"\[/{prefix}[^\]]*\]", "", content)

    # Self-closing / standalone shortcodes
    for tag in [
        "gallery", "wpforms", "instagram-feed", "profilepress", "wpcode",
        "email-subscribers", "blog_special", "story_special", "demo_item",
        "donation_box", "do_widget", "paytium", "blog",
    ]:
        content = re.sub(rf"\[{tag}[^\]]*\]", "", content, flags=re.I)

    # Generic self-closing shortcodes [something /]
    content = re.sub(r"\[[a-z_]+[^\]]*\/\]", "", content, flags=re.I)

    return content


def process_embedyt(content: str) -> str:
    def _replace(m):
        url = m.group(1).strip()
        vid = None
        if "youtu.be/" in url:
            vid = url.split("youtu.be/")[-1].split("?")[0].split("&")[0]
        elif "youtube.com/watch" in url:
            vm = re.search(r"[?&]v=([^&]+)", url)
            if vm:
                vid = vm.group(1)
        if vid:
            return f"\n\n[Watch on YouTube](https://www.youtube.com/watch?v={vid})\n\n"
        return ""
    return re.sub(r"\[embedyt\]\s*(https?://[^\s\[]+)\s*\[/embedyt\]", _replace, content, flags=re.I)


def process_info_box(content: str) -> str:
    def _replace(m):
        title = m.group(1).strip()
        inner = m.group(2).strip()
        if inner.startswith("["):
            return ""
        if title and inner:
            return f"**{title}:** {inner}\n\n"
        if inner:
            return f"{inner}\n\n"
        return ""
    return re.sub(
        r'\[info_box[^\]]*title="([^"]*)"[^\]]*\](.*?)\[/info_box\]',
        _replace, content, flags=re.DOTALL | re.I,
    )


def process_gallery(content: str) -> str:
    """Convert [gallery ids="..."] -> multiple {% image %} tags via media_map."""
    def _replace(m):
        ids = [i.strip() for i in m.group(1).split(",") if i.strip()]
        images = []
        for aid in ids:
            media_obj = resolve_media_by_id(int(aid))
            if media_obj:
                url = get_best_media_url(media_obj)
                path = download_image(url)
                if path:
                    images.append(f'{{% image src="{path}" align="center" /%}}')
        return "\n\n".join(images) if images else ""
    return re.sub(r"\[gallery[^\]]*ids=[\"']([^\"']+)[\"'][^\]]*\]", _replace, content, flags=re.I)


def process_caption(content: str) -> str:
    def _replace(m):
        inner = m.group(1)
        img_m = re.search(r"<img[^>]+>", inner, re.I)
        if not img_m:
            return ""
        img_tag = img_m.group(0)
        caption_text = re.sub(r"<[^>]+>", "", inner[img_m.end():]).strip()
        src_m = re.search(r'src=["\']([^"\']+)["\']', img_tag)
        if not src_m:
            return ""
        local_path = download_image(src_m.group(1))
        if not local_path:
            return ""
        parts = [f'src="{local_path}"']
        if caption_text:
            parts.append(f'caption="{escape_markdoc_string(caption_text)}"')
        parts.append('align="center"')
        return f'{{% image {" ".join(parts)} /%}}'
    return re.sub(r"\[caption[^\]]*\](.*?)\[/caption\]", _replace, content, flags=re.DOTALL | re.I)


def resolve_media_by_id(mid: int) -> Optional[dict]:
    """Look up a media object by ID, fetching from API if not in cache."""
    media_obj = media_map.get(mid)
    if media_obj:
        return media_obj
    try:
        resp = api_get(f"{API_BASE}/media/{mid}")
        media_obj = resp.json()
        media_map[mid] = media_obj
        return media_obj
    except Exception:
        return None


def process_vc_single_image(content: str) -> str:
    def _replace(m):
        attrs = m.group(1)
        img_id = re.search(r'image="(\d+)"', attrs)
        if not img_id:
            return ""
        mid = int(img_id.group(1))
        media_obj = resolve_media_by_id(mid)
        if not media_obj:
            return ""
        url = get_best_media_url(media_obj)
        path = download_image(url)
        if not path:
            return ""
        return f'\n\n{{% image src="{path}" align="center" /%}}\n\n'
    return re.sub(r"\[vc_single_image([^\]]*)\]", _replace, content, flags=re.I)


def process_vc_images_carousel(content: str) -> str:
    def _replace(m):
        attrs = m.group(1)
        ids_match = re.search(r'images="([^"]+)"', attrs)
        if not ids_match:
            return ""
        ids = [i.strip() for i in ids_match.group(1).split(",") if i.strip()]
        images = []
        for aid in ids:
            media_obj = resolve_media_by_id(int(aid))
            if media_obj:
                url = get_best_media_url(media_obj)
                path = download_image(url)
                if path:
                    images.append(f'{{% image src="{path}" align="center" /%}}')
        return "\n\n".join(images) if images else ""
    return re.sub(r"\[vc_images_carousel([^\]]*)\]", _replace, content, flags=re.I)


def preprocess_html(html: str) -> str:
    """Clean HTML before markdown conversion."""
    if not html:
        return ""

    # WP REST API returns rendered HTML — decode HTML entities in shortcodes
    html = unescape(html)

    # Remove styled spans but keep content
    html = re.sub(r'<span[^>]*style="[^"]*"[^>]*>(.*?)</span>', r"\1", html, flags=re.DOTALL)
    html = re.sub(r"<span[^>]*>\s*</span>", "", html)
    html = re.sub(r"<span[^>]*>", "", html)
    html = re.sub(r"</span>", "", html)

    # Remove WP block wrappers
    html = re.sub(r'<div class="wpb-content-wrapper">', "", html)

    # Remove paytium / donation forms entirely
    html = re.sub(r"<form[^>]*class=\"pt-checkout-form\"[^>]*>.*?</form>", "", html, flags=re.DOTALL)
    html = re.sub(r"<noscript>.*?</noscript>", "", html, flags=re.DOTALL)

    # Remove hidden inputs
    html = re.sub(r'<input[^>]*type="hidden"[^>]*/?\s*>', "", html)

    # Ensure block-level spacing
    for tag in ("p", "div"):
        html = re.sub(rf"(<{tag}[^>]*>)", rf"\n\n\1", html)
        html = re.sub(rf"(</{tag}>)", rf"\1\n\n", html)
    for i in range(1, 7):
        html = re.sub(rf"(<h{i}[^>]*>)", rf"\n\n\1", html)
        html = re.sub(rf"(</h{i}>)", rf"\1\n\n", html)

    return html


def clean_markdown(md: str) -> str:
    """Post-process markdown output."""
    if not md:
        return ""

    # Remove bearsthemes links
    md = re.sub(r"\[[^\]]*\]\([^)]*bearsthemes\.com[^)]*\)", "", md)
    md = re.sub(r"https?://[^\s)]*bearsthemes\.com[^\s)]*", "", md)

    # Remove old hosting IP links
    md = re.sub(r"\[[^\]]*\]\([^)]*50\.87\.248\.77[^)]*\)", "", md)
    md = re.sub(r"https?://50\.87\.248\.77[^\s)]*", "", md)

    # Remove empty links
    md = re.sub(r"\[[^\]]+\]\(\s*\)", "", md)
    md = re.sub(r"\[\s*\]\([^)]*\)", "", md)

    # Remove bold date artifacts from theme
    md = re.sub(r"\*\*\d{2}\*\*", "", md)

    # Remove escaped-underscore shortcode remnants
    md = re.sub(r"\[[a-z]+\\_[^\]]*\]", "", md, flags=re.I)
    md = re.sub(r"\[/[a-z]+\\_[^\]]*\]", "", md, flags=re.I)

    # Fix escaped bold
    md = re.sub(r"\\\*\\\*([^*]+)\\\*\\\*", r"**\1**", md)

    # Paragraph separation
    md = re.sub(r"([a-z.,!?])\*\*([A-Z])", r"\1\n\n**\2", md)
    md = re.sub(r"\.(\n)([A-Z])", r".\n\n\2", md)

    return md


def html_to_markdown(html: str) -> str:
    """Full HTML-to-Markdown pipeline."""
    if not html:
        return ""

    content = strip_shortcodes(html)
    content = process_caption(content)
    content = process_gallery(content)

    # Protect {% image %} tags from markdownify
    placeholders: dict[str, str] = {}
    def _protect(m):
        key = f"XMARKDOCIMGX{len(placeholders)}X"
        placeholders[key] = m.group(0)
        return key
    content = re.sub(r"\{%\s*image\s[^%]+%\}", _protect, content)

    content = preprocess_html(content)

    converter = ImageConverter(
        heading_style="atx",
        bullets="-",
        strong_em_symbol="*",
        strip=["script", "style", "meta", "link", "button", "form", "input", "label", "noscript"],
    )
    markdown = converter.convert(content)

    for key, original in placeholders.items():
        markdown = markdown.replace(key, original)

    markdown = clean_markdown(markdown)
    markdown = re.sub(r"\n{3,}", "\n\n", markdown)
    return markdown.strip()


def extract_featured_from_markdown(markdown: str) -> tuple[Optional[str], str]:
    """Extract the first {% image %} tag as featured image, remove it from body."""
    img_match = re.search(r"\{%\s*image\s[^%]+%\}", markdown)
    if not img_match:
        return None, markdown

    tag = img_match.group(0)
    src_match = re.search(r'src="([^"]+)"', tag)
    if not src_match:
        return None, markdown

    body_path = src_match.group(1)
    fm_path = body_path_to_frontmatter_path(body_path)

    markdown = markdown[:img_match.start()] + markdown[img_match.end():]
    markdown = re.sub(r"\n{3,}", "\n\n", markdown).strip()

    return fm_path, markdown


def extract_and_remove_first_image(html: str) -> tuple[Optional[str], str]:
    """Extract the first image from HTML as featured image and remove it from content.

    Checks (in order):
    1. vc_single_image image="ID" shortcodes
    2. <img src="..."> tags
    3. background-image: url(...) in inline styles

    Returns (frontmatter_path, modified_html). The matched element is removed
    from the HTML so it won't appear in the body text.
    """
    if not html:
        return None, html

    # 1. vc_single_image shortcode (most common in quinacare.org pages)
    vc_match = re.search(r'\[vc_single_image[^\]]*image="(\d+)"[^\]]*\]', html)
    if vc_match:
        mid = int(vc_match.group(1))
        media_obj = resolve_media_by_id(mid)
        if media_obj:
            url = get_best_media_url(media_obj)
            body_path = download_image(url)
            if body_path:
                # Remove the first vc_single_image shortcode from HTML
                html = html[:vc_match.start()] + html[vc_match.end():]
                return body_path_to_frontmatter_path(body_path), html

    # 2. <img> tags
    img_match = re.search(r'<img[^>]+src=["\']([^"\']+)["\'][^>]*/?\s*>', html)
    if img_match:
        url = img_match.group(1)
        if not re.search(r'(150x150|placeholder|icon|logo|mollie\.com|gravatar)', url, re.I):
            body_path = download_image(url)
            if body_path:
                html = html[:img_match.start()] + html[img_match.end():]
                return body_path_to_frontmatter_path(body_path), html

    # 3. background-image: url(...)
    bg_match = re.search(r'background-image:\s*url\(([^)]+)\)', html)
    if bg_match:
        url = bg_match.group(1).strip("'\"")
        body_path = download_image(url)
        if body_path:
            # Remove the style block containing the background-image
            block_match = re.search(
                r'\{[^}]*background-image:\s*url\([^)]*?' + re.escape(os.path.basename(url)) + r'[^)]*\)[^}]*\}',
                html,
            )
            if block_match:
                html = html[:block_match.start()] + html[block_match.end():]
            return body_path_to_frontmatter_path(body_path), html

    return None, html


# ---------------------------------------------------------------------------
# Post migration
# ---------------------------------------------------------------------------
def detect_language_from_link(link: str) -> Optional[str]:
    """Detect actual language from WP page link URL.

    NL (default) has no prefix: quinacare.org/slug/
    EN: quinacare.org/en/slug/
    ES: quinacare.org/es/slug/
    """
    if not link:
        return None
    parsed = urlparse(link)
    parts = parsed.path.strip("/").split("/")
    if parts and parts[0] in ("en", "es"):
        return parts[0]
    return "nl"


def sanitize_slug(text: str) -> str:
    if not text:
        return "untitled"
    slug = re.sub(r"[^\w\-]", "-", text)
    slug = re.sub(r"-+", "-", slug)
    return slug.strip("-").lower() or "untitled"


def get_unique_slug(slug: str, lang: str) -> str:
    base = slug
    counter = 1
    while slug in used_slugs[lang]:
        slug = f"{base}-{counter}"
        counter += 1
    used_slugs[lang].add(slug)
    return slug


def file_needs_update(filepath: Path, featured_media_id: int, html_content: str = "") -> bool:
    """Check if an existing .mdoc file is missing data that we can now provide."""
    if not filepath.exists():
        return True
    content = filepath.read_text(encoding="utf-8")
    if "featured_image:" in content:
        return False
    # Re-generate if WP has featured_media or if the HTML content contains images
    if featured_media_id:
        return True
    html_content = normalize_quotes(html_content) if html_content else ""
    if html_content and (
        re.search(r'<img[^>]+src=', html_content)
        or re.search(r'background-image:\s*url\(', html_content)
        or re.search(r'vc_single_image[^]]*image="\d+"', html_content)
    ):
        return True
    return False


def migrate_item(item: dict, lang: str, item_type: str) -> Optional[Path]:
    """Migrate a single post or page to Markdoc. Skips if file already exists and is complete."""
    title = unescape(re.sub(r"<[^>]+>", "", item.get("title", {}).get("rendered", "Untitled")))
    raw_slug = item.get("slug", "") or sanitize_slug(title)
    raw_slug = sanitize_slug(raw_slug)

    # Strip language prefix from slug (e.g. "en-martha-arimuya-tanguila" -> "martha-arimuya-tanguila")
    if lang != DEFAULT_LANGUAGE and raw_slug.startswith(f"{lang}-"):
        raw_slug = raw_slug[len(lang) + 1:]

    # Check if output file already exists and is complete
    output_dir = OUTPUT_BASE / lang
    candidate = output_dir / f"{raw_slug}.mdoc"
    featured_media_id = item.get("featured_media", 0)
    html_content_raw = item.get("content", {}).get("rendered", "")
    if candidate.exists() and not force_overwrite and not file_needs_update(candidate, featured_media_id, html_content_raw):
        used_slugs[lang].add(raw_slug)
        print(f"  [{lang}] SKIP (exists): {title}")
        return None
    if candidate.exists() and force_overwrite:
        print(f"  [{lang}] OVERWRITE: {title}")
    elif candidate.exists():
        print(f"  [{lang}] UPDATE (missing featured_image): {title}")

    date_str_raw = item.get("date", "")
    try:
        dt = datetime.fromisoformat(date_str_raw)
        date_str = dt.strftime("%Y-%m-%d")
    except (ValueError, TypeError):
        date_str = datetime.now().strftime("%Y-%m-%d")

    status = item.get("status", "publish")
    author_id = item.get("author", 0)
    author_name = author_map.get(author_id, "")

    # Categories
    cat_ids = item.get("categories", [])
    categories = [category_map[cid] for cid in cat_ids if cid in category_map]
    # Filter out generic categories
    categories = [c for c in categories if c.lower() not in ("uncategorized",)]

    print(f"\n  [{lang}] {item_type}: {title}")

    # Content — REST API provides rendered HTML
    # unescape HTML entities first (&#8221; -> Unicode), then normalize smart quotes to straight
    html_content = normalize_quotes(unescape(item.get("content", {}).get("rendered", "")))

    # Featured image — from WP featured_media ID
    featured_media_id = item.get("featured_media", 0)
    featured_path, featured_meta = resolve_featured_image(featured_media_id)

    # If no featured_media, extract first image from raw HTML and remove it
    if not featured_path and html_content:
        featured_path, html_content = extract_and_remove_first_image(html_content)
        featured_meta = {}

    # Convert HTML to markdown
    markdown_content = html_to_markdown(html_content)

    # Final fallback: extract first {% image %} tag from converted markdown
    if not featured_path:
        featured_path, markdown_content = extract_featured_from_markdown(markdown_content)
        featured_meta = {}

    slug = get_unique_slug(raw_slug, lang)

    # Excerpt
    excerpt_html = item.get("excerpt", {}).get("rendered", "")
    excerpt = unescape(re.sub(r"<[^>]+>", "", excerpt_html)).strip()
    excerpt = re.sub(r"\[.*?\]", "", excerpt).strip()  # strip remaining shortcodes
    if len(excerpt) > 200:
        excerpt = excerpt[:200].rsplit(" ", 1)[0] + "..."

    # Build frontmatter
    lines = ["---"]
    lines.append(f"title: {escape_yaml_string(title)}")
    lines.append(f"date: {date_str}")
    lines.append(f"status: {status}")
    lines.append(f"slug: {escape_yaml_string(slug)}")
    if author_name:
        lines.append(f"author: {escape_yaml_string(author_name)}")
    if excerpt:
        lines.append(f"excerpt: {escape_yaml_string(excerpt)}")
    if categories:
        cat_list = ", ".join(f'"{c}"' for c in categories)
        lines.append(f"categories: [{cat_list}]")
    lines.append(f'language: "{lang}"')
    if featured_path:
        lines.append(f"featured_image: {escape_yaml_string(featured_path)}")
    if featured_meta.get("caption"):
        lines.append(f"featured_image_caption: {escape_yaml_string(featured_meta['caption'])}")
    if featured_meta.get("copyright"):
        lines.append(f"featured_image_copyright: {escape_yaml_string(featured_meta['copyright'])}")
    lines.append("---")

    frontmatter = "\n".join(lines)

    # Write file
    output_dir = OUTPUT_BASE / lang
    output_dir.mkdir(parents=True, exist_ok=True)
    output_file = output_dir / f"{slug}.mdoc"

    with open(output_file, "w", encoding="utf-8") as f:
        f.write(f"{frontmatter}\n\n{markdown_content}\n")

    return output_file


# ---------------------------------------------------------------------------
# Clear
# ---------------------------------------------------------------------------
def clear_local_data():
    """Delete all local news content and downloaded media."""
    print("\nClearing local data...")

    if OUTPUT_BASE.exists():
        for lang_dir in OUTPUT_BASE.iterdir():
            if lang_dir.is_dir() and lang_dir.name in LANGUAGES:
                count = sum(1 for f in lang_dir.glob("*.mdoc"))
                shutil.rmtree(lang_dir)
                print(f"  Deleted {count} files from {lang_dir.relative_to(PROJECT_ROOT)}")

    if MEDIA_DIR.exists():
        count = sum(1 for _ in MEDIA_DIR.rglob("*") if _.is_file())
        shutil.rmtree(MEDIA_DIR)
        print(f"  Deleted {count} media files from {MEDIA_DIR.relative_to(PROJECT_ROOT)}")

    print("  Done.\n")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    global last_run_iso, skip_media, force_overwrite

    parser = argparse.ArgumentParser(description="Migrate quinacare.org WordPress content via REST API")
    parser.add_argument("--clear", action="store_true", help="Clear local news + media before migrating")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be fetched without writing")
    parser.add_argument("--full", action="store_true", help="Full migration, ignore last-run timestamp")
    parser.add_argument("--force", action="store_true", help="Force overwrite existing posts/pages")
    parser.add_argument("--skip-media", action="store_true", help="Skip all media downloads (still fetches media index and resolves existing local files)")
    args = parser.parse_args()

    print("=" * 60)
    print("WordPress REST API Migration — quinacare.org")
    print("=" * 60)

    if args.clear:
        clear_local_data()
        if LAST_RUN_FILE.exists():
            LAST_RUN_FILE.unlink()

    # Force flag
    skip_media = args.skip_media
    force_overwrite = args.force

    # Auth
    wp_login()
    if _authenticated:
        status_filter = "publish,draft,pending,private"
    else:
        status_filter = "publish"

    # Determine incremental cutoff
    if args.full or args.clear or args.force:
        last_run_iso = None
        print("Mode: FULL migration")
    else:
        last_run_iso = load_last_run()
        if last_run_iso:
            print(f"Mode: INCREMENTAL (since {last_run_iso})")
        else:
            print("Mode: FULL migration (no previous run found)")

    # Ensure output dirs exist
    OUTPUT_BASE.mkdir(parents=True, exist_ok=True)
    MEDIA_DIR.mkdir(parents=True, exist_ok=True)

    # Step 1: Fetch taxonomies and authors (always full — small datasets)
    fetch_authors()
    fetch_categories()
    fetch_tags()

    # Step 2: Fetch media index (always needed for ID→URL resolution)
    fetch_all_media()

    # Step 3: Download media
    if args.skip_media:
        print("Skipping media download (--skip-media)")
    elif not args.dry_run:
        download_all_media()

    # Step 4: Fetch all posts + pages in a single pass, sort by language from link
    total_migrated = 0
    total_skipped = 0
    total_errors = 0

    params: dict = {"status": status_filter}
    if last_run_iso:
        params["modified_after"] = last_run_iso

    print("\nFetching posts...")
    all_posts = fetch_all_pages(f"{API_BASE}/posts", params)
    print(f"  {len(all_posts)} posts" + (f" (modified since {last_run_iso})" if last_run_iso else ""))

    print("Fetching pages...")
    all_pages = fetch_all_pages(f"{API_BASE}/pages", params)
    print(f"  {len(all_pages)} pages" + (f" (modified since {last_run_iso})" if last_run_iso else ""))

    all_items = [(item, "post") for item in all_posts] + [(item, "page") for item in all_pages]

    # Group by detected language
    by_lang: dict[str, list[tuple[dict, str]]] = {lang: [] for lang in LANGUAGES}
    skipped_lang = 0
    for item, item_type in all_items:
        lang = detect_language_from_link(item.get("link", ""))
        if lang in by_lang:
            by_lang[lang].append((item, item_type))
        else:
            skipped_lang += 1

    for lang in LANGUAGES:
        print(f"\n{'=' * 40}")
        print(f"Language: {lang} ({len(by_lang[lang])} items)")
        print(f"{'=' * 40}")

        if args.dry_run:
            total_migrated += len(by_lang[lang])
            continue

        for item, item_type in by_lang[lang]:
            try:
                result = migrate_item(item, lang, item_type)
                if result:
                    total_migrated += 1
                else:
                    total_skipped += 1
            except Exception as e:
                print(f"    [ERROR] {e}")
                total_errors += 1

    if skipped_lang:
        print(f"\n  Skipped {skipped_lang} items with unrecognized language")

    # Summary
    print(f"\n{'=' * 60}")
    if args.dry_run:
        print(f"Dry run complete — would migrate {total_migrated} items")
    else:
        print("Migration Complete!")
        print(f"  New:      {total_migrated} items")
        print(f"  Skipped:  {total_skipped} items (already existed)")
        print(f"  Errors:   {total_errors}")
        print(f"  Images:   {len(downloaded_images)}")
        print(f"  Output:   {OUTPUT_BASE.relative_to(PROJECT_ROOT)}")
        for lang in LANGUAGES:
            count = len(used_slugs.get(lang, set()))
            print(f"    {lang}: {count} files")

        # Save timestamp for next incremental run
        save_last_run()
    print("=" * 60)


if __name__ == "__main__":
    main()
