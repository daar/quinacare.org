// Generate/remove a single gitignored E2E fixture article that inserts
// every Markdoc content component defined in
// src/lib/keystatic/content-components.ts, so tests/e2e can assert against
// how each one actually renders on a public page — without touching real
// content or requiring a full `astro build` (Astro's content-collection
// glob loader picks up new files under a running dev server immediately).
//
// The completeness check below fails loudly the moment someone adds a new
// component to content-components.ts without adding fixture markup here,
// so the render test can never silently skip a component.
//
// Usage:
//   node --experimental-strip-types scripts/e2e-fixture.mjs --write
//   node --experimental-strip-types scripts/e2e-fixture.mjs --remove
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { contentComponents } from "../src/lib/keystatic/content-components.ts";

export const FIXTURE_SLUG = "e2e-components-fixture";
export const FIXTURE_PATH = path.resolve(
  `src/content/news/nl/2026/${FIXTURE_SLUG}.mdoc`,
);

// A distinctive, greppable string per component that has a human-visible
// text field. `null` for components with no visible text field, where the
// render test falls back to a structural selector instead.
export const TOKENS = {
  image: "E2E-FIXTURE:image-caption",
  "image-row": null,
  gallery: null,
  "gallery-image": null,
  video: null,
  streetview: "E2E-FIXTURE:streetview-label",
  download: "E2E-FIXTURE:download-label",
  "csv-download": "E2E-FIXTURE:csv-download-label",
  "download-card": "E2E-FIXTURE:download-card-title",
  "report-card": null,
  "annual-reports": null,
  section: "E2E-FIXTURE:section-title",
  "hero-banner": "E2E-FIXTURE:hero-banner-title",
  "cta-banner": "E2E-FIXTURE:cta-banner-title",
  "feature-card": "E2E-FIXTURE:feature-card-title",
  "quote-block": "E2E-FIXTURE:quote-block-name",
  "profile-section": "E2E-FIXTURE:profile-section-name",
  "team-grid": null,
  "team-member": "E2E-FIXTURE:team-member-name",
  "partner-grid": null,
  "tier-grid": null,
  "tier-card": "E2E-FIXTURE:tier-card-title",
  "yura-tiers": null,
  "contact-cards": null,
  "foundation-details": null,
  "contact-form": null,
  comment: "E2E-FIXTURE:comment-hidden-content",
};

// Realistic, already-existing repo assets — no placeholders, so the render
// test exercises the same code paths real content does.
const MEDIA = {
  logo1: "/media/2016/06/logo-01-gray.png",
  logo2: "/media/2016/06/logo-02-gray.png",
  logo3: "/media/2016/06/logo-03-gray.png",
  logo4: "/media/2016/06/logo-04-gray.png",
  logo5: "/media/2016/06/logo-05-gray.png",
  teamPhoto: "/media/2017/06/cootje-circular-xs.jpg",
  heroBg: "/media/2017/10/As-Far-As-Possible.jpg",
  newsletterCover: "/media/2018/01/nieuwsbrief-2018-01-en.jpg",
};
const VIDEO_SRC = "/video/2017/11/zo-ver-mogelijk.webm";
const VIDEO_POSTER = "/media/2017/10/As-Far-As-Possible.jpg";
const STREETVIEW_SRC =
  "https://www.google.com/maps/embed?pb=!4v1571446082724!6m8!1m7!1sCAoSK0FGMVFpcE5qZWZIVWFZNkhDdjViNm8wa3VCTHlyVFVXaE5zOXJFbGRkYWM.!2m2!1d0.11651299999999999!2d-75.86582659999999!3f24!4f0!5f0.7820865974627469";
const ANNUAL_REPORT_YEAR = 2025; // present in src/data/annualReports.ts with an "nl" file

