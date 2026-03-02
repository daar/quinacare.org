#!/usr/bin/env python3
"""
WordPress to Astro Markdoc Migration Script

Comprehensive single-script migration that:
- Parses WP XML with wpparser + custom postmeta extraction (fixes _thumbnail_id bug)
- Detects language via Polylang tags, slug prefix, or word frequency
- Downloads images preserving wp-content/uploads path structure
- Strips size suffixes to get original images
- Resolves featured images from _thumbnail_id or first <img> in content
- Converts shortcodes + HTML to Markdoc
- Outputs to src/content/news/{nl,en,es}/
"""

import os
import re
import sys
import hashlib
import requests
import xml.etree.ElementTree as ET
from pathlib import Path
from datetime import datetime
from urllib.parse import urlparse, unquote
from html import unescape
from typing import Optional

try:
    import wpparser
except ImportError:
    print("Error: wpparser not installed. Run: pip install wpparser")
    sys.exit(1)

try:
    from markdownify import MarkdownConverter
except ImportError:
    print("Error: markdownify not installed. Run: pip install markdownify")
    sys.exit(1)

try:
    import phpserialize
except ImportError:
    phpserialize = None

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent
XML_FILE = SCRIPT_DIR / "quinacare.WordPress.2024-04-14.xml"
OUTPUT_BASE = PROJECT_ROOT / "src" / "content" / "news"
IMAGES_DIR = PROJECT_ROOT / "src" / "assets" / "images" / "raw"
WP_BASE_URL = "https://www.quinacare.org"
DEFAULT_LANGUAGE = "nl"

# Runtime state
downloaded_images: dict[str, str] = {}
attachment_map: dict[str, str] = {}           # {attachment_id: url}
attachment_posts: dict[str, dict] = {}        # {attachment_id: wpparser post dict}
postmeta_map: dict[str, dict[str, str]] = {}

# Relative prefix from any language dir to src/assets/images/raw/
# e.g. src/content/news/nl/ -> ../../../assets/images/raw/
FRONTMATTER_IMAGE_PREFIX = "../../../assets/images/raw/"
BODY_IMAGE_PREFIX = "/images/raw/"

# Stop-word lists for language detection fallback
DUTCH_WORDS = [
    "de", "het", "een", "en", "van", "voor", "met", "zijn", "worden", "naar",
    "ook", "niet", "maar", "bij", "onze", "ons", "wij", "zij", "deze", "dit",
    "dat", "hier", "daar", "heeft", "werd", "meer", "nog", "over", "uit",
]
ENGLISH_WORDS = [
    "the", "is", "are", "was", "were", "have", "has", "for", "with", "this",
    "that", "which", "from", "they", "their", "our", "your", "been", "will",
    "would", "could", "should", "about", "into",
]
SPANISH_WORDS = [
    "el", "la", "los", "las", "un", "una", "para", "con", "por", "está",
    "están", "que", "como", "más", "pero", "también", "del", "este", "esta",
    "son", "fue", "muy", "todo", "tiene",
]

# Size suffix pattern: image-300x200.jpg → image.jpg
SIZE_SUFFIX_RE = re.compile(r"-\d+x\d+(\.\w+)$")


# ---------------------------------------------------------------------------
# 1. Custom postmeta extraction (fixes wpparser _thumbnail_id bug)
# ---------------------------------------------------------------------------
def extract_postmeta_from_xml(xml_path: str) -> dict[str, dict[str, str]]:
    """Parse XML directly to extract all wp:postmeta per post_id.

    wpparser silently drops _thumbnail_id and other postmeta.
    We build {post_id: {meta_key: meta_value}} by walking the XML tree.
    """
    ns = {
        "wp": "http://wordpress.org/export/1.2/",
        "content": "http://purl.org/rss/1.0/modules/content/",
        "excerpt": "http://wordpress.org/export/1.2/excerpt/",
    }
    result: dict[str, dict[str, str]] = {}

    tree = ET.parse(xml_path)
    root = tree.getroot()

    for item in root.iter("item"):
        post_id_el = item.find("wp:post_id", ns)
        if post_id_el is None or not post_id_el.text:
            continue
        post_id = post_id_el.text.strip()
        meta: dict[str, str] = {}
        for pm in item.findall("wp:postmeta", ns):
            key_el = pm.find("wp:meta_key", ns)
            val_el = pm.find("wp:meta_value", ns)
            if key_el is not None and key_el.text and val_el is not None:
                meta[key_el.text.strip()] = (val_el.text or "").strip()
        if meta:
            result[post_id] = meta

    return result


