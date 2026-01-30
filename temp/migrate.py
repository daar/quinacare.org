#!/usr/bin/env python3
"""
WordPress to Astro Markdoc Migration Script

Migrates WordPress content to Astro Markdoc format based on parser.py (wpparser approach).
"""

import os
import re
import sys
import hashlib
import requests
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
    from markdownify import markdownify as md, MarkdownConverter
except ImportError:
    print("Error: markdownify not installed. Run: pip install markdownify")
    sys.exit(1)

# Configuration
SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent
XML_FILE = SCRIPT_DIR / "quinacare.WordPress.2024-04-14.xml"
OUTPUT_DIR = PROJECT_ROOT / "src" / "content" / "blog"
IMAGES_DIR = PROJECT_ROOT / "src" / "assets" / "images" / "raw"

# WordPress site URL for image downloads
WP_BASE_URL = "https://www.quinacare.org"

# Track downloaded images to avoid duplicates
downloaded_images = {}

# Attachment ID to URL mapping
attachment_map = {}


class ImageConverter(MarkdownConverter):
    """Custom converter that handles images specially."""

    def convert_img(self, el, text=None, *args, **kwargs):
        """Convert img tags to Markdoc image tags."""
        src = el.get('src', '')
        alt = el.get('alt', '')
        width = el.get('width', '')
        height = el.get('height', '')

        # Extract alignment from class
        classes = el.get('class', '') or ''
        if isinstance(classes, list):
            classes = ' '.join(classes)
        align = 'center'
        if 'alignleft' in classes or 'wp-image-left' in classes:
            align = 'left'
        elif 'alignright' in classes or 'wp-image-right' in classes:
            align = 'right'
        elif 'aligncenter' in classes:
            align = 'center'

        # Download image and get local path
        local_path = download_image(src)
        if not local_path:
            return ''

        # Build Markdoc image tag
        parts = [f'src="{local_path}"']
        if width:
            parts.append(f'width={width}')
        if height:
            parts.append(f'height={height}')
        if alt:
            parts.append(f'caption="{escape_markdoc_string(alt)}"')
        parts.append(f'align="{align}"')

        return f'{{% image {" ".join(parts)} %}}\n\n'


def escape_markdoc_string(s: str) -> str:
    """Escape special characters in Markdoc strings."""
    return s.replace('"', '\\"').replace('\n', ' ').strip()


def escape_yaml_string(s: str) -> str:
    """Escape string for YAML frontmatter."""
    if not s:
        return '""'
    # If contains quotes or special chars, wrap in quotes and escape
    if any(c in s for c in ['"', "'", ':', '#', '\n', '[', ']', '{', '}']):
        return '"' + s.replace('\\', '\\\\').replace('"', '\\"').replace('\n', ' ') + '"'
    return f'"{s}"'


def download_image(url: str) -> Optional[str]:
    """Download an image and return the local path relative to src/assets/images."""
    if not url:
        return None

    # Normalize URL
    if url.startswith('//'):
        url = 'https:' + url
    elif url.startswith('/'):
        url = WP_BASE_URL + url

    # Check if already downloaded
    if url in downloaded_images:
        return downloaded_images[url]

    # Parse URL to get path
    parsed = urlparse(url)
    url_path = unquote(parsed.path)

    # Extract path after wp-content/uploads/
    if 'wp-content/uploads/' in url_path:
        rel_path = url_path.split('wp-content/uploads/')[-1]
    else:
        # Use filename with hash for other URLs
        filename = os.path.basename(url_path) or 'image'
        url_hash = hashlib.md5(url.encode()).hexdigest()[:8]
        rel_path = f"other/{url_hash}_{filename}"

    # Create local path
    local_file = IMAGES_DIR / rel_path

    # Return path relative to src/assets/images for Astro
    local_path = f"/images/raw/{rel_path}"

    # Skip if already exists
    if local_file.exists():
        downloaded_images[url] = local_path
        print(f"  [EXISTS] {rel_path}")
        return local_path

    # Download the image
    try:
        print(f"  [DOWNLOAD] {url}")
        response = requests.get(url, timeout=30, allow_redirects=True)
        response.raise_for_status()

        # Create directory if needed
        local_file.parent.mkdir(parents=True, exist_ok=True)

        # Save the file
        with open(local_file, 'wb') as f:
            f.write(response.content)

        downloaded_images[url] = local_path
        return local_path

    except Exception as e:
        print(f"  [ERROR] Failed to download {url}: {e}")
        return None


