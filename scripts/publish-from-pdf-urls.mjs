// Publish the pages/posts that the old-site PDFs link to.
//
// The PDFs in public/ (newsletters, reports, press) contain links back to
// quinacare.org pages — staff stories, blog posts, fundraisers. Many of
// those were imported from WordPress as drafts. This script extracts every
// internal URL from every PDF (visible text + /URI link annotations),
// resolves each to a content entry by slug or filename, and flips the
// matched drafts to published.
//
// Usage (from the repo root):  node scripts/publish-from-pdf-urls.mjs
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const ROOT = process.cwd();

// Path segments that are routes/sections, never a content slug to match.
const STOP = new Set([
  "", "en", "es", "nl", "donate", "doneer", "donar", "document",
  "wp-content", "uploads", "news", "actueel", "noticias", "search",
  "page", "category", "tag", "author", "feed",
]);

function pdfUrls(file) {
  const urls = new Set();
  try {
    const text = execSync(`pdftotext -q ${JSON.stringify(file)} -`, {
      maxBuffer: 1 << 26,
    }).toString();
    for (const m of text.matchAll(/https?:\/\/[^\s)"'<>]+/gi)) urls.add(m[0]);
  } catch {}
  try {
    const raw = execSync(`strings ${JSON.stringify(file)}`, {
      maxBuffer: 1 << 27,
    }).toString();
    for (const m of raw.matchAll(/\/URI\s*\(([^)]*)\)/g)) urls.add(m[1]);
  } catch {}
  return urls;
}

// Collect candidate slugs from every internal quinacare.org URL.
const candidates = new Set();
const pdfFiles = execSync(`find ${JSON.stringify(path.join(ROOT, "public"))} -iname '*.pdf'`)
  .toString()
  .split("\n")
  .filter(Boolean);

for (const f of pdfFiles) {
  for (const url of pdfUrls(f)) {
    let u;
    try {
      u = new URL(url.replace(/[).,]+$/, ""));
    } catch {
      continue;
    }
    if (!/(^|\.)quinacare\.org$/i.test(u.hostname)) continue;
    let p;
    try {
      p = decodeURIComponent(u.pathname);
    } catch {
      p = u.pathname;
    }
    if (/\.(pdf|jpe?g|png|webp|gif|svg)$/i.test(p)) continue;
    const segs = p.split("/").filter(Boolean);
    const last = segs[segs.length - 1];
    if (last && !STOP.has(last.toLowerCase())) candidates.add(last.toLowerCase());
  }
}

// Walk the content collections and publish matched drafts.
const COLLECTIONS = ["news", "pages", "projects", "fundraisers"];
let published = [];
let matchedAlready = 0;

for (const col of COLLECTIONS) {
  const base = path.join(ROOT, "src/content", col);
  if (!fs.existsSync(base)) continue;
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const fp = path.join(dir, e.name);
      if (e.isDirectory()) walk(fp);
      else if (e.name.endsWith(".mdoc") || e.name.endsWith(".md")) consider(fp);
    }
  };
  walk(base);
}

function consider(fp) {
  const text = fs.readFileSync(fp, "utf8");
  const id = path.basename(fp).replace(/\.(mdoc|md)$/, "").toLowerCase();
  const slug = text.match(/^slug:\s*"?([^"\n]+)"?\s*$/m)?.[1]?.trim().toLowerCase();
  const ref = candidates.has(id) || (slug && candidates.has(slug));
  if (!ref) return;

  const isDraftStatus = /^status:\s*"?draft"?\s*$/m.test(text);
  const isDraftFlag = /^draft:\s*true\s*$/m.test(text);
  if (!isDraftStatus && !isDraftFlag) {
    matchedAlready++;
    return;
  }
  let next = text;
  if (isDraftStatus) next = next.replace(/^status:\s*"?draft"?\s*$/m, "status: publish");
  if (isDraftFlag) next = next.replace(/^draft:\s*true\s*$/m, "draft: false");
  fs.writeFileSync(fp, next);
  published.push(path.relative(ROOT, fp));
}

console.log(`Candidate slugs from PDFs: ${candidates.size}`);
console.log(`Already-published matches: ${matchedAlready}`);
console.log(`Published ${published.length} drafts:`);
for (const p of published.sort()) console.log("  +", p);