# ---------------------------------------------------------------------------
# 2. Language detection
# ---------------------------------------------------------------------------
def detect_language(post: dict) -> str:
    """Detect language using Polylang tags → slug prefix → word frequency → default."""

    # Priority 1: Polylang tags (wpparser puts domain="language" into tags)
    for tag in post.get("tags", []):
        if isinstance(tag, dict):
            nicename = tag.get("nicename", "").lower()
            domain = tag.get("domain", "")
            if domain == "language" or nicename in ("nl", "en", "es"):
                if nicename in ("nl", "en", "es"):
                    return nicename
        else:
            tag_str = str(tag).lower()
            if tag_str in ("nl", "en", "es"):
                return tag_str

    # Priority 2: Slug prefix
    slug = post.get("post_name", "")
    if slug:
        if slug.startswith("en-"):
            return "en"
        if slug.startswith("es-"):
            return "es"
        if slug.startswith("nl-"):
            return "nl"

    # Priority 3: Word frequency analysis
    content = post.get("content", "") or ""
    title = post.get("title", "") or ""
    text = f"{title} {content}".lower()

    def count_words(word_list):
        return sum(1 for w in word_list if f" {w} " in text or text.startswith(f"{w} "))

    nl_count = count_words(DUTCH_WORDS)
    en_count = count_words(ENGLISH_WORDS)
    es_count = count_words(SPANISH_WORDS)

    if nl_count >= en_count and nl_count >= es_count:
        return "nl"
    if es_count > nl_count and es_count > en_count:
        return "es"
    if en_count > nl_count and en_count > es_count:
        return "en"

    # Priority 4: Default
    return DEFAULT_LANGUAGE


# ---------------------------------------------------------------------------
# 3. Image pipeline
# ---------------------------------------------------------------------------
def strip_size_suffix(url: str) -> str:
    """Convert image-300x200.jpg → image.jpg to request the original."""
    return SIZE_SUFFIX_RE.sub(r"\1", url)


def download_image(url: str) -> Optional[str]:
    """Download an image and return its *body* path (/images/raw/YYYY/MM/file.ext).

    Returns None on failure. Skips already-downloaded or already-existing files.
    """
    if not url:
        return None

    # Normalize URL
    if url.startswith("//"):
        url = "https:" + url
    elif url.startswith("/"):
        url = WP_BASE_URL + url

    # Strip size suffixes to get the original
    original_url = strip_size_suffix(url)

    # Check cache (try both original and sized URL)
    for u in (original_url, url):
        if u in downloaded_images:
            return downloaded_images[u]

    # Determine relative path after wp-content/uploads/
    parsed = urlparse(original_url)
    url_path = unquote(parsed.path)

    if "wp-content/uploads/" in url_path:
        rel_path = url_path.split("wp-content/uploads/")[-1]
    else:
        filename = os.path.basename(url_path) or "image"
        url_hash = hashlib.md5(original_url.encode()).hexdigest()[:8]
        rel_path = f"other/{url_hash}_{filename}"

    local_file = IMAGES_DIR / rel_path
    body_path = f"{BODY_IMAGE_PREFIX}{rel_path}"

    # Skip if already on disk
    if local_file.exists():
        downloaded_images[original_url] = body_path
        downloaded_images[url] = body_path
        return body_path

    # Try downloading the original first, fall back to sized URL
    for try_url in (original_url, url):
        try:
            print(f"  [DOWNLOAD] {try_url}")
            resp = requests.get(try_url, timeout=30, allow_redirects=True)
            resp.raise_for_status()
            local_file.parent.mkdir(parents=True, exist_ok=True)
            with open(local_file, "wb") as f:
                f.write(resp.content)
            downloaded_images[original_url] = body_path
            downloaded_images[url] = body_path
            return body_path
        except Exception:
            continue

    print(f"  [ERROR] Failed to download {original_url}")
    return None


