WordPress to Astro Migration Plan (Python)

Overview

Migrate WordPress content to Astro Markdoc using Python, based on parser.py (wpparser  
 approach).

Requirements Summary

1. All post statuses (draft, publish, private, etc.)
2. Pages + Posts → Posts (unified as blog posts)
3. Custom Image component with caption, width, height, alignment
4. Download images to src/assets/images/raw/
5. Strip shortcodes and clean HTML

---

Script Structure

temp/  
 ├── migrate.py # Main migration script  
 ├── parser.py # Reference (wpparser usage)  
 └── quinacare.WordPress.2024-04-14.xml

src/  
 ├── assets/  
 │ └── images/  
 │ └── raw/ # Downloaded original images  
 ├── content/  
 │ └── blog/  
 │ └── \*.mdoc # Generated Markdoc files  
 └── components/  
 └── WpImage.astro # Custom image component

---

Migration Script Modules

1. XML Parsing (using wpparser)

# Extract all items regardless of status

# Filter: post_type in ['post', 'page']

# Include: draft, publish, pending, private, etc.

2. Content Processing

- Strip WordPress shortcodes: [gallery ...], [caption ...], [vc_* ...], etc.
- Convert HTML → Markdown (using markdownify or html2text)
- Replace <img> tags with {% image %} Markdoc tags
- Clean up inline styles/HTML artifacts

3. Image Handling

- Parse <img> tags and [gallery] shortcodes for image URLs
- Download images from quinacare.org/wp-content/uploads/...
- Save to src/assets/images/raw/ preserving directory structure
- Extract: src, width, height, alt (for caption), alignment (from CSS classes)
- Generate Markdoc image tag: {% image src="..." width=X height=Y caption="..."
  align="left|right|center" %}

4. Frontmatter Generation

---

title: "Post Title"  
 date: 2024-01-15  
 status: draft|publish|private  
 slug: post-slug  
 author: "Author Name"  
 excerpt: "Post excerpt..."  
 categories: ["Category1", "Category2"]  
 language: "en"|"nl"|"es"  
 featured_image: "/images/raw/2024/01/image.jpg"

---

5. File Output

- Filename: {slug}.mdoc
- Location: src/content/blog/

---

Key Libraries (Python)  
 ┌────────────────┬────────────────────────────┐  
 │ Library │ Purpose │  
 ├────────────────┼────────────────────────────┤  
 │ wpparser │ Parse WordPress XML export │  
 ├────────────────┼────────────────────────────┤  
 │ markdownify │ Convert HTML to Markdown │  
 ├────────────────┼────────────────────────────┤  
 │ requests │ Download images │  
 ├────────────────┼────────────────────────────┤  
 │ re │ Shortcode stripping regex │  
 ├────────────────┼────────────────────────────┤  
 │ pathlib │ File/directory handling │  
 ├────────────────┼────────────────────────────┤  
 │ PIL (optional) │ Image dimension extraction │  
 └────────────────┴────────────────────────────┘

---

Shortcodes to Strip/Convert  
 ┌───────────────────────────────────┬───────────────────────────────────────┐  
 │ Shortcode │ Action │  
 ├───────────────────────────────────┼───────────────────────────────────────┤  
 │ [gallery ids="..." columns="..."] │ Convert to multiple {% image %} tags │  
 ├───────────────────────────────────┼───────────────────────────────────────┤  
 │ [caption]...[/caption] │ Extract image + caption → {% image %} │  
 ├───────────────────────────────────┼───────────────────────────────────────┤  
 │ [vc_*]...[/vc_*] │ Strip (Visual Composer) │  
 ├───────────────────────────────────┼───────────────────────────────────────┤  
 │ [et_*]...[/et_*] │ Strip (Divi) │  
 ├───────────────────────────────────┼───────────────────────────────────────┤  
 │ [tbdonations_*] │ Strip │  
 ├───────────────────────────────────┼───────────────────────────────────────┤  
 │ Other shortcodes │ Strip brackets, keep inner text │  
 └───────────────────────────────────┴───────────────────────────────────────┘

---

WpImage.astro Component (for reference)

The Python script will output tags like:  
 {% image src="/images/raw/2024/01/photo.jpg" width=800 height=600 caption="A beautiful
  scene" align="center" %}

The Astro component will:

- Use Astro's <Image> for WebP conversion
- Render caption as <figcaption>
- Apply alignment CSS classes
