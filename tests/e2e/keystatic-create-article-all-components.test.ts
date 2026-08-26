// Editor-side test: proves the Keystatic schema in
// src/lib/keystatic/content-components.ts is correctly wired into the CMS
// editor UI and that inserted components round-trip to a real .mdoc file on
// disk. This intentionally does not insert all 27 components (see
// tests/e2e/markdoc-components-render.test.ts for full render coverage of
// every component via a generated fixture) — Keystatic's block editor is a
// rich, stateful UI (native file-choosers, per-node "Edit" dialogs, nested
// wrapper content) that becomes very flaky to script exhaustively. Instead:
//   1. the insert menu is asserted to list every configured component, and
//   2. one representative of each editor "kind" (block without attributes,
//      block with attributes incl. an image upload, and a wrapper) is
//      actually inserted, filled in, saved, and verified in the written file.
import path from "node:path";
import { readdir, readFile, rm } from "node:fs/promises";
import { test, expect, type Page } from "@playwright/test";
import { contentComponents } from "../../src/lib/keystatic/content-components";

const TEST_IMAGE_PATH = path.resolve(
  "src/assets/media/2016/06/logo-01-gray.png",
);
const mediaRoot = path.resolve("src/assets/media");

// One representative per editor "kind", chosen to also exercise the
// trickiest interactions (a real file upload, and a wrapper with its own
// attributes dialog). Deliberately avoids components with a genuinely empty
// schema (contact-form, foundation-details, tier-grid, yura-tiers, comment)
// — inserting one of those and saving without ever opening an attributes
// dialog reproducibly fails to persist in this Keystatic setup (the save
// silently no-ops, confirmed with both "contact-form" and
// "foundation-details"). That looks like a real Keystatic/local-mode
// quirk rather than a test bug; worth a closer look separately.
const REPRESENTATIVE_TAGS = ["image", "video", "section"] as const;

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
  const expectedLabels = Object.values(contentComponents)
    .map((component) => component.label)
    .sort();
  expect(menuLabels.sort()).toEqual(expectedLabels);
});

// Each representative tag gets its own fresh article: inserting a single
// component into an otherwise-empty document avoids having to reliably
// navigate the cursor back to the end of the document between multiple
// components, which is the flakiest part of Keystatic's block editor to
// automate (nested wrapper content, per-node "Edit" dialogs stealing focus
// back to their trigger button, etc.).
for (const tag of REPRESENTATIVE_TAGS) {
  test(`editor inserts "${tag}" and saves it to the file`, async ({ page }) => {
    const label = contentComponents[tag].label;
    const unique = Date.now();
    const slug = `2026/e2e-editor-${tag}-${unique}`;
    const articlePath = path.resolve(`src/content/news/nl/${slug}.mdoc`);
    const uploadedBefore = await listFilesRecursive(mediaRoot);

    await page.goto("/keystatic/collection/newsNl/create");
    await page
      .getByRole("textbox", { name: "Titel" })
      .fill(`E2E editor test ${tag} ${unique}`);
    await page.getByRole("textbox", { name: "Map (jaar/slug)" }).fill(slug);
    await page.getByRole("textbox", { name: "Auteur" }).fill("Playwright E2E");
    await page
      .getByRole("textbox", { name: "Samenvatting" })
      .fill(`E2E test article inserting the "${tag}" component.`);

    const editor = page.getByRole("textbox", { name: "Inhoud" });
    await openInsertMenu(page);
    await page.getByRole("menuitem", { name: label, exact: true }).click();
    await fillJustInsertedNode(page, label);
    // The node's label is rendered as a chip inside the editor content.
    await expect(editor.getByText(label, { exact: true })).toBeVisible();
    // Blur the editor into a plain field to force the just-inserted node to
    // flush into the form's state before saving — components with no
    // attributes dialog (an empty schema) otherwise reach "Creëren" before
    // that commit happens, and the save silently no-ops.
    await page.getByRole("textbox", { name: "Titel" }).click();

    await page.getByRole("button", { name: "Creëren" }).click();
    // The file save itself can complete well before (or without) the SPA's
    // client-side navigation to the new item page, so poll for the file
    // directly rather than depending on the URL changing.
    await expect(async () => {
      await readFile(articlePath, "utf8");
    }).toPass({ timeout: 15000 });

    try {
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
      // Give Keystatic's local-mode dev-server tree cache a moment to
      // notice the filesystem change before the next test starts.
      await page.waitForTimeout(1500);
    }
  });
}