def body_path_to_frontmatter_path(body_path: str) -> str:
    """Convert /images/raw/YYYY/MM/file.ext → ../../../assets/images/raw/YYYY/MM/file.ext."""
    rel = body_path.removeprefix(BODY_IMAGE_PREFIX)
    return f"{FRONTMATTER_IMAGE_PREFIX}{rel}"


# ---------------------------------------------------------------------------
# 4. Attachment map
# ---------------------------------------------------------------------------
def build_attachment_map(posts: list):
    """Build {attachment_id: url} and {attachment_id: post} from wpparser's attachment posts."""
    global attachment_map, attachment_posts
    for post in posts:
        if post.get("post_type") != "attachment":
            continue
        post_id = str(post.get("post_id", ""))
        url = post.get("guid", "")
        if not url or not url.startswith("http"):
            meta = postmeta_map.get(post_id, {})
            attached = meta.get("_wp_attached_file", "")
            if attached:
                url = f"{WP_BASE_URL}/wp-content/uploads/{attached}"
        if post_id and url:
            attachment_map[post_id] = url
            attachment_posts[post_id] = post


def get_attachment_meta(attachment_id: str) -> dict[str, str]:
    """Extract caption and copyright from an attachment's metadata.

    Sources checked (in priority order for each field):
    - _wp_attachment_metadata → image_meta (caption, copyright, credit)
    - Attachment post excerpt (WP caption field)
    - _wp_attachment_image_alt
    """
    result: dict[str, str] = {}

    # Attachment post data (excerpt = WP caption)
    att_post = attachment_posts.get(attachment_id, {})
    wp_caption = (att_post.get("excerpt", "") or "").strip()

    # Postmeta
    meta = postmeta_map.get(attachment_id, {})
    alt_text = meta.get("_wp_attachment_image_alt", "").strip()

    # Deserialize _wp_attachment_metadata for image_meta
    image_meta: dict = {}
    raw_meta = meta.get("_wp_attachment_metadata", "")
    if raw_meta and phpserialize and raw_meta.startswith("a:"):
        try:
            parsed = phpserialize.loads(raw_meta.encode(), decode_strings=True)
            image_meta = parsed.get("image_meta", {}) or {}
        except Exception:
            pass

    # Caption: image_meta.caption → WP excerpt → alt text
    caption = (
        (image_meta.get("caption", "") or "").strip()
        or wp_caption
        or alt_text
    )
    # Filter out camera model noise (SONY DSC, SAMSUNG CSC, DCIM*, Created with GIMP)
    if caption and not re.match(r"^(SONY DSC|SAMSUNG CSC|DCIM\w*|Created with GIMP)$", caption, re.I):
        result["caption"] = caption

    # Copyright: image_meta.copyright (+ credit if different)
    copyright_val = (image_meta.get("copyright", "") or "").strip()
    credit = (image_meta.get("credit", "") or "").strip()
    if copyright_val:
        result["copyright"] = copyright_val
    elif credit:
        result["copyright"] = credit

    return result


