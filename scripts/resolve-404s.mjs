// Resolve the Turso 404 log into redirects / published content.
//
// Reads page_misses, and for each human (non-bot) 404 that isn't already
// handled by the native-route redirects (PR #27) or an existing page:
//   - if a matching draft page/post exists -> publish it (and redirect the
//     old URL to its native canonical URL),
//   - else if it maps to a known section -> add a redirect,
// writing src/data/missesRedirects.mjs. Targets use the native (localized)
// routes from PR #27. With --clear it also empties the table afterwards.
//
// Usage:  node --env-file=.env scripts/resolve-404s.mjs [--clear]
import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";
import { createClient } from "@libsql/client";

const ROOT = process.cwd();
const CLEAR = process.argv.includes("--clear");

// Native route segment per language (mirrors src/i18n ROUTES).
const SEG = {
  news: { nl: "actueel", en: "news", es: "noticias" },
  projects: { nl: "projecten", en: "projects", es: "proyectos" },
  fundraisers: { nl: "acties", en: "fundraisers", es: "campañas" },
};
const pfx = (lang) => (lang === "nl" ? "" : `/${lang}`);

// High-confidence section redirects (old URL -> native target), used only
// as a fallback when no content entry matches the path.
const CURATED = {
  "/hospital-san-miguel": "/ziekenhuis",
  "/en/about-us": "/en/about",
  "/join-team": "/word-vrijwilliger",
  "/en/join-team": "/en/become-volunteer",
  "/apply": "/word-vrijwilliger",
  "/steun-hospital-san-miguel-en-doe-een-donatie": "/doneer",
  "/donate": "/en/donate",
  "/en/word-vrijwilliger": "/en/become-volunteer",
  "/actueel/looking-for-equipment": "/actueel/we-zoeken-apparatuur",
  // Old EN-slug-on-NL-path project URL → the real NL equipment project.
  "/projecten/hospital-equipment": "/projecten/ziekenhuisapparatuur",
  // Stale WordPress person page (-N cruft) → the EN staff overview.
  "/en/maria-priscila-chacon-de-la-portilla-3": "/en/staff",
};

const JUNK =
  /(wp-admin|wp-login|wp-content|xmlrpc|cgi-bin|phpmyadmin|\.php|\.env|\.git|\?url=)/i;
const ASSET = /\.(pdf|jpe?g|png|webp|gif|svg|css|js|ico|xml|txt)$/i;
const norm = (p) => {
  let s = p.split("?")[0].split("#")[0];
  if (s.length > 1) s = s.replace(/\/+$/, "");
  return s || "/";
};

// Build a content index: native URL + draft state, keyed by slug/id.
const index = []; // { lang, collection, id, slug, isDraft, url, file }
for (const collection of ["news", "pages", "projects", "fundraisers"]) {
  const base = path.join(ROOT, "src/content", collection);
  if (!fs.existsSync(base)) continue;
  for (const lang of ["nl", "en", "es"]) {
    const dir = path.join(base, lang);
    if (!fs.existsSync(dir)) continue;
    const walk = (d) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const fp = path.join(d, e.name);
        if (e.isDirectory()) walk(fp);
        else if (e.name.endsWith(".mdoc") || e.name.endsWith(".md")) {
          const t = fs.readFileSync(fp, "utf8");
          const id = e.name.replace(/\.(mdoc|md)$/, "");
          const slug =
            t.match(/^slug:\s*"?([^"\n]+)"?\s*$/m)?.[1]?.trim() || id;
          const isDraft =
            /^status:\s*"?draft"?\s*$/m.test(t) ||
            /^draft:\s*true\s*$/m.test(t);
          let url;
          if (collection === "pages") url = `${pfx(lang)}/${slug}`;
          else url = `${pfx(lang)}/${SEG[collection][lang]}/${slug}`;
          index.push({ lang, collection, id, slug, isDraft, url, file: fp });
        }
      }
    };
    walk(dir);
  }
}

// Already-resolved set: published URLs + native route indexes + redirect
// sources (PR #27 routeRedirects + legacy config keys).
const resolved = new Set();
for (const it of index) if (!it.isDraft) resolved.add(it.url);
for (const c of ["news", "projects", "fundraisers"])
  for (const lang of ["nl", "en", "es"])
    resolved.add(`${pfx(lang)}/${SEG[c][lang]}`);
for (const home of ["/", "/en", "/es"]) resolved.add(home);
for (const k of [
  "/blogs-vlogs",
  "/doneer/anbi",
  "/doneer/quina-yura",
  "/vrijwilligers",
  "/doneer/putumayo-loop-2025",
  "/fietsen-voor-hospital-san-miguel-2",
  "/doneer/andrea-halve-marathon",
  "/doneer/demi-en-thomas",
  "/doneer/esmee-en-diana",
  "/doneer/karin-martens-maakt-operaties-mogelijk",
])
  resolved.add(k);
