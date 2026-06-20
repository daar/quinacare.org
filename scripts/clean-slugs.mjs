// Strip legacy WordPress duplicate-counter suffixes ("-2", "-3", …) from
// news post slugs — they look bad in the new design. Only a trailing 1–2
// digit counter is removed (never a 4-digit year), and only when the
// cleaned slug doesn't collide with another post in the same language.
// Filenames are left as-is (the slug frontmatter drives the URL).
//
// Usage:  node scripts/clean-slugs.mjs
import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const SUFFIX = /-\d{1,2}$/;
// Generated newsletter/report slugs end in a month/year (e.g.
// nieuwsbrief-2024-06) — never a dup counter. Skip them.
const GENERATED = /^(nieuwsbrief|newsletter|boletin|jaarverslag|annual-report|informe-anual)-/;

let cleaned = [];
let kept = [];

for (const lang of ["nl", "en", "es"]) {
  const dir = path.join(ROOT, "src/content/news", lang);
  if (!fs.existsSync(dir)) continue;

  const entries = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const fp = path.join(d, e.name);
      if (e.isDirectory()) walk(fp);
      else if (e.name.endsWith(".mdoc")) {
        const t = fs.readFileSync(fp, "utf8");
        const id = e.name.replace(/\.mdoc$/, "");
        const slug = t.match(/^slug:\s*"?([^"\n]+)"?\s*$/m)?.[1]?.trim() || id;
        const generated = /^translationKey:/m.test(t) || GENERATED.test(slug);
        entries.push({ fp, slug, generated });
      }
    }
  };
  walk(dir);

  const slugSet = new Set(entries.map((e) => e.slug));
  const cleanCount = {};
  for (const e of entries) {
    if (!e.generated && SUFFIX.test(e.slug)) {
      const c = e.slug.replace(SUFFIX, "");
      cleanCount[c] = (cleanCount[c] || 0) + 1;
    }
  }

  for (const e of entries) {
    if (e.generated || !SUFFIX.test(e.slug)) continue;
    const c = e.slug.replace(SUFFIX, "");
    const safe = c && !slugSet.has(c) && cleanCount[c] === 1;
    if (!safe) {
      kept.push(`${lang}: ${e.slug} (collision)`);
      continue;
    }
    const t = fs.readFileSync(e.fp, "utf8");
    fs.writeFileSync(e.fp, t.replace(/^slug:\s*"?[^"\n]+"?\s*$/m, `slug: "${c}"`));
    cleaned.push(`${e.slug} -> ${c}`);
  }
}

console.log(`Cleaned ${cleaned.length} slugs:`);
for (const c of cleaned.sort()) console.log("  ", c);
if (kept.length) {
  console.log(`Kept ${kept.length} (numbered, would collide):`);
  for (const k of kept.sort()) console.log("  ", k);
}