# ---------------------------------------------------------------------------
# 5. Featured image resolution
# ---------------------------------------------------------------------------
def resolve_featured_image(post: dict, content: str) -> tuple[Optional[str], dict[str, str], str]:
    """Resolve featured image.

    Returns (frontmatter_path, attachment_meta_dict, possibly_modified_content).
    attachment_meta_dict may contain 'caption' and/or 'copyright' keys.

    Priority:
    1. _thumbnail_id from postmeta → attachment map → download
    2. First <img> in content → download → remove from content
    """
    post_id = str(post.get("post_id", ""))

    # Priority 1: _thumbnail_id
    meta = postmeta_map.get(post_id, {})
    thumbnail_id = meta.get("_thumbnail_id", "")
    if thumbnail_id and thumbnail_id in attachment_map:
        url = attachment_map[thumbnail_id]
        body_path = download_image(url)
        if body_path:
            att_meta = get_attachment_meta(thumbnail_id)
            return body_path_to_frontmatter_path(body_path), att_meta, content

    # Priority 2: First <img> in content
    img_match = re.search(r"<img[^>]+src=[\"']([^\"']+)[\"'][^>]*>", content or "", re.IGNORECASE)
    if img_match:
        src = img_match.group(1)
        body_path = download_image(src)
        if body_path:
            # Extract alt text from the img tag as a caption fallback
            alt_match = re.search(r'alt=["\']([^"\']*)["\']', img_match.group(0), re.I)
            alt_text = (alt_match.group(1) if alt_match else "").strip()
            att_meta: dict[str, str] = {}
            if alt_text and not re.match(r"^(SONY DSC|SAMSUNG CSC|DCIM\w*|Created with GIMP)$", alt_text, re.I):
                att_meta["caption"] = alt_text

            # Remove the first img (and its wrapping <a> if present) so it doesn't appear twice
            full_match = img_match.group(0)
            a_pattern = re.compile(
                r"<a[^>]*>\s*" + re.escape(full_match) + r"\s*</a>",
                re.IGNORECASE | re.DOTALL,
            )
            a_match = a_pattern.search(content)
            if a_match:
                content = content[: a_match.start()] + content[a_match.end() :]
            else:
                content = content.replace(full_match, "", 1)
            return body_path_to_frontmatter_path(body_path), att_meta, content

    return None, {}, content


# ---------------------------------------------------------------------------
# 6. Content processing
# ---------------------------------------------------------------------------
class ImageConverter(MarkdownConverter):
    """Custom markdownify converter that outputs {% image %} Markdoc tags."""

    def convert_img(self, el, text=None, *args, **kwargs):
        src = el.get("src", "")
        alt = el.get("alt", "")
        width = el.get("width", "")
        height = el.get("height", "")

        classes = el.get("class", "") or ""
        if isinstance(classes, list):
            classes = " ".join(classes)
        align = "center"
        if "alignleft" in classes or "wp-image-left" in classes:
            align = "left"
        elif "alignright" in classes or "wp-image-right" in classes:
            align = "right"

        local_path = download_image(src)
        if not local_path:
            return ""

        parts = [f'src="{local_path}"']
        if width:
            parts.append(f"width={width}")
        if height:
            parts.append(f"height={height}")
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


def process_embedyt(content: str) -> str:
    """Convert [embedyt]...[/embedyt] → YouTube links."""
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
    """Convert [info_box] shortcodes to markdown."""
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
    """Convert [gallery ids="..."] → multiple {% image %} tags."""
    def _replace(m):
        ids = [i.strip() for i in m.group(1).split(",") if i.strip()]
        images = []
        for aid in ids:
            if aid in attachment_map:
                path = download_image(attachment_map[aid])
                if path:
                    images.append(f'{{% image src="{path}" align="center" /%}}')
        return "\n\n".join(images) if images else ""

    return re.sub(r"\[gallery[^\]]*ids=[\"']([^\"']+)[\"'][^\]]*\]", _replace, content, flags=re.I)


def process_caption(content: str) -> str:
    """Convert [caption]...[/caption] → {% image %} with caption."""
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
        width_m = re.search(r'width=["\']?(\d+)["\']?', img_tag)
        height_m = re.search(r'height=["\']?(\d+)["\']?', img_tag)
        parts = [f'src="{local_path}"']
        if width_m:
            parts.append(f"width={width_m.group(1)}")
        if height_m:
            parts.append(f"height={height_m.group(1)}")
        if caption_text:
            parts.append(f'caption="{escape_markdoc_string(caption_text)}"')
        parts.append('align="center"')
        return f'{{% image {" ".join(parts)} /%}}'

    return re.sub(r"\[caption[^\]]*\](.*?)\[/caption\]", _replace, content, flags=re.DOTALL | re.I)


