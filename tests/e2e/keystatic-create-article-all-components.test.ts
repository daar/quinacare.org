// Verify that the news component set appears in Keystatic and that one block,
// image upload, and wrapper can be saved to an .mdoc file. The render test
// covers every Markdoc component through a generated fixture.
import path from "node:path";
import { readdir, readFile, rm } from "node:fs/promises";
import { test, expect, type Page } from "@playwright/test";
import { newsContentComponents } from "../../src/lib/keystatic/content-components";

const TEST_IMAGE_PATH = path.resolve(
  "src/assets/media/2016/06/logo-01-gray.png",
);
const mediaRoot = path.resolve("src/assets/media");

// One representative per editor kind exercises a file upload, a plain block,
// and a wrapper with its own attributes dialog.
const REPRESENTATIVE_TAGS = ["image", "video", "image-row"] as const;

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// The insert-menu trigger is scoped to the editor root, since the page also
// has an unrelated "…" breadcrumb button with the same aria-haspopup="true".
async function openInsertMenu(page: Page): Promise<void> {
  const insertButton = page.locator(
    '[data-keystatic-editor="root"] button[aria-haspopup="true"]',
  );
  await insertButton.click();
  await expect(page.getByRole("menu")).toBeVisible();
}

// Selecting a component from the insert menu only inserts a placeholder
// node; its attributes dialog (if any — components with an empty schema
// have none) only opens after explicitly clicking that node's "Edit"
// button.
async function fillJustInsertedNode(page: Page, label: string): Promise<void> {
  const editor = page.getByRole("textbox", { name: "Inhoud" });
  const editButton = editor.getByRole("button", { name: "Edit" });
  const hasEditButton = await editButton
    .isVisible({ timeout: 1000 })
    .catch(() => false);
  if (!hasEditButton) return;

  await editButton.click();
  const dialog = page.getByRole("dialog", {
    name: new RegExp(`^Edit\\s+${escapeRegex(label)}$`),
  });
  await expect(dialog).toBeVisible();

  const textboxes = dialog.getByRole("textbox");
  const textboxCount = await textboxes.count();
  for (let i = 0; i < textboxCount; i += 1) {
    await textboxes.nth(i).fill(`e2e-${i + 1}`);
  }

  // Image fields open a native file-chooser (not a plain <input type=file>),
  // so they must be intercepted via the filechooser event.
  const chooseFileButton = dialog.getByRole("button", { name: "Choose file" });
  if ((await chooseFileButton.count()) > 0) {
    const fileChooserPromise = page.waitForEvent("filechooser");
    await chooseFileButton.click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(TEST_IMAGE_PATH);
    // Wait for the upload to be processed (the "Remove" button only shows
    // once the file is actually attached) before confirming the dialog.
    await expect(dialog.getByRole("button", { name: "Remove" })).toBeVisible();
  }

  await dialog.getByRole("button", { name: "Done" }).click();
  await expect(dialog).toBeHidden();
}

async function listFilesRecursive(dir: string): Promise<Set<string>> {
  const out = new Set<string>();
  async function walk(current: string): Promise<void> {
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) await walk(fullPath);
      else if (entry.isFile()) out.add(fullPath);
    }
  }
  await walk(dir);
  return out;
}

// The first visit to any /keystatic page in a dev-server session makes Vite
// discover and pre-bundle a large, previously-unused dependency graph
// (React, ProseMirror, …), which triggers one automatic full-page reload.
// If that lands mid-test elsewhere in the suite (e.g. right after this
// file's first real test starts typing), it silently wipes the in-progress
// form. Absorbing that one-time reload here, before any test that types
// into the editor, keeps the rest of this file deterministic regardless of
// what ran earlier in the suite.
test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage();
  await page.goto("/keystatic/collection/newsNl/create");
  await page.waitForLoadState("networkidle");
  await page.close();
});

test("insert menu lists every configured Markdoc content component", async ({
  page,
}) => {
  await page.goto("/keystatic/collection/newsNl/create");
  await openInsertMenu(page);

  const menuLabels = await page.getByRole("menuitem").allInnerTexts();
  const expectedLabels = Object.values(newsContentComponents)
    .map((component) => component.label)
    .sort();
  expect(menuLabels.sort()).toEqual(expectedLabels);
});

// Use a fresh article per component so editor focus cannot leak between cases.
for (const tag of REPRESENTATIVE_TAGS) {
  test(`editor inserts "${tag}" and saves it to the file`, async ({ page }) => {
    const label = newsContentComponents[tag].label;
    const unique = Date.now();
    const slug = `2026/e2e-editor-${tag}-${unique}`;
    const articlePath = path.resolve(`src/content/news/nl/${slug}.mdoc`);
    const uploadedBefore = await listFilesRecursive(mediaRoot);

    try {
      await page.goto("/keystatic/collection/newsNl/create");
      await page
        .getByRole("textbox", { name: "Titel" })
        .fill(`E2E editor test ${tag} ${unique}`);
      await page.getByRole("textbox", { name: "Map (jaar/slug)" }).fill(slug);
      await page
        .getByRole("textbox", { name: "Auteur" })
        .fill("Playwright E2E");
      await page
        .getByRole("textbox", { name: "Samenvatting" })
        .fill(`E2E test article inserting the "${tag}" component.`);

      const editor = page.getByRole("textbox", { name: "Inhoud" });
      await openInsertMenu(page);
      await page.getByRole("menuitem", { name: label, exact: true }).click();
      await fillJustInsertedNode(page, label);
      await expect(editor.getByText(label, { exact: true })).toBeVisible();
      await page.getByRole("textbox", { name: "Titel" }).click();

      await page.getByRole("button", { name: "Creëren" }).click();
      await expect(async () => {
        await readFile(articlePath, "utf8");
      }).toPass({ timeout: 15000 });

      const fileContent = await readFile(articlePath, "utf8");
      expect(fileContent).toContain(`{% ${tag}`);
    } finally {
      await rm(articlePath, { force: true });
      const uploadedAfter = await listFilesRecursive(mediaRoot);
      const uploadedFiles = [...uploadedAfter].filter(
        (filePath) => !uploadedBefore.has(filePath),
      );
      await Promise.allSettled(
        uploadedFiles.map((filePath) => rm(filePath, { force: true })),
      );
      await page.waitForTimeout(1500);
    }
  });
}
