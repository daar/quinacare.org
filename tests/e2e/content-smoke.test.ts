import { test, expect } from "@playwright/test";

// Smoke tests: verify that news articles render correctly on the live site.
// These run against the dev server (localhost:4321) and must pass both before
// and after the Keystatic content migration — guaranteeing the migration
// doesn't break anything visible to site visitors.

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function expectArticleLoads(
  page: import("@playwright/test").Page,
  url: string,
  expectedTitle: string,
) {
  const response = await page.goto(url);
  expect(response?.status(), `${url} should return 200`).toBe(200);

  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));

  await page.waitForLoadState("networkidle");

  // Title visible — first h1 on the page is the article heading
  // (subsequent h1s are VS Code devtools overlay elements in dev mode)
  await expect(page.locator("h1").first()).toContainText(expectedTitle);

  expect(errors, `JS errors on ${url}`).toHaveLength(0);
}

// ─── News articles (NL) ───────────────────────────────────────────────────────

test("nieuws overzichtspagina laadt", async ({ page }) => {
  const response = await page.goto("/actueel");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  // At least some article links present
  await expect(page.locator("article, [data-news]").first()).toBeVisible();
});

test("artikel zonder custom tags laadt", async ({ page }) => {
  await expectArticleLoads(
    page,
    "/actueel/nootdorp4life-sponsorrit",
    "Nootdorp4life",
  );
});

test("artikel met {% image %} tag laadt", async ({ page }) => {
  await expectArticleLoads(
    page,
    "/actueel/hospital-san-miguel-is-realiteit-geworden",
    "Hospital San Miguel",
  );
  // Image tag rendered — at least one img in article body
  await expect(page.locator("main img").first()).toBeVisible();
});

test("artikel met {% gallery %} tag laadt", async ({ page }) => {
  // Find an article with gallery tag
  await expectArticleLoads(page, "/actueel/andrea-diaz-saenz", "Andrea");
});

// ─── News articles (EN) ───────────────────────────────────────────────────────

test("EN news overview loads", async ({ page }) => {
  const response = await page.goto("/en/news");
  expect(response?.status()).toBe(200);
});

// ─── News articles (ES) ───────────────────────────────────────────────────────

test("ES noticias overview loads", async ({ page }) => {
  const response = await page.goto("/es/noticias");
  expect(response?.status()).toBe(200);
});

// ─── Homepage ─────────────────────────────────────────────────────────────────

test("homepage laadt zonder fouten", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));

  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await page.waitForLoadState("networkidle");
  expect(errors).toHaveLength(0);
});
