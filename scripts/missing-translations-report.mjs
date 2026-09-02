// Report which news articles are missing a language variant.
//
// Groups every entry in src/content/news/{nl,en,es} by `translationKey` and
// flags which of the three languages have no sibling with that key. Entries
// without a `translationKey` (or with a key no other entry shares) are
// listed separately as orphans, since they can't be matched automatically.
//
// Usage: node scripts/missing-translations-report.mjs
import fs from "fs";
import path from "path";

const LANGS = ["nl", "en", "es"];
const ROOT = "src/content/news";

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
  const get = (k) =>
    (b.match(new RegExp(`^${k}:\\s*"?(.*?)"?\\s*$`, "m")) || [])[1];
  return {
    title: get("title") || path.basename(file, ".mdoc"),
    status: get("status"),
    translationKey: get("translationKey"),
  };
}

const entries = [];
for (const lang of LANGS) {
  for (const file of walk(path.join(ROOT, lang))) {
    entries.push({ lang, file, ...frontmatter(file) });
  }
}

const byKey = new Map(); // translationKey -> entries[]
const orphans = [];
for (const e of entries) {
  if (!e.translationKey) {
    orphans.push(e);
    continue;
  }
  if (!byKey.has(e.translationKey)) byKey.set(e.translationKey, []);
  byKey.get(e.translationKey).push(e);
}

const incomplete = [...byKey.entries()]
  .map(([key, group]) => ({
    key,
    group,
    missing: LANGS.filter((l) => !group.some((e) => e.lang === l)),
  }))
  .filter((g) => g.missing.length > 0)
  .sort((a, b) => a.key.localeCompare(b.key));

console.log(
  `translationKeys: ${byKey.size} · incomplete: ${incomplete.length} · orphans (no translationKey): ${orphans.length}`,
);
console.log();
console.log("| translationKey | title | present | missing |");
console.log("| --- | --- | --- | --- |");
for (const { key, group, missing } of incomplete) {
  const title = group[0].title;
  const present = group
    .map(
      (e) =>
        `${e.lang}${e.status && e.status !== "publish" ? ` (${e.status})` : ""}`,
    )
    .join(", ");
  console.log(`| \`${key}\` | ${title} | ${present} | ${missing.join(", ")} |`);
}

if (orphans.length) {
  console.log();
  console.log("Orphans (no translationKey set, can't be matched):");
  console.log("| lang | file | title |");
  console.log("| --- | --- | --- |");
  for (const e of orphans) {
    console.log(`| ${e.lang} | \`${e.file}\` | ${e.title} |`);
  }
}
