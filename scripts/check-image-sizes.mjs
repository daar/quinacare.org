#!/usr/bin/env node
/**
 * Report content images that are too small to render sharply.
 *
 * Collects every image referenced from the source tree — the
 * `featured_image` frontmatter key plus the `src`, `image` and `poster`
 * attributes on Markdoc tags — resolves each reference to a file on
 * disk, and measures it. Anything narrower than the minimum is a
 * candidate for replacement with a higher-resolution original.
 *
 * Deterministic and read-only: it measures files and prints a report.
 * Creating or updating the GitHub issue is left to the caller
 * (.github/workflows/image-quality.yml), so this stays runnable and
 * reviewable on its own.
 *
 * Usage:
 *   node scripts/check-image-sizes.mjs                  # human report
 *   node scripts/check-image-sizes.mjs --scope content  # only src/content
 *   node scripts/check-image-sizes.mjs --json
 *   node scripts/check-image-sizes.mjs --markdown       # GitHub issue body
 *   node scripts/check-image-sizes.mjs --min-width 1400
 *   node scripts/check-image-sizes.mjs --fail           # exit 1 when any are found
 */
import { readdir, readFile, stat } from "node:fs/promises";
import { join, extname, relative, resolve } from "node:path";
import sharp from "sharp";

const ROOT = new URL("..", import.meta.url).pathname;
const CONTENT_DIRS = ["src/content"];
const CODE_DIRS = ["src/components", "src/pages", "src/layouts"];
const SRC_EXTS = new Set([".astro", ".mdoc", ".ts", ".tsx"]);
const IMAGE_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif"]);

// Below this width an image is upscaled on a normal desktop content
// column and looks soft, so it wants a bigger original. Matches the
// ceiling in scripts/resize-images.mjs (2560px), which leaves ample
// headroom above this floor.
const DEFAULT_MIN_WIDTH = 1200;

// Logos, trust marks and QR codes are drawn small on purpose — a 100px
// ANBI badge is correct at 100px and has no larger original worth
// asking for. Matched on word boundaries so a surname like
// "Patricia-Picon" is not mistaken for an icon. Excluded by default and
// always counted in the report, never dropped silently.
const LOGO_RE =
  /(?:^|[^a-z])(logos?|icons?|badges?|keurmerk|anbi|cbf|sponsorkliks|qr)(?:[^a-z]|$)/i;

const EXT_ALT = "jpg|jpeg|png|webp|avif";
// Each reference shape that can carry an image path. `featured_image`
// is YAML (colon); the rest are Markdoc/Astro attributes (equals).
const PATTERNS = [
  {
    kind: "featured_image",
    re: new RegExp(
      `featured_image\\s*:\\s*["']?([^"'\\n]+\\.(?:${EXT_ALT}))["']?`,
      "gi",
    ),
  },
  {
    kind: "src",
    re: new RegExp(`\\bsrc\\s*=\\s*["']([^"']+\\.(?:${EXT_ALT}))["']`, "gi"),
  },
  {
    kind: "poster",
    re: new RegExp(`\\bposter\\s*=\\s*["']([^"']+\\.(?:${EXT_ALT}))["']`, "gi"),
  },
  // (?<!featured_) so the frontmatter key is not counted twice.
  {
    kind: "image",
    re: new RegExp(
      `(?<!featured_)\\bimage\\s*=\\s*["']([^"']+\\.(?:${EXT_ALT}))["']`,
      "gi",
    ),
  },
];

function parseArgs(argv) {
  const has = (f) => argv.includes(f);
  const value = (f, fallback) => {
    const i = argv.indexOf(f);
    return i !== -1 && argv[i + 1] ? argv[i + 1] : fallback;
  };
  return {
    scope: value("--scope", "all"),
    minWidth: Number(
      value("--min-width", process.env.MIN_WIDTH || DEFAULT_MIN_WIDTH),
    ),
    json: has("--json"),
    markdown: has("--markdown"),
    fail: has("--fail"),
    includeLogos: has("--include-logos"),
    changed: value("--changed", null),
  };
}

/**
 * Narrow the reference map to what a single commit can affect: images
 * referenced from a file it touched, plus images it changed directly
 * (where the referencing page itself was not touched).
 */
function filterToChanged(refs, changedPaths) {
  const changed = new Set(changedPaths);
  const out = new Map();
  for (const [file, entry] of refs) {
    const touchedImage = changed.has(file);
    const touchedSource = [...entry.sources].some((s) => changed.has(s));
    if (touchedImage || touchedSource) out.set(file, entry);
  }
  return out;
}

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