def process_vc_single_image(content: str) -> str:
    """Convert [vc_single_image image="ID" ...] → {% image %} via attachment map."""
    def _replace(m):
        attrs = m.group(1)
        img_id = re.search(r'image="(\d+)"', attrs)
        if not img_id:
            return ""
        aid = img_id.group(1)
        if aid not in attachment_map:
            return ""
        path = download_image(attachment_map[aid])
        if not path:
            return ""
        return f'\n\n{{% image src="{path}" align="center" /%}}\n\n'

    return re.sub(r"\[vc_single_image([^\]]*)\]", _replace, content, flags=re.I)


def process_vc_images_carousel(content: str) -> str:
    """Convert [vc_images_carousel images="1,2,3" ...] → multiple {% image %} tags."""
    def _replace(m):
        attrs = m.group(1)
        ids_match = re.search(r'images="([^"]+)"', attrs)
        if not ids_match:
            return ""
        ids = [i.strip() for i in ids_match.group(1).split(",") if i.strip()]
        images = []
        for aid in ids:
            if aid in attachment_map:
                path = download_image(attachment_map[aid])
                if path:
                    images.append(f'{{% image src="{path}" align="center" /%}}')
        return "\n\n".join(images) if images else ""

    return re.sub(r"\[vc_images_carousel([^\]]*)\]", _replace, content, flags=re.I)


def strip_shortcodes(content: str) -> str:
    """Strip WordPress shortcodes, preserving useful inner content where appropriate."""
    if not content:
        return ""

    # Remove duplicate VC responsive columns (mobile-hidden versions)
    content = re.sub(
        r'\[vc_row\]\[vc_column\s+offset="vc_hidden-lg[^"]*"\].*?\[/vc_column\]\[/vc_row\]',
        "", content, flags=re.DOTALL,
    )

    # Convert image-bearing VC shortcodes BEFORE blanket vc_ stripping
    content = process_vc_single_image(content)
    content = process_vc_images_carousel(content)

    # Convert other special shortcodes
    content = process_embedyt(content)
    content = process_info_box(content)

    # Extract text from vc_column_text
    content = re.sub(r"\[vc_column_text[^\]]*\]", "\n\n", content)
    content = re.sub(r"\[/vc_column_text\]", "\n\n", content)

    # Paired shortcodes: strip open + close tags
    paired = [
        "vc_", "et_", "bears_", "tbdonations", "contact-form", "embed",
    ]
    for prefix in paired:
        content = re.sub(rf"\[{prefix}[^\]]*\]", "", content)
        content = re.sub(rf"\[/{prefix}[^\]]*\]", "", content)

    # Self-closing / standalone shortcodes
    standalone = [
        "gallery", "wpforms", "instagram-feed", "profilepress", "wpcode",
        "email-subscribers", "blog_special", "story_special", "demo_item",
        "donation_box", "do_widget", "paytium", "blog",
    ]
    for tag in standalone:
        content = re.sub(rf"\[{tag}[^\]]*\]", "", content, flags=re.I)

    # Generic self-closing shortcodes [something /]
    content = re.sub(r"\[[a-z_]+[^\]]*\/\]", "", content, flags=re.I)

    return content


def preprocess_html(html: str) -> str:
    """Clean HTML before markdown conversion."""
    if not html:
        return ""

    # Remove styled spans but keep content
    html = re.sub(r'<span[^>]*style="[^"]*"[^>]*>(.*?)</span>', r"\1", html, flags=re.DOTALL)
    html = re.sub(r"<span[^>]*>\s*</span>", "", html)
    html = re.sub(r"<span[^>]*>", "", html)
    html = re.sub(r"</span>", "", html)

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

    # Remove bearsthemes links and URLs
    md = re.sub(r"\[[^\]]*\]\([^)]*bearsthemes\.com[^)]*\)", "", md)
    md = re.sub(r"https?://[^\s)]*bearsthemes\.com[^\s)]*", "", md)
    md = re.sub(r"theme\.bearsthemes\.com[^\s)]*", "", md)

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

    # Fix double colons in bold labels
    md = re.sub(r"\*\*([^*]+)::\*\*", r"**\1:**", md)

    # Paragraph separation
    md = re.sub(r'(\*"[^"]+"\*)\*\*', r"\1\n\n**", md)
    md = re.sub(r"([a-z.,!?])\*\*([A-Z])", r"\1\n\n**\2", md)
    md = re.sub(r"(\*\*[^*]+\*\*)\n?([A-Z][a-z])", r"\1\n\n\2", md)
    md = re.sub(r"\.(\n)([A-Z])", r".\n\n\2", md)

    return md


