// Inventory every draft post / page / fundraiser and propose what to do with
// it (delete / merge / publish / review). Heuristics only — the proposal is a
// starting point for human triage, not an automatic action.
//
//   news        -> draft when status !== "publish"
//   pages       -> draft when `draft: true`
//   fundraisers -> draft when `draft: true`
//
// Usage: node scripts/list-drafts.mjs            (markdown table to stdout)
import fs from "fs";
import path from "path";

const LANGS = ["nl", "en", "es"];
const ROOT = "src/content";

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  let out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out = out.concat(walk(p));
    else if (e.name.endsWith(".mdoc")) out.push(p);
  }
  return out;
}
function frontmatter(file) {
  const raw = fs.readFileSync(file, "utf8");
  const m = raw.match(/^---\n([\s\S]*?)\n---/);
  const b = m ? m[1] : "";
  const get = (k) => (b.match(new RegExp(`^${k}:\\s*"?(.*?)"?\\s*$`, "m")) || [])[1];
  return {
    title: get("title") || "",
    slug: get("slug") || path.basename(file, ".mdoc"),
    status: get("status"),
    draft: /^draft:\s*true\s*$/m.test(b),
    translationKey: get("translationKey"),
    bodyLen: raw.slice(m ? m[0].length : 0).trim().length,
  };
}

// Collect every entry so proposals can reason about siblings.
const entries = [];
for (const kind of ["news", "pages", "fundraisers"]) {
  for (const lang of LANGS) {
    for (const file of walk(path.join(ROOT, kind, lang))) {
      const fm = frontmatter(file);
      const isDraft = kind === "news" ? fm.status !== "publish" : fm.draft;
      entries.push({ kind, lang, file, base: path.basename(file, ".mdoc"), ...fm, isDraft });
    }
  }
}

const publishedKey = new Set(); // kind|translationKey of a LIVE entry
const publishedBase = new Set(); // kind|lang|base of a LIVE entry
const allBase = new Set(); // kind|lang|base of ANY entry
for (const e of entries) {
  allBase.add(`${e.kind}|${e.lang}|${e.base}`);
  if (!e.isDraft) {
    publishedBase.add(`${e.kind}|${e.lang}|${e.base}`);
    if (e.translationKey) publishedKey.add(`${e.kind}|${e.translationKey}`);
  }
}

const CRUFT =
  /^(test-|wpsd-thank-you|cart$|checkout$|home-1$|our-blog|donor-dashboard|donateur-dashboard|member-directory|my-profile|reset-password|sign-up$|log-in$|account$|stripe-checkout|donation-history$|products$|wpforms|donation-confirmation$|donation-failed$|in-beeld-2$)/;

function propose(e) {
  if (CRUFT.test(e.base))
    return ["🗑 Delete", "WordPress/system page — not editorial content"];
  const m = e.base.match(/^(.*)-([1-9])$/);
  if (m) {
    const canonical = m[1];
    if (allBase.has(`${e.kind}|${e.lang}|${canonical}`))
      return ["🗑 Delete", `Duplicate of \`${canonical}\``];
    return ["🔀 Merge/Rename", `Collision suffix — collapse to \`${canonical}\``];
  }
  if (e.bodyLen < 200) return ["🗑 Delete", "Stub — almost no body content"];
  if (e.translationKey && publishedKey.has(`${e.kind}|${e.translationKey}`))
    return ["📢 Publish", "Other-language sibling(s) already live"];
  return ["👀 Review", "Real draft content — publish after review or drop"];
}

const drafts = entries
  .filter((e) => e.isDraft)
  .map((e) => ({ ...e, prop: propose(e) }))
  .sort(
    (a, b) =>
      a.prop[0].localeCompare(b.prop[0]) ||
      a.kind.localeCompare(b.kind) ||
      a.base.localeCompare(b.base),
  );

const rows = drafts.map(
  (e) =>
    `| ${e.kind} | ${e.lang} | \`${e.base}\` | ${e.title || "—"} | ${e.prop[0]} | ${e.prop[1]} |`,
);
const counts = drafts.reduce((m, e) => ((m[e.prop[0]] = (m[e.prop[0]] || 0) + 1), m), {});

console.log(`Total drafts: ${drafts.length}`);
console.log(
  Object.entries(counts)
    .map(([k, v]) => `${k}: ${v}`)
    .join(" · "),
);
console.log();
console.log("| Collection | Lang | Slug | Title | Proposal | Reason |");
console.log("| --- | --- | --- | --- | --- | --- |");
console.log(rows.join("\n"));
