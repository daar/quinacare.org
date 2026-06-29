// Minify the PDFs under public/ (all language folders).
//
// Two modes:
//   * default (lossless) — qpdf recompresses content streams at max deflate
//     and packs compressed object streams. Image data is untouched, so
//     quality is identical; only structural overhead is removed (~0.5-10%).
//   * --lossy — Ghostscript downsamples embedded images to one STANDARD
//     quality for every PDF (default 150 DPI, JPEG q85: a screen-friendly
//     balance), which is what shrinks the image-heavy reports/newsletters
//     dramatically (e.g. a 12 MB flyer → a few hundred KB).
//
// Safety: every output's page count is verified against the input, and a
// file is only replaced when the result is actually smaller.
//
// Usage:
//   node scripts/minify-pdfs.mjs                      # dry run, lossless
//   node scripts/minify-pdfs.mjs --write              # apply lossless in place
//   node scripts/minify-pdfs.mjs --lossy              # dry run, standard 150dpi/q85
//   node scripts/minify-pdfs.mjs --lossy --write      # apply standard quality
//   node scripts/minify-pdfs.mjs --lossy --dpi 200 --quality 90 --write
//   node scripts/minify-pdfs.mjs [--lossy] <file>...  # specific PDFs (writes)
//
// Env: ROOT (default public) — folder scanned when no files are given.

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, statSync, copyFileSync, rmSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, basename } from "node:path";

const ROOT = process.env.ROOT || "public";
const argv = process.argv.slice(2);

function flagValue(name, fallback) {
  const i = argv.indexOf(name);
  return i !== -1 && argv[i + 1] ? argv[i + 1] : fallback;
}

const WRITE = argv.includes("--write");
const LOSSY = argv.includes("--lossy");
// Standard quality applied uniformly to every PDF in --lossy mode.
const DPI = parseInt(flagValue("--dpi", "150"), 10);
const QUALITY = parseInt(flagValue("--quality", "85"), 10);
const flagsWithValue = new Set(["--dpi", "--quality"]);
const fileArgs = argv.filter(
  (a, i) => !a.startsWith("--") && !(i > 0 && flagsWithValue.has(argv[i - 1])),
);
const HOOK = fileArgs.length > 0; // explicit files → always write