/**
 * Turn a reference as written into a repo-relative file path.
 * Relative paths resolve against the referencing file; absolute ones
 * are served from src/assets (bundled) or public/ (copied verbatim),
 * mirroring resolveImage() in src/lib/images.ts.
 */
async function resolveReference(rawPath, filePath) {
  if (rawPath.startsWith("../") || rawPath.startsWith("./")) {
    return relative(ROOT, resolve(join(filePath, ".."), rawPath));
  }
  if (rawPath.startsWith("/")) {
    for (const base of ["src/assets", "public"]) {
      const candidate = base + rawPath;
      try {
        await stat(join(ROOT, candidate));
        return candidate;
      } catch {
        // try the next base
      }
    }
    return "src/assets" + rawPath;
  }
  return rawPath.replace(/^\//, "");
}

async function collectReferences(dirs) {
  /** @type {Map<string, {sources: Set<string>, kinds: Set<string>}>} */
  const refs = new Map();
  for (const dir of dirs) {
    for await (const filePath of walk(join(ROOT, dir), SRC_EXTS)) {
      const content = await readFile(filePath, "utf-8");
      const source = relative(ROOT, filePath);
      for (const { kind, re } of PATTERNS) {
        re.lastIndex = 0;
        let match;
        while ((match = re.exec(content)) !== null) {
          const imgPath = await resolveReference(match[1], filePath);
          if (!IMAGE_EXTS.has(extname(imgPath).toLowerCase())) continue;
          if (!refs.has(imgPath))
            refs.set(imgPath, { sources: new Set(), kinds: new Set() });
          refs.get(imgPath).sources.add(source);
          refs.get(imgPath).kinds.add(kind);
        }
      }
    }
  }
  return refs;
}

async function measure(refs, minWidth, includeLogos) {
  const small = [];
  const missing = [];
  const skippedLogos = [];
  let measured = 0;
  for (const [file, { sources, kinds }] of refs) {
    const full = join(ROOT, file);
    try {
      await stat(full);
    } catch {
      missing.push({ file, sources: [...sources].sort() });
      continue;
    }
    try {
      const meta = await sharp(full).metadata();
      measured++;
      if (meta.width && meta.width < minWidth) {
        const entry = {
          file,
          width: meta.width,
          height: meta.height,
          kinds: [...kinds].sort(),
          sources: [...sources].sort(),
        };
        const isLogo = LOGO_RE.test(file.split("/").pop());
        if (isLogo && !includeLogos) skippedLogos.push(entry);
        else small.push(entry);
      }
    } catch {
      // Unreadable or not a raster image; nothing to measure.
    }
  }
  const byWidth = (a, b) => a.width - b.width || a.file.localeCompare(b.file);
  small.sort(byWidth);
  skippedLogos.sort(byWidth);
  missing.sort((a, b) => a.file.localeCompare(b.file));
  return { small, missing, skippedLogos, measured, total: refs.size };
}

// Under this width an image is soft on any screen — typically a
// WordPress thumbnail that came across instead of the original.
const URGENT_WIDTH = 600;

function table(rows) {
  const lines = [
    "| Breedte | Afbeelding | Gebruikt in |",
    "| ---: | --- | --- |",
  ];
  for (const { file, width, height, sources } of rows) {
    const where = sources
      .map((s) => `\`${s.replace(/^src\/content\//, "")}\``)
      .join("<br>");
    lines.push(
      `| ${width}×${height} | \`${file.replace(/^src\/assets\//, "")}\` | ${where} |`,
    );
  }
  return lines;
}

function toMarkdown({ small, missing, skippedLogos, measured, minWidth }) {
  const urgent = small.filter((i) => i.width < URGENT_WIDTH);
  const rest = small.filter((i) => i.width >= URGENT_WIDTH);
  const lines = [
    `Deze afbeeldingen zijn smaller dan **${minWidth}px**. Ze worden op een gewoon scherm opgerekt en ogen daardoor onscherp. Ze kunnen het beste vervangen worden door een grotere originele versie.`,
    "",
    `**${small.length}** van de ${measured} gemeten afbeeldingen vallen hieronder. Dat is veel in één keer, dus ze staan hieronder op volgorde van urgentie — de bovenste lijst is het meest zichtbaar.`,
    "",
  ];

  if (urgent.length) {
    lines.push(
      `## Met voorrang: smaller dan ${URGENT_WIDTH}px (${urgent.length})`,
      "",
      "Dit zijn vrijwel allemaal miniaturen die bij de verhuizing van WordPress zijn meegekomen in plaats van de originele foto. Ze zijn op elk scherm zichtbaar onscherp.",
      "",
      ...table(urgent),
      "",
    );
  }

  if (rest.length) {
    lines.push(
      `## Daarna: ${URGENT_WIDTH}–${minWidth - 1}px (${rest.length})`,
      "",
      "Deze zijn acceptabel op een klein scherm, maar te klein voor een groot of scherp scherm.",
      "",
      ...table(rest),
      "",
    );
  }

  if (missing.length) {
    lines.push(
      `## Kapotte verwijzingen (${missing.length})`,
      "",
      "Deze bestanden staan niet meer in de repository, dus op deze pagina's ontbreekt de afbeelding helemaal.",
      "",
      "| Ontbrekend bestand | Gebruikt in |",
      "| --- | --- |",
      ...missing.map(
        ({ file, sources }) =>
          `| \`${file.replace(/^src\/assets\//, "")}\` | ${sources
            .map((s) => `\`${s.replace(/^src\/content\//, "")}\``)
            .join("<br>")} |`,
      ),
      "",
    );
  }

  lines.push(
    "## Hoe aan te leveren",
    "",
    `- Lever het origineel aan, minimaal ${minWidth}px breed. Groter mag: bij het committen wordt alles automatisch teruggeschaald naar maximaal 2560px (\`scripts/resize-images.mjs\`).`,
    "- Een kleine afbeelding groter maken in een bewerkingsprogramma helpt niet — daar komt geen detail bij.",
    "- Staat het origineel nergens meer, laat dat dan weten; dan zoeken we een andere foto.",
    "",
  );

  if (skippedLogos.length) {
    lines.push(
      `<sub>${skippedLogos.length} logo's, keurmerken en QR-codes zijn buiten beschouwing gelaten: die horen klein te zijn.</sub>`,
      "",
    );
  }

  lines.push(
    "<sub>Automatisch bijgewerkt door `.github/workflows/image-quality.yml` via `npm run check:images`.</sub>",
  );

  // GitHub rejects issue bodies over 65536 bytes. Trim from the least
  // urgent end and say so, rather than silently losing rows.
  const body = lines.join("\n");
  const LIMIT = 60000;
  if (Buffer.byteLength(body, "utf8") <= LIMIT) return body;

  const keep = [];
  let size = 0;
  for (const line of lines) {
    size += Buffer.byteLength(line, "utf8") + 1;
    if (size > LIMIT) break;
    keep.push(line);
  }
  keep.push(
    "",
    `> **Deze lijst is ingekort.** Hij paste niet in één issue, dus alleen de smalste afbeeldingen staan hierboven. Draai \`npm run check:images\` voor de volledige lijst van ${small.length}.`,
  );
  return keep.join("\n");
}

function toText({ small, missing, skippedLogos, measured, total, minWidth }) {
  const out = [];
  if (missing.length) {
    out.push(`\n⚠ ${missing.length} referenced image(s) not found on disk:\n`);
    for (const { file, sources } of missing) {
      out.push(`  ${file}`);
      for (const s of sources) out.push(`           └─ ${s}`);
    }
  }
  if (!small.length) {
    out.push(
      `✓ All ${measured} measured images (of ${total} referenced) are at least ${minWidth}px wide`,
    );
    return out.join("\n");
  }
  out.push(
    `\n⚠ ${small.length} image(s) below ${minWidth}px width, of ${measured} measured:\n`,
  );
  for (const { file, width, height, sources } of small) {
    out.push(`  ${width}×${height}  ${file}`);
    for (const s of sources) out.push(`           └─ ${s}`);
  }
  out.push(`\nTotal: ${small.length} images\n`);
  if (skippedLogos.length)
    out.push(
      `(${skippedLogos.length} logo/badge/QR image(s) excluded; pass --include-logos to list them)\n`,
    );
  return out.join("\n");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const dirs =
    args.scope === "content" ? CONTENT_DIRS : [...CONTENT_DIRS, ...CODE_DIRS];
  let refs = await collectReferences(dirs);

  // Collecting references is cheap; measuring every file is not. Narrow
  // first so a push only pays for what it actually changed.
  let changedPaths = null;
  if (args.changed) {
    changedPaths = (await readFile(args.changed, "utf-8"))
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    refs = filterToChanged(refs, changedPaths);
  }

  const result = await measure(refs, args.minWidth, args.includeLogos);
  const report = {
    ...result,
    minWidth: args.minWidth,
    scope: args.scope,
    ...(changedPaths ? { changedFiles: changedPaths.length } : {}),
  };

  if (args.json) console.log(JSON.stringify(report, null, 2));
  else if (args.markdown) console.log(toMarkdown(report));
  else console.log(toText(report));

  if (args.fail && result.small.length) process.exitCode = 1;
}

main();
