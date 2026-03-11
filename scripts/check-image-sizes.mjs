#!/usr/bin/env node
import { readdir, readFile, stat } from "node:fs/promises";
import { join, extname, relative, resolve } from "node:path";
import sharp from "sharp";

const ROOT = new URL("..", import.meta.url).pathname;
const SRC_DIRS = ["src/components", "src/pages", "src/content", "src/layouts"];
const SRC_EXTS = new Set([".astro", ".mdoc", ".ts", ".tsx"]);
const IMAGE_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const MIN_WIDTH = 1200;

async function* walk(dir, exts) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path, exts);
    else if (exts.has(extname(entry.name).toLowerCase())) yield path;
  }
}

async function collectReferencedImages() {
  /** @type {Map<string, Set<string>>} image path -> set of source files */
  const refs = new Map();
  const patterns = [
    /featured_image\s*:\s*["']?([^"'\n]+\.(?:jpg|jpeg|png|webp))["']?/gi,
  ];

  for (const dir of SRC_DIRS) {
    for await (const filePath of walk(join(ROOT, dir), SRC_EXTS)) {
      const content = await readFile(filePath, "utf-8");
      const srcRelPath = relative(ROOT, filePath);
      for (const pattern of patterns) {
        pattern.lastIndex = 0;
        let match;
        while ((match = pattern.exec(content)) !== null) {
          let imgPath = match[1];
          if (imgPath.startsWith("../")) {
            imgPath = resolve(join(filePath, ".."), imgPath);
            imgPath = relative(ROOT, imgPath);
          } else if (imgPath.startsWith("/")) {
            imgPath = "src/assets" + imgPath;
          }
          imgPath = imgPath.replace(/^\//, "");
          if (IMAGE_EXTS.has(extname(imgPath).toLowerCase())) {
            if (!refs.has(imgPath)) refs.set(imgPath, new Set());
            refs.get(imgPath).add(srcRelPath);
          }
        }
      }
    }
  }
  return refs;
}

async function main() {
  const refs = await collectReferencedImages();
  const issues = [];

  for (const [imgRelPath, sources] of refs) {
    const fullPath = join(ROOT, imgRelPath);
    try {
      await stat(fullPath);
    } catch {
      continue;
    }
    try {
      const meta = await sharp(fullPath).metadata();
      if (meta.width && meta.width < MIN_WIDTH) {
        issues.push({
          file: imgRelPath,
          width: meta.width,
          height: meta.height,
          sources: [...sources],
        });
      }
    } catch {
      // skip unreadable
    }
  }

  if (issues.length === 0) {
    console.log(
      `✓ All ${refs.size} referenced images are at least ${MIN_WIDTH}px wide`,
    );
    return;
  }

  issues.sort((a, b) => a.width - b.width);

  console.log(
    `\n⚠ Found ${issues.length} referenced images below ${MIN_WIDTH}px width (of ${refs.size} total):\n`,
  );

  for (const { file, width, height, sources } of issues) {
    console.log(`  ${width}×${height}  ${file}`);
    for (const src of sources) {
      console.log(`           └─ ${src}`);
    }
  }

  console.log(`\nTotal: ${issues.length} images\n`);
}

main();