function have(cmd) {
  try {
    execFileSync(cmd, ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

if (!have("qpdf")) {
  console.error(
    "error: qpdf is not installed. Install it (e.g. `apt install qpdf` / `brew install qpdf`) and re-run.",
  );
  process.exit(1);
}
if (LOSSY && !have("gs")) {
  console.error(
    "error: --lossy needs Ghostscript (gs). Install it (e.g. `apt install ghostscript`) and re-run.",
  );
  process.exit(1);
}

function walk(dir) {
  let out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out = out.concat(walk(p));
    else if (/\.pdf$/i.test(e.name)) out.push(p);
  }
  return out;
}

function nPages(file) {
  try {
    return parseInt(execFileSync("qpdf", ["--show-npages", file], { encoding: "utf8" }).trim(), 10);
  } catch {
    return NaN;
  }
}

// Run qpdf; treat exit code 3 (warnings) as success as long as output exists.
function qpdfMinify(src, dst) {
  try {
    execFileSync(
      "qpdf",
      [
        "--object-streams=generate",
        "--recompress-flate",
        "--compression-level=9",
        src,
        dst,
      ],
      { stdio: ["ignore", "ignore", "pipe"] },
    );
  } catch (err) {
    if (err.status !== 3) throw err; // 3 = completed with warnings
  }
  return existsSync(dst);
}

// Lossy: downsample every embedded image to the standard DPI and re-encode
// JPEG at QUALITY, uniformly for all PDFs. Mono (1-bit) images keep more
// resolution since text/line art needs it. Thresholds at 1.0 mean "only
// downsample images already above the target", never upsample.
function gsCompress(src, dst) {
  execFileSync(
    "gs",
    [
      "-q",
      "-dNOPAUSE",
      "-dBATCH",
      "-dSAFER",
      "-sDEVICE=pdfwrite",
      "-dCompatibilityLevel=1.5",
      "-dDetectDuplicateImages=true",
      "-dDownsampleColorImages=true",
      "-dColorImageDownsampleType=/Bicubic",
      `-dColorImageResolution=${DPI}`,
      "-dDownsampleGrayImages=true",
      "-dGrayImageDownsampleType=/Bicubic",
      `-dGrayImageResolution=${DPI}`,
      "-dDownsampleMonoImages=true",
      "-dMonoImageDownsampleType=/Subsample",
      `-dMonoImageResolution=${Math.max(DPI * 2, 300)}`,
      "-dColorImageDownsampleThreshold=1.0",
      "-dGrayImageDownsampleThreshold=1.0",
      "-dAutoFilterColorImages=false",
      "-dColorImageFilter=/DCTEncode",
      "-dAutoFilterGrayImages=false",
      "-dGrayImageFilter=/DCTEncode",
      `-dJPEGQ=${QUALITY}`,
      `-sOutputFile=${dst}`,
      src,
    ],
    { stdio: ["ignore", "ignore", "pipe"] },
  );
  return existsSync(dst);
}

const compress = LOSSY ? gsCompress : qpdfMinify;
const modeLabel = LOSSY ? `lossy ${DPI}dpi/q${QUALITY}` : "lossless";

const targets = HOOK ? fileArgs.filter((f) => /\.pdf$/i.test(f) && existsSync(f)) : walk(ROOT);
const apply = HOOK || WRITE;
const tmp = mkdtempSync(join(tmpdir(), "pdfmin-"));

let before = 0;
let after = 0;
let changed = 0;
let skipped = 0;

for (const file of targets) {
  const sizeBefore = statSync(file).size;
  before += sizeBefore;
  const dst = join(tmp, basename(file));
  let ok = false;
  try {
    ok = compress(file, dst);
  } catch (err) {
    console.warn(`skip (${LOSSY ? "gs" : "qpdf"} failed): ${file} — ${err.message.split("\n")[0]}`);
    after += sizeBefore;
    skipped++;
    continue;
  }
  if (!ok) {
    console.warn(`skip (no output): ${file}`);
    after += sizeBefore;
    skipped++;
    continue;
  }
  // Integrity guard: page count must be unchanged.
  const pa = nPages(file);
  const pb = nPages(dst);
  if (!Number.isNaN(pa) && pa !== pb) {
    console.warn(`skip (page count ${pa}->${pb}): ${file}`);
    rmSync(dst, { force: true });
    after += sizeBefore;
    skipped++;
    continue;
  }
  const sizeAfter = statSync(dst).size;
  if (sizeAfter >= sizeBefore) {
    rmSync(dst, { force: true });
    after += sizeBefore;
    continue; // already optimal — leave untouched
  }
  const pct = ((1 - sizeAfter / sizeBefore) * 100).toFixed(1);
  const note = `${(sizeBefore / 1024).toFixed(0)}KB -> ${(sizeAfter / 1024).toFixed(0)}KB (-${pct}%)`;
  changed++;
  after += sizeAfter;
  if (apply) {
    // copy (not rename) — the temp dir may be on a different filesystem
    copyFileSync(dst, file);
    rmSync(dst, { force: true });
    console.log(`minified  ${file}  (${note})`);
  } else {
    rmSync(dst, { force: true });
    console.log(`would minify  ${file}  (${note})`);
  }
}

rmSync(tmp, { recursive: true, force: true });

const savedMB = (before - after) / 1048576;
console.log(
  `\n[${modeLabel}] ${apply ? "Minified" : "Would minify"} ${changed}/${targets.length} PDF(s)` +
    (skipped ? `, ${skipped} skipped` : "") +
    `. ${before > 0 ? ((1 - after / before) * 100).toFixed(1) : 0}% smaller overall (~${savedMB.toFixed(1)} MB).`,
);
if (!apply) console.log("Dry run — re-run with --write to apply.");
