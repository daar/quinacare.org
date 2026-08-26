import { test, expect, type Page } from "@playwright/test";
import { contentComponents } from "../../src/lib/keystatic/content-components";
import { partners } from "../../src/data/partners";
import {
  FIXTURE_SLUG,
  TOKENS,
  writeFixture,
  removeFixture,
  // Fixture generator is a .mjs file with a .ts import, run through the
  // same TS-aware loader Playwright uses for this test file.
} from "../../scripts/e2e-fixture.mjs";

// One assertion per Markdoc content component, run against the single
// fixture page load below. Prefer a visible-text token where the component
// renders one; fall back to a content-based structural locator (ids,
// aria-labels, real data values) — never a Tailwind utility class, which
// breaks on every restyle.
const checks: Record<string, (page: Page) => Promise<void>> = {
  image: async (page) => {
    await expect(page.getByText(TOKENS.image!).first()).toBeVisible();
  },
  "image-row": async (page) => {
    await expect(page.locator(".qc-img-row").first()).toBeVisible();
  },
  gallery: async (page) => {
    await expect(page.locator(".qc-gallery").first()).toBeVisible();
  },
  "gallery-image": async (page) => {
    await expect(page.locator(".qc-gallery__slide")).toHaveCount(2);
  },
  video: async (page) => {
    await expect(page.locator("video").first()).toBeVisible();
  },
  streetview: async (page) => {
    await expect(
      page.locator(`.qc-streetview iframe[title="${TOKENS.streetview}"]`),
    ).toBeVisible();
  },
  download: async (page) => {
    await expect(page.getByText(TOKENS.download!).first()).toBeVisible();
  },
  "csv-download": async (page) => {
    await expect(page.getByText(TOKENS["csv-download"]!).first()).toBeVisible();
  },
  "download-card": async (page) => {
    await expect(
      page.getByText(TOKENS["download-card"]!).first(),
    ).toBeVisible();
  },
  "report-card": async (page) => {
    await expect(
      page.locator('a[aria-label*="Jaarverslag 2025"]').first(),
    ).toBeVisible();
  },
  "annual-reports": async (page) => {
    // year=2024 only ever comes from the overview grid, not the standalone
    // report-card fixture instance (which is pinned to 2025), so this
    // uniquely proves the overview rendered its own list of reports.
    await expect(
      page.locator('a[aria-label*="Jaarverslag 2024"]').first(),
    ).toBeVisible();
  },
  section: async (page) => {
    await expect(page.getByText(TOKENS.section!).first()).toBeVisible();
  },
  "hero-banner": async (page) => {
    await expect(page.getByText(TOKENS["hero-banner"]!).first()).toBeVisible();
  },
  "cta-banner": async (page) => {
    await expect(page.getByText(TOKENS["cta-banner"]!).first()).toBeVisible();
  },
  "feature-card": async (page) => {
    await expect(page.getByText(TOKENS["feature-card"]!).first()).toBeVisible();
  },
  "quote-block": async (page) => {
    await expect(page.getByText(TOKENS["quote-block"]!).first()).toBeVisible();
  },
  "profile-section": async (page) => {
    await expect(
      page.getByText(TOKENS["profile-section"]!).first(),
    ).toBeVisible();
  },
  // team-grid has no stable non-utility hook of its own; its only job is to
  // lay out team-member children, so a rendered team-member proves it wraps.
  "team-grid": async (page) => {
    await expect(page.getByText(TOKENS["team-member"]!).first()).toBeVisible();
  },
  "team-member": async (page) => {
    await expect(page.getByText(TOKENS["team-member"]!).first()).toBeVisible();
  },
  "partner-grid": async (page) => {
    // Partners also render (as marquee clones) in the global site footer,
    // so scope to the article body to match only our inserted instance.
    // The logo is lazy-loaded and reports a zero-size box until scrolled
    // into view, so bring it into view before asserting visibility.
    const logo = page.locator("article").getByAltText(partners[0].name).first();
    await logo.scrollIntoViewIfNeeded();
    await expect(logo).toBeVisible();
  },
  // tier-grid, likewise, only lays out yura-tiers — proven by the
  // [data-tier] check below.
  "tier-grid": async (page) => {
    await expect(page.locator("[data-tier]").first()).toBeVisible();
  },
  "tier-card": async (page) => {
    await expect(page.getByText(TOKENS["tier-card"]!).first()).toBeVisible();
  },
  "yura-tiers": async (page) => {
    await expect(page.locator("[data-tier]").first()).toBeVisible();
  },
  "contact-cards": async (page) => {
    // Facebook also appears in the nav banner and footer, so scope to the
    // article body to match only our inserted instance.
    await expect(
      page.locator('article [aria-label="Facebook"]').first(),
    ).toBeVisible();
  },
  "foundation-details": async (page) => {
    await expect(
      page.getByText("RSIN", { exact: false }).first(),
    ).toBeVisible();
  },
  "contact-form": async (page) => {
    await expect(page.locator("form#contact-form")).toBeVisible();
  },
  // comment content must never reach the rendered page.
  comment: async (page) => {
    await expect(page.getByText(TOKENS.comment!)).toHaveCount(0);
  },
};

test.beforeAll(async () => {
  const missing = Object.keys(contentComponents).filter(
    (tag) => !(tag in checks),
  );
  expect(
    missing,
    `No render assertion configured for: ${missing.join(", ")}. Add an entry to "checks" in this test.`,
  ).toEqual([]);
  await writeFixture();
});

test.afterAll(async () => {
  await removeFixture();
});

test("every Markdoc content component renders on the public page", async ({
  page,
}) => {
  // Astro's content-collection loader picks up the just-written fixture
  // file almost immediately, but not always in time for the very first
  // request — especially right after other tests generated heavy file
  // churn on the same dev server. Retry the navigation rather than the
  // heading assertion, since a 404 needs a fresh request, not a re-check.
  await expect(async () => {
    const response = await page.goto(`/actueel/${FIXTURE_SLUG}`);
    expect(response?.status()).toBe(200);
  }).toPass({ timeout: 10000 });

  // The fixture's own hero-banner component renders a second <h1> further
  // down the article — real (if debatable) component behavior, not a test
  // bug — so scope to the page's own title heading.
  await expect(page.getByRole("heading", { level: 1 }).first()).toContainText(
    "E2E components fixture",
  );

  for (const [tag, check] of Object.entries(checks)) {
    await test.step(tag, () => check(page));
  }
});