// Markdoc source per component, in insertion order. Every entry uses
// attributes/children matching that component's real schema.
const TAG_MARKDOC = {
  image: `{% image src="${MEDIA.logo1}" alt="E2E logo" align="center" caption="${TOKENS.image}" /%}`,
  "image-row": `{% image-row cols=2 %}
{% image src="${MEDIA.logo2}" alt="E2E logo 2" align="center" /%}
{% image src="${MEDIA.logo3}" alt="E2E logo 3" align="center" /%}
{% /image-row %}`,
  gallery: `{% gallery ariaLabel="E2E gallery" %}
{% gallery-image src="${MEDIA.logo4}" alt="E2E gallery image 1" /%}
{% gallery-image src="${MEDIA.logo5}" alt="E2E gallery image 2" /%}
{% /gallery %}`,
  // gallery-image only ever appears as a gallery child, covered above.
  "gallery-image": "",
  video: `{% video src="${VIDEO_SRC}" poster="${VIDEO_POSTER}" /%}`,
  streetview: `{% streetview src="${STREETVIEW_SRC}" label="${TOKENS.streetview}" /%}`,
  download: `{% download href="/nl/jaarverslagen/Jaarverslag-Quina-Care-2025.pdf" label="${TOKENS.download}" /%}`,
  "csv-download": `{% csv-download href="/downloads/ziekenhuisapparatuur.csv" label="${TOKENS["csv-download"]}" /%}`,
  "download-card": `{% download-card href="/nl/nieuwsbrieven/Quina-Care-nieuwsbrief-Juli-2025.pdf" label="Nieuwsbrief" title="${TOKENS["download-card"]}" lang="nl" cover="${MEDIA.newsletterCover}" /%}`,
  "report-card": `{% report-card year=${ANNUAL_REPORT_YEAR} lang="nl" /%}`,
  "annual-reports": `{% annual-reports lang="nl" /%}`,
  section: `{% section label="E2E section" title="${TOKENS.section}" subtitle="E2E section subtitle" background="gray" %}
E2E section body text.
{% /section %}`,
  "hero-banner": `{% hero-banner background="${MEDIA.heroBg}" label="E2E hero" title="${TOKENS["hero-banner"]}" subtitle="E2E hero subtitle" /%}`,
  "cta-banner": `{% cta-banner title="${TOKENS["cta-banner"]}" subtitle="E2E cta subtitle" cta="E2E cta button" href="/doneer" /%}`,
  "feature-card": `{% feature-card title="${TOKENS["feature-card"]}" icon="heart" href="/doneer" /%}`,
  "quote-block": `{% quote-block quote="E2E quote text" name="${TOKENS["quote-block"]}" role="E2E role" image="${MEDIA.teamPhoto}" /%}`,
  "profile-section": `{% profile-section image="${MEDIA.teamPhoto}" name="${TOKENS["profile-section"]}" role="E2E role" quote="E2E profile quote" %}
E2E profile section body text.
{% /profile-section %}`,
  "team-grid": `{% team-grid cols=2 %}
{% team-member image="${MEDIA.teamPhoto}" name="${TOKENS["team-member"]}" role="E2E role" email="e2e@example.com" %}
E2E team member bio text.
{% /team-member %}
{% /team-grid %}`,
  // team-member only ever appears as a team-grid child, covered above.
  "team-member": "",
  "partner-grid": `{% partner-grid type="partners" /%}`,
  "tier-grid": `{% tier-grid %}
{% yura-tiers /%}
{% /tier-grid %}`,
  "tier-card": `{% tier-card image="${MEDIA.logo1}" title="${TOKENS["tier-card"]}" price="€10" frequency="/maand" impact="E2E impact" yearly="€120/jaar" href="/donate?amount=10" featured=false /%}`,
  // yura-tiers only ever appears inside tier-grid, covered above.
  "yura-tiers": "",
  "contact-cards": `{% contact-cards variant="social" /%}`,
  "foundation-details": `{% foundation-details /%}`,
  "contact-form": `{% contact-form /%}`,
  comment: `{% comment %}
${TOKENS.comment} — this must never render on the public page.
{% /comment %}`,
};

function assertCompleteness() {
  const missing = Object.keys(contentComponents).filter(
    (tag) => !(tag in TAG_MARKDOC),
  );
  if (missing.length > 0) {
    throw new Error(
      `e2e-fixture.mjs is missing markdoc fixture data for: ${missing.join(", ")}. ` +
        "Add an entry to TAG_MARKDOC (and TOKENS) in scripts/e2e-fixture.mjs.",
    );
  }
}

// Tags that are only ever inserted as children of another tag above (so an
// empty TAG_MARKDOC entry is intentional, not a gap).
const CHILD_ONLY_TAGS = new Set(["gallery-image", "team-member", "yura-tiers"]);

function buildBody() {
  const blocks = Object.entries(TAG_MARKDOC)
    .filter(([tag, markdoc]) => markdoc || !CHILD_ONLY_TAGS.has(tag))
    .map(([, markdoc]) => markdoc);
  return `E2E fixture root paragraph.\n\n${blocks.join("\n\n")}\n`;
}

function buildFrontmatter() {
  return `---
title: "E2E components fixture"
date: 2026-01-01
status: publish
slug: "${FIXTURE_SLUG}"
author: "Playwright"
excerpt: "Auto-generated fixture inserting every Markdoc content component. Never commit this file."
language: "nl"
---

`;
}

export async function writeFixture() {
  assertCompleteness();
  await mkdir(path.dirname(FIXTURE_PATH), { recursive: true });
  await writeFile(FIXTURE_PATH, buildFrontmatter() + buildBody());
}

export async function removeFixture() {
  await rm(FIXTURE_PATH, { force: true });
}

async function main() {
  if (process.argv.includes("--write")) {
    await writeFixture();
    console.log(`Wrote ${FIXTURE_PATH}`);
  } else if (process.argv.includes("--remove")) {
    await removeFixture();
    console.log(`Removed ${FIXTURE_PATH}`);
  } else {
    console.error("Usage: node scripts/e2e-fixture.mjs --write | --remove");
    process.exit(1);
  }
}

// Only run when executed directly (not when imported by the render test).
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
