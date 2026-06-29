// One-off cleanup for the legacy WordPress person/article posts:
//  - collapse a trailing -N duplicate slug suffix, rename file to match
//  - status -> publish
//  - turn a leading "*\" quote *" + **attribution** pull-quote into a
//    Markdown blockquote and drop the attribution
//  - give {% image %} / {% image-row %} tags blank lines (block level)
//  - split paragraphs joined by a "  \n" hard break
//  - move a trailing name signature onto its own line
//  - replace the broken concatenated excerpt with the opening sentences
//
// Usage: node scripts/clean-legacy-posts.mjs <canonical-slug> <file.mdoc> [more files...]
// All files get the given canonical slug + filename (one person, all langs).
import fs from "fs";
import path from "path";

const canonicalSlug = process.argv[2];

function firstSentences(text, min = 110, max = 240) {
  const parts = text
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[.!?…])\s+/);
  let out = "";
  for (const s of parts) {
    if (out && out.length >= min) break;
    out = out ? `${out} ${s}` : s;
    if (out.length >= max) break;
  }
  return out.trim();
}

for (const fp of process.argv.slice(3)) {
  const raw = fs.readFileSync(fp, "utf8");
  const fm = raw.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!fm) {
    console.log("SKIP (no frontmatter)", fp);
    continue;
  }
  let front = fm[1];
  let body = raw.slice(fm[0].length);

  const title = (front.match(/^title:\s*"?(.+?)"?\s*$/m) || [])[1] || "";
  const baseSlug = canonicalSlug;

  if (/^status:/m.test(front))
    front = front.replace(/^status:.*$/m, "status: publish");
  front = front.replace(/^slug:\s*.*$/m, `slug: "${baseSlug}"`);

  // --- body ---
  let lines = body.split("\n");
  while (lines.length && lines[0].trim() === "") lines.shift();
  let quote = null;
  if (lines.length && /^\*"/.test(lines[0].trim())) {
    quote = lines[0]
      .trim()
      .replace(/^\*"\s*/, "")
      .split("*")[0]
      .trim();
    lines.shift();
    if (lines.length && /^\*\*.*\*\*\s*$/.test(lines[0].trim())) lines.shift();
    while (lines.length && lines[0].trim() === "") lines.shift();
  }
  body = lines.join("\n");

  body = body.replace(/ {2,}\n/g, "\n\n"); // hard-break joins -> paragraphs
  // blank lines around image / image-row block tags
  body = body.replace(/([^\n])\n(\{%\s*\/?image)/g, "$1\n\n$2");
  body = body.replace(/(%\})\n([^\n])/g, "$1\n\n$2");

  // trailing name signature onto its own line
  if (title && /[A-Za-z]/.test(title)) {
    const tEsc = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    body = body.replace(
      new RegExp(`([.!?…])[ \\t]+(${tEsc})\\s*$`),
      `$1\n\n$2`,
    );
  }

  body =
    body
      .replace(/\n{3,}/g, "\n\n")
      .replace(/^\n+/, "")
      .trimEnd() + "\n";

  let newBody = quote ? `> "${quote}"\n\n${body}` : body;

  const firstPara =
    newBody.split("\n\n").find((p) => {
      const t = p.trim();
      return t && !t.startsWith(">") && !t.startsWith("{%");
    }) || "";
  const excerpt = firstSentences(firstPara)
    .replace(/\\/g, "")
    .replace(/"/g, '\\"');
  if (excerpt && /^excerpt:/m.test(front))
    front = front.replace(/^excerpt:\s*.*$/m, `excerpt: "${excerpt}"`);

  const out = `---\n${front}\n---\n\n${newBody}`;
  fs.writeFileSync(fp, out);
  const target = path.join(path.dirname(fp), `${baseSlug}.mdoc`);
  if (target !== fp) fs.renameSync(fp, target);
  console.log(
    `${target !== fp ? "RENAMED" : "updated"}  ${path.relative(process.cwd(), target)}${quote ? "  [blockquote]" : ""}`,
  );
}