def process_info_box_shortcode(content: str) -> str:
    """Convert [info_box] shortcodes to markdown."""
    # Pattern: [info_box icon="..." title="..." el_class="..."]content[/info_box]
    info_box_pattern = r'\[info_box[^\]]*title="([^"]*)"[^\]]*\](.*?)\[/info_box\]'

    def replace_info_box(match):
        title = match.group(1).strip()
        inner_content = match.group(2).strip()
        # Skip if inner content is another shortcode
        if inner_content.startswith('['):
            return ''
        if title and inner_content:
            return f'**{title}:** {inner_content}\n\n'
        elif inner_content:
            return f'{inner_content}\n\n'
        return ''

    return re.sub(info_box_pattern, replace_info_box, content, flags=re.DOTALL | re.IGNORECASE)


def process_embedyt_shortcode(content: str) -> str:
    """Convert [embedyt] shortcodes to YouTube links."""
    # Pattern: [embedyt] https://youtu.be/VIDEO_ID [/embedyt]
    # or [embedyt] https://www.youtube.com/watch?v=VIDEO_ID [/embedyt]
    embedyt_pattern = r'\[embedyt\]\s*(https?://[^\s\[]+)\s*\[/embedyt\]'

    def replace_embedyt(match):
        url = match.group(1).strip()
        # Extract video ID from various YouTube URL formats
        video_id = None

        # youtu.be/VIDEO_ID
        if 'youtu.be/' in url:
            video_id = url.split('youtu.be/')[-1].split('?')[0].split('&')[0]
        # youtube.com/watch?v=VIDEO_ID
        elif 'youtube.com/watch' in url:
            match_v = re.search(r'[?&]v=([^&]+)', url)
            if match_v:
                video_id = match_v.group(1)

        if video_id:
            # Return as a simple YouTube link with newlines for separation
            return f'\n\n[Watch on YouTube](https://www.youtube.com/watch?v={video_id})\n\n'
        return ''

    return re.sub(embedyt_pattern, replace_embedyt, content, flags=re.IGNORECASE)


def strip_shortcodes(content: str) -> str:
    """Strip WordPress shortcodes from content."""
    if not content:
        return ''

    # Remove duplicate responsive content (Visual Composer hidden columns)
    # These have offset="vc_hidden-xs" or offset="vc_hidden-lg vc_hidden-md vc_hidden-sm"
    # Keep only one version (remove mobile-hidden versions)
    content = re.sub(
        r'\[vc_row\]\[vc_column\s+offset="vc_hidden-lg[^"]*"\].*?\[/vc_column\]\[/vc_row\]',
        '',
        content,
        flags=re.DOTALL
    )

    # Convert embedyt shortcodes to YouTube links first
    content = process_embedyt_shortcode(content)

    # Convert info_box shortcodes to markdown
    content = process_info_box_shortcode(content)

    # Extract text from vc_column_text shortcodes and add line breaks
    content = re.sub(r'\[vc_column_text[^\]]*\]', '\n\n', content)
    content = re.sub(r'\[/vc_column_text\]', '\n\n', content)

    # Strip other Visual Composer shortcodes [vc_*]...[/vc_*]
    content = re.sub(r'\[vc_[^\]]*\]', '', content)
    content = re.sub(r'\[/vc_[^\]]*\]', '', content)

    # Strip Divi shortcodes [et_*]...[/et_*]
    content = re.sub(r'\[et_[^\]]*\]', '', content)
    content = re.sub(r'\[/et_[^\]]*\]', '', content)

    # Strip BearsThemes shortcodes [bears_*]
    # Types: bears_block, bears_blog, bears_button, bears_carousel,
    #        bears_clientlogo, bears_donation, bears_lightbox
    content = re.sub(r'\[bears_[^\]]*\]', '', content)
    content = re.sub(r'\[/bears_[^\]]*\]', '', content)

    # Strip demo_item and donation_box shortcodes (theme demo content)
    content = re.sub(r'\[demo_item[^\]]*\]', '', content)
    content = re.sub(r'\[donation_box[^\]]*\]', '', content)

    # Strip donation shortcodes
    content = re.sub(r'\[tbdonations[^\]]*\]', '', content)
    content = re.sub(r'\[/tbdonations[^\]]*\]', '', content)

    # Strip widget shortcodes
    content = re.sub(r'\[do_widget[^\]]*\]', '', content)

    # Strip form shortcodes (wpforms, contact forms, etc.)
    content = re.sub(r'\[wpforms[^\]]*\]', '', content)
    content = re.sub(r'\[contact-form[^\]]*\].*?\[/contact-form\]', '', content, flags=re.DOTALL)

    # Strip instagram feed
    content = re.sub(r'\[instagram-feed[^\]]*\]', '', content)

    # Strip profilepress shortcodes (login, registration, etc.)
    content = re.sub(r'\[profilepress[^\]]*\]', '', content)

    # Strip other known shortcodes
    content = re.sub(r'\[embed\].*?\[/embed\]', '', content, flags=re.DOTALL)
    content = re.sub(r'\[wpcode[^\]]*\]', '', content)

    # Strip email-subscribers shortcodes
    content = re.sub(r'\[email-subscribers[^\]]*\]', '', content)

    # Strip blog_special and story_special shortcodes
    content = re.sub(r'\[blog_special[^\]]*\]', '', content)
    content = re.sub(r'\[story_special[^\]]*\]', '', content)

    # Strip generic shortcodes but keep inner text for some
    # Remove self-closing shortcodes like [shortcode attr="value" /]
    content = re.sub(r'\[[a-z_]+[^\]]*\/\]', '', content, flags=re.IGNORECASE)

    return content