def html_to_markdown(html: str) -> str:
    """Full HTML-to-Markdown pipeline: shortcodes → gallery/caption → HTML → clean."""
    if not html:
        return ""

    content = strip_shortcodes(html)
    content = process_caption(content)
    content = process_gallery(content)

    # Protect {% image ... %} tags from markdownify's underscore escaping
    # by replacing them with unique placeholders before HTML→markdown conversion.
    # Use a format without double underscores (markdownify treats __ as bold).
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
        strip=["script", "style", "meta", "link"],
    )
    markdown = converter.convert(content)

    # Restore protected image tags
    for key, original in placeholders.items():
        markdown = markdown.replace(key, original)

    markdown = clean_markdown(markdown)
    markdown = re.sub(r"\n{3,}", "\n\n", markdown)
    return markdown.strip()


# ---------------------------------------------------------------------------
# 7. Category extraction
# ---------------------------------------------------------------------------
def extract_categories(post: dict) -> list[str]:
    """Extract non-language category names."""
    result = []
    for cat in post.get("categories", []):
        if isinstance(cat, dict):
            if cat.get("domain") == "language":
                continue
            name = cat.get("name", cat.get("nicename", ""))
        else:
            name = str(cat)
        if name and name.lower() not in ("en", "nl", "es", "english", "dutch", "nederlands", "spanish"):
            result.append(unescape(name))
    return result


# ---------------------------------------------------------------------------
# 8. Frontmatter + file output
# ---------------------------------------------------------------------------
def generate_frontmatter(
    post: dict,
    language: str,
    featured_image_path: Optional[str],
    featured_image_meta: dict[str, str],
) -> str:
    """Generate YAML frontmatter matching newsSchema."""
    title = unescape(post.get("title", "") or "Untitled")

    post_date = post.get("post_date", "")
    try:
        dt = datetime.strptime(post_date, "%Y-%m-%d %H:%M:%S")
        date_str = dt.strftime("%Y-%m-%d")
    except (ValueError, TypeError):
        date_str = datetime.now().strftime("%Y-%m-%d")

    status = post.get("status", "draft")
    slug = post.get("post_name", "") or sanitize_slug(title)
    author = post.get("creator", "")

    excerpt = post.get("excerpt", "") or ""
    if excerpt:
        excerpt = unescape(re.sub(r"<[^>]+>", "", excerpt)).strip()[:200]

    categories = extract_categories(post)

    lines = ["---"]
    lines.append(f"title: {escape_yaml_string(title)}")
    lines.append(f"date: {date_str}")
    lines.append(f"status: {status}")
    lines.append(f"slug: {escape_yaml_string(slug)}")
    if author:
        lines.append(f"author: {escape_yaml_string(author)}")
    if excerpt:
        lines.append(f"excerpt: {escape_yaml_string(excerpt)}")
    if categories:
        cat_list = ", ".join(f'"{c}"' for c in categories)
        lines.append(f"categories: [{cat_list}]")
    lines.append(f'language: "{language}"')
    if featured_image_path:
        lines.append(f"featured_image: {escape_yaml_string(featured_image_path)}")
    if featured_image_meta.get("caption"):
        lines.append(f"featured_image_caption: {escape_yaml_string(featured_image_meta['caption'])}")
    if featured_image_meta.get("copyright"):
        lines.append(f"featured_image_copyright: {escape_yaml_string(featured_image_meta['copyright'])}")
    lines.append("---")

    return "\n".join(lines)