// routeRedirects.mjs was removed — redirects now come only from this 404
// log. Nothing to pre-treat as covered by dynamic route redirects.
const wildPrefixes = [];

const langOf = (p) =>
  p.startsWith("/en/") ? "en" : p.startsWith("/es/") ? "es" : "nl";
const lastSeg = (p) => p.split("/").filter(Boolean).pop() || "";

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});
const SNAP = "/tmp/404-snapshot.json";
let rows = (
  await db.execute(
    "SELECT path, referrer, user_agent, is_bot, created_at FROM page_misses",
  )
).rows;
if (rows.length === 0 && fs.existsSync(SNAP)) {
  rows = JSON.parse(fs.readFileSync(SNAP, "utf8"));
  console.log("(table empty — reading from snapshot)");
} else {
  fs.writeFileSync(SNAP, JSON.stringify(rows, null, 2));
}

// Ignore dev/local misses: 404.astro logs document.referrer, so misses hit
// while running locally carry a localhost / 127.0.0.1 referrer.
const isLocal = (r) =>
  /(localhost|127\.0\.0\.1|0\.0\.0\.0|\.local(:|\/|$))/i.test(
    String(r.referrer || ""),
  );
const localCount = rows.filter((r) => !r.is_bot && isLocal(r)).length;
const paths = [
  ...new Set(
    rows.filter((r) => !r.is_bot && !isLocal(r)).map((r) => String(r.path)),
  ),
];

// Cumulative: seed from the redirects already on disk so a re-run — or a
// now-smaller/cleared page_misses log — never drops previously-resolved
// entries. New resolutions below override on key conflict.
const redirectsPath = path.join(ROOT, "src/data/missesRedirects.mjs");
const redirects = fs.existsSync(redirectsPath)
  ? { ...(await import(pathToFileURL(redirectsPath).href)).default }
  : {};
const published = [];
const skipped = [];

for (const raw of paths) {
  const p = norm(raw);
  if (p === "/" || JUNK.test(p) || ASSET.test(p)) {
    skipped.push([p, "junk/asset"]);
    continue;
  }
  if (resolved.has(p) || wildPrefixes.some((pre) => p.startsWith(pre))) {
    skipped.push([p, "already resolved"]);
    continue;
  }

  // Curated section redirects win over incidental content matches.
  if (CURATED[p]) {
    redirects[p] = CURATED[p];
    continue;
  }

  const lang = langOf(p);
  const cand = lastSeg(p).toLowerCase();
  // Same-language matches only (cross-language guesses produced wrong
  // redirects), and never resolve to a -N collision-cruft slug.
  const cruft = /-[1-9]$/;
  const hit = index.find(
    (it) =>
      it.lang === lang &&
      !cruft.test(it.slug) &&
      !cruft.test(it.id) &&
      (it.slug.toLowerCase() === cand || it.id.toLowerCase() === cand),
  );

  if (hit) {
    if (hit.isDraft) {
      const t = fs.readFileSync(hit.file, "utf8");
      let next = t
        .replace(/^status:\s*"?draft"?\s*$/m, "status: publish")
        .replace(/^draft:\s*true\s*$/m, "draft: false");
      if (next !== t) {
        fs.writeFileSync(hit.file, next);
        published.push(path.relative(ROOT, hit.file));
      }
    }
    if (p !== norm(hit.url)) redirects[p] = hit.url;
    continue;
  }
  skipped.push([p, "no match"]);
}

const out =
  "// AUTO-GENERATED by scripts/resolve-404s.mjs from the Turso 404 log.\n" +
  "// Old/missed URLs -> native targets.\n" +
  "export default " +
  JSON.stringify(redirects, null, 2) +
  ";\n";
fs.writeFileSync(path.join(ROOT, "src/data/missesRedirects.mjs"), out);

console.log(
  `404 paths (human, non-local): ${paths.length}  ·  ignored local/dev: ${localCount}`,
);
console.log(`Published ${published.length} drafts:`);
for (const x of published.sort()) console.log("  +", x);
console.log(`Redirects ${Object.keys(redirects).length}:`);
for (const [k, v] of Object.entries(redirects)) console.log(`  ${k} -> ${v}`);
console.log(`Skipped ${skipped.length} (already-resolved/junk/no-match).`);

if (CLEAR) {
  const n = (await db.execute("SELECT COUNT(*) c FROM page_misses")).rows[0].c;
  await db.execute("DELETE FROM page_misses");
  console.log(
    `Cleared page_misses (${n} rows). Snapshot at /tmp/404-snapshot.json`,
  );
} else {
  console.log("Dry run (no --clear): table left intact.");
}