def process_gallery_shortcode(content: str) -> str:
    """Convert [gallery] shortcodes to multiple image tags."""
    gallery_pattern = r'\[gallery[^\]]*ids=["\']([^"\']+)["\'][^\]]*\]'

    def replace_gallery(match):
        ids_str = match.group(1)
        ids = [id.strip() for id in ids_str.split(',') if id.strip()]

        images_md = []
        for attachment_id in ids:
            if attachment_id in attachment_map:
                url = attachment_map[attachment_id]
                local_path = download_image(url)
                if local_path:
                    images_md.append(f'{{% image src="{local_path}" align="center" %}}')

        return '\n\n'.join(images_md) if images_md else ''

    return re.sub(gallery_pattern, replace_gallery, content, flags=re.IGNORECASE)


def process_caption_shortcode(content: str) -> str:
    """Convert [caption] shortcodes to image tags with captions."""
    # Pattern: [caption ...]<img .../>Caption text[/caption]
    caption_pattern = r'\[caption[^\]]*\](.*?)\[/caption\]'

    def replace_caption(match):
        inner = match.group(1)

        # Extract img tag
        img_match = re.search(r'<img[^>]+>', inner, re.IGNORECASE)
        if not img_match:
            return ''

        img_tag = img_match.group(0)

        # Extract caption text (everything after img tag)
        caption_text = inner[img_match.end():].strip()
        caption_text = re.sub(r'<[^>]+>', '', caption_text).strip()  # Remove HTML tags

        # Parse img attributes
        src_match = re.search(r'src=["\']([^"\']+)["\']', img_tag)
        width_match = re.search(r'width=["\']?(\d+)["\']?', img_tag)
        height_match = re.search(r'height=["\']?(\d+)["\']?', img_tag)

        if not src_match:
            return ''

        src = src_match.group(1)
        local_path = download_image(src)
        if not local_path:
            return ''

        parts = [f'src="{local_path}"']
        if width_match:
            parts.append(f'width={width_match.group(1)}')
        if height_match:
            parts.append(f'height={height_match.group(1)}')
        if caption_text:
            parts.append(f'caption="{escape_markdoc_string(caption_text)}"')
        parts.append('align="center"')

        return f'{{% image {" ".join(parts)} %}}'

    return re.sub(caption_pattern, replace_caption, content, flags=re.DOTALL | re.IGNORECASE)