def sanitize_slug(text: str) -> str:
    if not text:
        return "untitled"
    slug = re.sub(r"[^\w\-]", "-", text)
    slug = re.sub(r"-+", "-", slug)
    return slug.strip("-").lower() or "untitled"


# Track used slugs per language to handle duplicates
used_slugs: dict[str, set[str]] = {"nl": set(), "en": set(), "es": set()}


def get_unique_slug(slug: str, lang: str) -> str:
    """Return a unique slug for the given language, appending -1, -2, etc. if needed."""
    base = slug
    counter = 1
    while slug in used_slugs[lang]:
        slug = f"{base}-{counter}"
        counter += 1
    used_slugs[lang].add(slug)
    return slug


def migrate_post(post: dict) -> Optional[Path]:
    """Migrate a single post to Markdoc format."""
    title = post.get("title", "Untitled")
    raw_slug = post.get("post_name", "") or sanitize_slug(title)
    raw_slug = sanitize_slug(raw_slug)

    language = detect_language(post)
    content = post.get("content", "") or ""

    print(f"\nProcessing: {title}")
    print(f"  Language: {language} | Status: {post.get('status', 'unknown')}")

    # Resolve featured image (may modify content to remove first img)
    featured_path, featured_meta, content = resolve_featured_image(post, content)

    # Convert HTML content to markdown
    markdown_content = html_to_markdown(content)

    # De-duplicate slug within language
    slug = get_unique_slug(raw_slug, language)

    # Build output path
    output_dir = OUTPUT_BASE / language
    output_dir.mkdir(parents=True, exist_ok=True)
    output_file = output_dir / f"{slug}.mdoc"

    # Generate frontmatter
    frontmatter = generate_frontmatter(post, language, featured_path, featured_meta)

    # Write file
    with open(output_file, "w", encoding="utf-8") as f:
        f.write(f"{frontmatter}\n\n{markdown_content}\n")

    print(f"  Output: {output_file.relative_to(PROJECT_ROOT)}")
    return output_file


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    global postmeta_map

    print("=" * 60)
    print("WordPress to Astro Markdoc Migration")
    print("=" * 60)

    if not XML_FILE.exists():
        print(f"Error: XML file not found: {XML_FILE}")
        sys.exit(1)

    # Step 1: Custom postmeta extraction
    print(f"\nParsing postmeta from: {XML_FILE.name}")
    postmeta_map = extract_postmeta_from_xml(str(XML_FILE))
    print(f"  Extracted postmeta for {len(postmeta_map)} posts")

    # Step 2: Parse with wpparser
    print("Parsing with wpparser...")
    data = wpparser.parse(str(XML_FILE))
    all_posts = data.get("posts", [])
    print(f"  Found {len(all_posts)} total items")

    # Step 3: Build attachment map
    build_attachment_map(all_posts)
    print(f"  Found {len(attachment_map)} attachments")

    # Step 4: Filter posts/pages with non-empty titles
    posts_to_migrate = [
        p for p in all_posts
        if p.get("post_type") in ("post", "page") and p.get("title")
    ]
    print(f"  {len(posts_to_migrate)} posts/pages to migrate")

    # Ensure output + images dirs exist
    OUTPUT_BASE.mkdir(parents=True, exist_ok=True)
    IMAGES_DIR.mkdir(parents=True, exist_ok=True)

    # Step 5: Migrate
    migrated = 0
    errors = 0

    for post in posts_to_migrate:
        try:
            result = migrate_post(post)
            if result:
                migrated += 1
        except Exception as e:
            print(f"  [ERROR] {e}")
            errors += 1

    # Summary
    print("\n" + "=" * 60)
    print("Migration Complete!")
    print("=" * 60)
    print(f"  Migrated:   {migrated} posts/pages")
    print(f"  Errors:     {errors}")
    print(f"  Images:     {len(downloaded_images)}")
    print(f"  Output:     {OUTPUT_BASE.relative_to(PROJECT_ROOT)}")

    # Per-language counts
    for lang in ("nl", "en", "es"):
        count = len(used_slugs.get(lang, set()))
        print(f"    {lang}: {count} files")


if __name__ == "__main__":
    main()
