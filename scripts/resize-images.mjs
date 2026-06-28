// Resize oversized raster images to a sensible web maximum so the Netlify
// build's Astro/Sharp image-optimization pass stays within memory.
//
// Why: Astro decodes every imported image in full to optimize it. A
// handful of 6000-9300px / 8-12 MB photos decode to 50-120 MB of raw
// RGBA *each*; processed in parallel they exhaust the build container's
// RAM and it gets OOM-killed (exit 137). Site layout caps at 1600px wide,
// so capping the long edge at 2560px (≈1.6x retina on the widest hero)
// cuts decode memory ~5-10x and shrinks the repo with no visible quality
// loss — and build-time optimization keeps working everywhere (unlike the
// Netlify image CDN, which 404s off-Netlify). See GH issue #39.
//
// Two modes:
//   * Hook mode  — given file paths (lint-staged passes the staged
//     images), resize each in place when it exceeds the cap. lint-staged
//     re-stages whatever changed. Files within the cap are left untouched.
//   * Bulk mode  — no file args: scan ROOT. Dry run by default; pass
//     --write to rewrite. Used once to fix images already in the repo.
//
// Usage:
//   node scripts/resize-images.mjs <file>...     # hook mode (writes in place)
//   node scripts/resize-images.mjs               # bulk dry run
//   node scripts/resize-images.mjs --write       # bulk, rewrite in place
//
// Env: MAX_EDGE (default 2560), ROOT (default src/assets, bulk only).

import sharp from "sharp";
import { readdirSync, statSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

// One image at a time, single libvips thread, no cache — so the resize
// pass itself never blows up on the giant inputs it is meant to tame.
sharp.concurrency(1);
sharp.cache(false);

const MAX_EDGE = Number(process.env.MAX_EDGE) || 2560;
const ROOT = process.env.ROOT || "src/assets";

const args = process.argv.slice(2);
const WRITE = args.includes("--write");
const fileArgs = args.filter((a) => !a.startsWith("--"));
const HOOK = fileArgs.length > 0;

const JPEG = { quality: 82, mozjpeg: true };
const WEBP = { quality: 82 };
const PNG = { compressionLevel: 9 };

function walk(dir) {
  let out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out = out.concat(walk(p));
    else if (/\.(jpe?g|png|webp)$/i.test(e.name)) out.push(p);
  }
  return out;
}

// Resize `file` in place when its long edge exceeds MAX_EDGE. Returns the
// bytes saved (0 if untouched). `apply` actually writes; otherwise dry run.
async function process_(file, apply) {
  if (!existsSync(file) || !/\.(jpe?g|png|webp)$/i.test(file)) return 0;
  let meta;
  try {
    meta = await sharp(file).metadata();
  } catch (err) {
    console.warn(`skip (unreadable): ${file} — ${err.message}`);
    return 0;
  }
  const longest = Math.max(meta.width || 0, meta.height || 0);
  if (longest <= MAX_EDGE) return 0;

  const sizeBefore = statSync(file).size;
  const ext = file.toLowerCase().split(".").pop();
  // .rotate() bakes EXIF orientation into the pixels (and drops the tag)
  // so the resized output displays correctly everywhere.
  let pipeline = sharp(file).rotate().resize({
    width: MAX_EDGE,
    height: MAX_EDGE,
    fit: "inside",
    withoutEnlargement: true,
  });
  if (ext === "png") pipeline = pipeline.png(PNG);
  else if (ext === "webp") pipeline = pipeline.webp(WEBP);
  else pipeline = pipeline.jpeg(JPEG);

  const buf = await pipeline.toBuffer();
  // Never replace a file with a larger one (re-encode can inflate an
  // already-optimized input).
  if (buf.length >= sizeBefore) {
    console.log(`kept     ${file}  (re-encode not smaller)`);
    return 0;
  }
  const note = `${longest}px ${(sizeBefore / 1048576).toFixed(1)}MB -> ${MAX_EDGE}px ${(buf.length / 1048576).toFixed(1)}MB`;
  if (apply) {
    writeFileSync(file, buf);
    console.log(`resized  ${file}  (${note})`);
  } else {
    console.log(`would resize  ${file}  (${note})`);
  }
  return sizeBefore - buf.length;
}

const targets = HOOK ? fileArgs : walk(ROOT);
const apply = HOOK || WRITE; // hook always writes; bulk needs --write
let saved = 0;
let changed = 0;
for (const file of targets) {
  const s = await process_(file, apply);
  if (s > 0) {
    saved += s;
    changed++;
  }
}

if (HOOK) {
  if (changed) console.log(`Resized ${changed} staged image(s) to <=${MAX_EDGE}px.`);
} else {
  console.log(
    `\n${apply ? "Rewrote" : "Would rewrite"} ${changed} image(s) over ${MAX_EDGE}px. Saved ~${(saved / 1048576).toFixed(0)} MB.`,
  );
  if (!apply) console.log("Dry run — re-run with --write to apply.");
}