def clean_markdown(markdown: str) -> str:
    """Clean up markdown content after conversion."""
    if not markdown:
        return ''

    # Remove markdown links pointing to bearsthemes.com
    # Pattern: [text](http://...bearsthemes.com...)
    markdown = re.sub(r'\[[^\]]*\]\([^)]*bearsthemes\.com[^)]*\)', '', markdown)

    # Also remove plain bearsthemes.com URLs
    markdown = re.sub(r'https?://[^\s)]*bearsthemes\.com[^\s)]*', '', markdown)
    markdown = re.sub(r'theme\.bearsthemes\.com[^\s)]*', '', markdown)

    # Remove links to old hosting (50.87.248.77)
    markdown = re.sub(r'\[[^\]]*\]\([^)]*50\.87\.248\.77[^)]*\)', '', markdown)
    markdown = re.sub(r'https?://50\.87\.248\.77[^\s)]*', '', markdown)

    # Clean up empty markdown links like [text]()
    markdown = re.sub(r'\[[^\]]+\]\(\s*\)', '', markdown)

    # Clean up orphaned link text in brackets followed by empty parens
    markdown = re.sub(r'\[\s*\]\([^)]*\)', '', markdown)

    # Remove **XX** date artifacts (bold numbers from theme)
    markdown = re.sub(r'\*\*\d{2}\*\*', '', markdown)

    # Remove remaining shortcode-like patterns with escaped underscores
    # e.g., [info\_box ...], [do\_widget ...]
    markdown = re.sub(r'\[[a-z]+\\_[^\]]*\]', '', markdown, flags=re.IGNORECASE)
    markdown = re.sub(r'\[/[a-z]+\\_[^\]]*\]', '', markdown, flags=re.IGNORECASE)

    # Fix escaped asterisks from markdown conversion (for bold text)
    markdown = re.sub(r'\\\*\\\*([^*]+)\\\*\\\*', r'**\1**', markdown)

    # Fix double colons in bold labels (from info_box titles ending with :)
    markdown = re.sub(r'\*\*([^*]+)::\*\*', r'**\1:**', markdown)

    # Ensure line break after italic quotes followed by bold text
    # Pattern: *"text"***bold** -> *"text"*\n\n**bold**
    markdown = re.sub(r'(\*"[^"]+"\*)\*\*', r'\1\n\n**', markdown)

    # Ensure line break before paragraphs starting with bold
    markdown = re.sub(r'([a-z.,!?])\*\*([A-Z])', r'\1\n\n**\2', markdown)

    # Ensure line break after bold text followed by regular text
    # Pattern: **text**Regular -> **text**\n\nRegular
    markdown = re.sub(r'(\*\*[^*]+\*\*)\n?([A-Z][a-z])', r'\1\n\n\2', markdown)

    # Ensure sentences ending with period followed by new sentence have line break
    # This helps with paragraph detection (only if it looks like a new paragraph)
    markdown = re.sub(r'\.(\n)([A-Z])', r'.\n\n\2', markdown)

    return markdown


def preprocess_html(html_content: str) -> str:
    """Preprocess HTML before markdown conversion."""
    if not html_content:
        return ''

    content = html_content

    # Remove span tags with style attributes but keep content
    # <span style="...">text</span> -> text
    content = re.sub(r'<span[^>]*style="[^"]*"[^>]*>(.*?)</span>', r'\1', content, flags=re.DOTALL)

    # Remove empty spans
    content = re.sub(r'<span[^>]*>\s*</span>', '', content)

    # Remove remaining style-only spans (nested)
    content = re.sub(r'<span[^>]*>', '', content)
    content = re.sub(r'</span>', '', content)

    # Add line breaks before block-level elements for better conversion
    content = re.sub(r'(<p[^>]*>)', r'\n\n\1', content)
    content = re.sub(r'(</p>)', r'\1\n\n', content)
    content = re.sub(r'(<div[^>]*>)', r'\n\n\1', content)
    content = re.sub(r'(</div>)', r'\1\n\n', content)
    content = re.sub(r'(<h[1-6][^>]*>)', r'\n\n\1', content)
    content = re.sub(r'(</h[1-6]>)', r'\1\n\n', content)

    return content


def html_to_markdown(html_content: str) -> str:
    """Convert HTML content to Markdown with custom image handling."""
    if not html_content:
        return ''

    # First, handle shortcodes
    content = strip_shortcodes(html_content)
    content = process_caption_shortcode(content)
    content = process_gallery_shortcode(content)

    # Preprocess HTML to clean up spans and add spacing
    content = preprocess_html(content)

    # Convert remaining HTML to Markdown using custom converter
    converter = ImageConverter(
        heading_style='atx',
        bullets='-',
        strong_em_symbol='*',
        strip=['script', 'style', 'meta', 'link']
    )
    markdown = converter.convert(content)

    # Clean up the markdown (remove theme links, etc.)
    markdown = clean_markdown(markdown)

    # Clean up extra whitespace
    markdown = re.sub(r'\n{3,}', '\n\n', markdown)
    markdown = markdown.strip()

    return markdown


def extract_language(post: dict) -> str:
    """Extract language from post categories/terms."""
    categories = post.get('categories', [])

    for cat in categories:
        if isinstance(cat, dict):
            nicename = cat.get('nicename', '').lower()
        else:
            nicename = str(cat).lower()

        if nicename in ['en', 'english', 'en-gb', 'en-us']:
            return 'en'
        elif nicename in ['nl', 'dutch', 'nederlands']:
            return 'nl'
        elif nicename in ['es', 'spanish', 'espanol']:
            return 'es'

    return 'en'  # Default to English


def extract_categories(post: dict) -> list:
    """Extract category names from post."""
    categories = post.get('categories', [])
    result = []

    for cat in categories:
        if isinstance(cat, dict):
            name = cat.get('name', cat.get('nicename', ''))
            # Skip language categories
            if cat.get('domain') == 'language':
                continue
        else:
            name = str(cat)

        if name and name not in ['en', 'nl', 'es', 'English', 'Dutch', 'Nederlands', 'Spanish']:
            # Decode HTML entities
            name = unescape(name)
            result.append(name)

    return result


def get_featured_image(post: dict, all_posts: list) -> Optional[str]:
    """Get featured image URL from post metadata."""
    meta = post.get('postmeta', {})

    # Look for _thumbnail_id in metadata
    thumbnail_id = None
    if isinstance(meta, dict):
        thumbnail_id = meta.get('_thumbnail_id')
    elif isinstance(meta, list):
        for m in meta:
            if isinstance(m, dict) and m.get('key') == '_thumbnail_id':
                thumbnail_id = m.get('value')
                break

    if thumbnail_id and str(thumbnail_id) in attachment_map:
        url = attachment_map[str(thumbnail_id)]
        return download_image(url)

    return None


def sanitize_slug(slug: str) -> str:
    """Sanitize slug for use as filename."""
    if not slug:
        return 'untitled'
    # Remove unsafe characters
    slug = re.sub(r'[^\w\-]', '-', slug)
    slug = re.sub(r'-+', '-', slug)
    slug = slug.strip('-').lower()
    return slug or 'untitled'


def generate_frontmatter(post: dict, all_posts: list) -> str:
    """Generate YAML frontmatter for the post."""
    title = post.get('title', 'Untitled')
    title = unescape(title) if title else 'Untitled'

    # Parse date
    post_date = post.get('post_date', '')
    try:
        date = datetime.strptime(post_date, "%Y-%m-%d %H:%M:%S")
        date_str = date.strftime("%Y-%m-%d")
    except (ValueError, TypeError):
        date_str = datetime.now().strftime("%Y-%m-%d")

    status = post.get('status', 'draft')
    slug = post.get('post_name', '') or sanitize_slug(title)
    author = post.get('creator', 'Unknown')
    excerpt = post.get('excerpt', '')
    if excerpt:
        excerpt = unescape(re.sub(r'<[^>]+>', '', excerpt)).strip()

    categories = extract_categories(post)
    language = extract_language(post)
    featured_image = get_featured_image(post, all_posts)

    # Build frontmatter
    lines = ['---']
    lines.append(f'title: {escape_yaml_string(title)}')
    lines.append(f'date: {date_str}')
    lines.append(f'status: {status}')
    lines.append(f'slug: {escape_yaml_string(slug)}')

    if author:
        lines.append(f'author: {escape_yaml_string(author)}')

    if excerpt:
        lines.append(f'excerpt: {escape_yaml_string(excerpt[:200])}')

    if categories:
        cat_list = ', '.join(f'"{c}"' for c in categories)
        lines.append(f'categories: [{cat_list}]')

    lines.append(f'language: "{language}"')

    if featured_image:
        lines.append(f'featured_image: "{featured_image}"')

    lines.append('---')

    return '\n'.join(lines)


def migrate_post(post: dict, all_posts: list) -> Optional[Path]:
    """Migrate a single post to Markdoc format."""
    title = post.get('title', 'Untitled')
    slug = post.get('post_name', '') or sanitize_slug(title)
    slug = sanitize_slug(slug)

    # Handle duplicate slugs
    output_file = OUTPUT_DIR / f"{slug}.mdoc"
    counter = 1
    while output_file.exists():
        output_file = OUTPUT_DIR / f"{slug}-{counter}.mdoc"
        counter += 1

    print(f"\nProcessing: {title}")
    print(f"  Status: {post.get('status', 'unknown')}")
    print(f"  Output: {output_file.name}")

    # Generate frontmatter
    frontmatter = generate_frontmatter(post, all_posts)

    # Convert content to Markdown
    content = post.get('content', '')
    markdown_content = html_to_markdown(content)

    # Combine frontmatter and content
    full_content = f"{frontmatter}\n\n{markdown_content}\n"

    # Write the file
    output_file.parent.mkdir(parents=True, exist_ok=True)
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(full_content)

    return output_file


def build_attachment_map(posts: list):
    """Build a mapping of attachment IDs to URLs."""
    global attachment_map

    for post in posts:
        post_type = post.get('post_type', '')
        if post_type == 'attachment':
            post_id = str(post.get('post_id', ''))

            # Try to get URL from guid or construct from attached_file
            attachment_url = post.get('guid', '')

            # If guid is not a full URL, try to construct from attached_file
            if not attachment_url or not attachment_url.startswith('http'):
                postmeta = post.get('postmeta', {})
                attached_file = postmeta.get('attached_file', '') if isinstance(postmeta, dict) else ''
                if attached_file:
                    attachment_url = f"{WP_BASE_URL}/wp-content/uploads/{attached_file}"

            if post_id and attachment_url:
                attachment_map[post_id] = attachment_url


def main():
    """Main migration function."""
    print("=" * 60)
    print("WordPress to Astro Markdoc Migration")
    print("=" * 60)

    # Check XML file exists
    if not XML_FILE.exists():
        print(f"Error: XML file not found: {XML_FILE}")
        sys.exit(1)

    print(f"\nParsing: {XML_FILE}")

    # Parse WordPress XML
    data = wpparser.parse(str(XML_FILE))
    all_posts = data.get('posts', [])

    print(f"Found {len(all_posts)} total items")

    # Build attachment map first
    build_attachment_map(all_posts)
    print(f"Found {len(attachment_map)} attachments")

    # Filter to posts and pages only
    posts_to_migrate = [
        p for p in all_posts
        if p.get('post_type') in ['post', 'page']
        and p.get('title')  # Must have a title
    ]

    print(f"Found {len(posts_to_migrate)} posts/pages to migrate")

    # Create output directory
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    IMAGES_DIR.mkdir(parents=True, exist_ok=True)

    # Migrate each post
    migrated = 0
    errors = 0

    for post in posts_to_migrate:
        try:
            output_file = migrate_post(post, all_posts)
            if output_file:
                migrated += 1
        except Exception as e:
            print(f"  [ERROR] Failed to migrate: {e}")
            errors += 1

    # Summary
    print("\n" + "=" * 60)
    print("Migration Complete!")
    print("=" * 60)
    print(f"Migrated: {migrated} posts/pages")
    print(f"Errors: {errors}")
    print(f"Images downloaded: {len(downloaded_images)}")
    print(f"Output directory: {OUTPUT_DIR}")
    print(f"Images directory: {IMAGES_DIR}")


if __name__ == "__main__":
    main()
