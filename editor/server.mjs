/*
 * QuinaCare Blog Editor — local companion server.
 *
 * Run it with:  node editor/server.mjs
 *
 * Uses only Node built-ins — nothing to npm-install. It serves the editor
 * page and exposes a tiny API the page calls:
 *   GET  /api/posts                 list every news post (per language)
 *   GET  /api/file?lang=&name=      read one post
 *   POST /api/save                  write one post
 *   POST /api/delete                delete one post
 *   POST /api/commit                git commit + push that post
 *   POST /api/translate             translate a post via Google Translate
 *
 * The working folder is fixed: the repo root is taken as `..` relative to
 * this script, and posts live in src/content/news/{nl,en,es}. Nothing is
 * selectable at runtime.
 */
import { createServer } from "node:http";
import { readFile, writeFile, readdir, unlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve, sep } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, ".."); // the ".." working folder = repo root
const NEWS = join(ROOT, "src", "content", "news");
const LANGS = ["nl", "en", "es"];
const PORT = 4477;
const NAME_RE = /^[A-Za-z0-9._-]+\.(mdoc|md|markdown)$/;

/* ── Frontmatter / body split ─────────────────────────────── */
function splitDoc(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  return m
    ? { fm: m[1], body: m[2].replace(/^\r?\n/, "") }
    : { fm: "", body: text };
}
function fmField(fm, key) {
  const m = fm.match(new RegExp("^" + key + ":\\s*(.*)$", "m"));
  if (!m) return "";
  let v = m[1].trim();
  if (
    v.length >= 2 &&
    ((v[0] === '"' && v.endsWith('"')) || (v[0] === "'" && v.endsWith("'")))
  ) {
    v = v.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, "\\");
  }
  return v;
}

/* ── Path safety ──────────────────────────────────────────── */
function safePath(lang, name) {
  if (!LANGS.includes(lang) || !NAME_RE.test(name || "")) return null;
  const p = join(NEWS, lang, name);
  return p.startsWith(NEWS + sep) ? p : null;
}

/* ── Post index ───────────────────────────────────────────── */
async function listPosts() {
  const out = [];
  for (const lang of LANGS) {
    let names;
    try {
      names = await readdir(join(NEWS, lang));
    } catch {
      continue; // language folder missing — skip
    }
    for (const name of names) {
      if (!NAME_RE.test(name)) continue;
      let title = name;
      let status = "";
      let date = "";
      let slug = name.replace(/\.(mdoc|md|markdown)$/i, "");
      try {
        const { fm } = splitDoc(await readFile(join(NEWS, lang, name), "utf8"));
        title = fmField(fm, "title") || title;
        status = fmField(fm, "status");
        date = fmField(fm, "date");
        slug = fmField(fm, "slug") || slug;
      } catch {
        /* unreadable — keep filename defaults */
      }
      out.push({ lang, name, slug, title, status, date });
    }
  }
  return out;
}

/* ── Child processes ──────────────────────────────────────── */
function run(cmd, args, input) {
  return new Promise((res) => {
    let child;
    try {
      child = spawn(cmd, args, { cwd: ROOT });
    } catch (e) {
      return res({ code: -1, out: "", err: String(e.message) });
    }
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("error", (e) => res({ code: -1, out, err: String(e.message) }));
    child.on("close", (code) => res({ code, out, err }));
    if (input != null) {
      child.stdin.write(input);
    }
    child.stdin.end();
  });
}

async function gitCommitPush(relPath, message) {
  const log = [];
  let r = await run("git", ["commit", "-m", message, "--", relPath]);
  log.push("$ git commit\n" + (r.out + r.err).trim());
  if (r.code !== 0) return { ok: false, log: log.join("\n\n") }; // e.g. nothing to commit
  r = await run("git", ["push"]);
  log.push("$ git push\n" + (r.out + r.err).trim());
  return { ok: r.code === 0, log: log.join("\n\n") };
}

/* ── Translation via the keyless Google Translate endpoint ──── */
function chunkText(s, limit) {
  if (s.length <= limit) return [s];
  const out = [];
  let i = 0;
  while (i < s.length) {
    let end = Math.min(i + limit, s.length);
    if (end < s.length) {
      const sp = s.lastIndexOf(" ", end);
      if (sp > i) end = sp;
    }
    out.push(s.slice(i, end));
    i = end;
  }
  return out;
}

async function gt(text, sl, tl) {
  if (!text || !text.trim()) return text;
  const lead = text.match(/^\s*/)[0];
  const trail = text.match(/\s*$/)[0];
  const core = text.slice(lead.length, text.length - trail.length);
  let result = "";
  for (const chunk of chunkText(core, 1400)) {
    const url =
      "https://translate.googleapis.com/translate_a/single?client=gtx&sl=" +
      encodeURIComponent(sl) +
      "&tl=" +
      encodeURIComponent(tl) +
      "&dt=t&q=" +
      encodeURIComponent(chunk);
    let r;
    try {
      r = await fetch(url);
    } catch (e) {
      throw new Error("could not reach Google Translate: " + e.message);
    }
    if (r.status === 429)
      throw new Error(
        "Google Translate is rate-limiting — wait a minute, then retry",
      );
    if (!r.ok) throw new Error("Google Translate returned HTTP " + r.status);
    const data = await r.json();
    result += (data[0] || []).map((seg) => seg[0] || "").join("");
  }
  return lead + result + trail;
}

function unquoteVal(s) {
  if (
    s.length >= 2 &&
    ((s[0] === '"' && s.endsWith('"')) || (s[0] === "'" && s.endsWith("'")))
  )
    return s.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, "\\");
  return s;
}
function quoteVal(s) {
  return '"' + String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"';
}

// Translate the prose of one line, leaving Markdoc tags and link URLs intact.
async function translateInline(text, sl, tl) {
  const re = /(\{%[\s\S]*?%\})|(!?)\[([^\]]*)\]\(([^)]*)\)/g;
  let out = "";
  let last = 0;
  let m;
  while ((m = re.exec(text))) {
    out += await gt(text.slice(last, m.index), sl, tl);
    if (m[1]) {
      out += m[1]; // Markdoc tag — kept verbatim
    } else {
      const alt = m[3].trim() ? await gt(m[3], sl, tl) : m[3];
      out += m[2] + "[" + alt + "](" + m[4] + ")"; // translate label, keep URL
    }
    last = re.lastIndex;
  }
  out += await gt(text.slice(last), sl, tl);
  return out;
}

async function translateBody(body, sl, tl) {
  const out = [];
  for (const line of body.split(/\r?\n/)) {
    if (!line.trim() || /^\s*\{%[\s\S]*%\}\s*$/.test(line)) {
      out.push(line); // blank line, or a stand-alone Markdoc tag
      continue;
    }
    const m = line.match(
      /^(\s*(?:#{1,6}\s+|>\s+|[-*+]\s+|\d+[.)]\s+)?)([\s\S]*)$/,
    );
    out.push(m[1] + (await translateInline(m[2], sl, tl)));
  }
  return out.join("\n");
}

async function translateFrontmatter(fm, sl, tl) {
  const translatable = new Set(["title", "excerpt", "featured_image_caption"]);
  const out = [];
  for (const line of fm.split(/\r?\n/)) {
    const m = line.match(/^(\s*)([A-Za-z_][\w-]*):\s*(.*)$/);
    if (!m) {
      out.push(line);
      continue;
    }
    const [, indent, key, raw] = m;
    if (key === "language") {
      out.push(indent + 'language: "' + tl + '"');
    } else if (translatable.has(key) && raw.trim()) {
      out.push(
        indent +
          key +
          ": " +
          quoteVal(await gt(unquoteVal(raw.trim()), sl, tl)),
      );
    } else {
      out.push(line);
    }
  }
  return out.join("\n");
}

async function translate(content, source, target) {
  if (!LANGS.includes(target)) throw new Error("unknown target language");
  const sl = LANGS.includes(source) ? source : "auto";
  const { fm, body } = splitDoc(content);
  const outFm = fm ? await translateFrontmatter(fm, sl, target) : "";
  const outBody = await translateBody(body, sl, target);
  return (
    (outFm ? "---\n" + outFm + "\n---\n\n" : "") +
    outBody.replace(/^\n+/, "") +
    "\n"
  );
}

/* ── HTTP helpers ─────────────────────────────────────────── */
function json(res, code, obj) {
  res.writeHead(code, { "content-type": "application/json" });
  res.end(JSON.stringify(obj));
}
function readBody(req) {
  return new Promise((res, rej) => {
    let d = "";
    req.on("data", (c) => {
      d += c;
      if (d.length > 8e6) req.destroy();
    });
    req.on("end", () => {
      try {
        res(d ? JSON.parse(d) : {});
      } catch {
        rej(new Error("invalid JSON body"));
      }
    });
    req.on("error", rej);
  });
}

/* ── Server ───────────────────────────────────────────────── */
const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  try {
    if (req.method === "GET" && url.pathname === "/") {
      const html = await readFile(join(HERE, "index.html"));
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      return res.end(html);
    }
    if (req.method === "GET" && url.pathname === "/api/posts") {
      return json(res, 200, { posts: await listPosts() });
    }
    if (req.method === "GET" && url.pathname === "/api/file") {
      const p = safePath(
        url.searchParams.get("lang"),
        url.searchParams.get("name"),
      );
      if (!p) return json(res, 400, { error: "bad file path" });
      return json(res, 200, { content: await readFile(p, "utf8") });
    }
    if (req.method === "POST" && url.pathname === "/api/save") {
      const b = await readBody(req);
      const p = safePath(b.lang, b.name);
      if (!p) return json(res, 400, { error: "bad file path" });
      await writeFile(p, String(b.content ?? ""), "utf8");
      return json(res, 200, { ok: true });
    }
    if (req.method === "POST" && url.pathname === "/api/delete") {
      const b = await readBody(req);
      const p = safePath(b.lang, b.name);
      if (!p) return json(res, 400, { error: "bad file path" });
      await unlink(p);
      return json(res, 200, { ok: true });
    }
    if (req.method === "POST" && url.pathname === "/api/commit") {
      const b = await readBody(req);
      if (!safePath(b.lang, b.name))
        return json(res, 400, { error: "bad file path" });
      const rel = `src/content/news/${b.lang}/${b.name}`;
      const message = String(b.message || `Update blog post: ${b.name}`);
      return json(res, 200, await gitCommitPush(rel, message));
    }
    if (req.method === "POST" && url.pathname === "/api/translate") {
      const b = await readBody(req);
      const content = await translate(
        String(b.content || ""),
        String(b.source || "the source language"),
        String(b.target || ""),
      );
      return json(res, 200, { content });
    }
    json(res, 404, { error: "not found" });
  } catch (e) {
    json(res, 500, { error: String((e && e.message) || e) });
  }
});

server.on("error", (e) => {
  if (e.code === "EADDRINUSE")
    console.error(
      `\n  Port ${PORT} is already in use — is the editor already running?\n`,
    );
  else console.error(e);
  process.exit(1);
});

server.listen(PORT, "127.0.0.1", () => {
  const url = `http://localhost:${PORT}`;
  console.log("\n  QuinaCare Blog Editor");
  console.log("  " + url);
  console.log("  editing: " + NEWS);
  if (!existsSync(NEWS))
    console.log("  ⚠ src/content/news not found — is this the repo root?");
  console.log("  Ctrl+C to stop\n");
  const opener =
    process.platform === "darwin"
      ? "open"
      : process.platform === "win32"
        ? "start"
        : "xdg-open";
  try {
    spawn(opener, [url], {
      stdio: "ignore",
      detached: true,
      shell: process.platform === "win32",
    }).unref();
  } catch {
    /* no browser auto-open — the URL is printed above */
  }
});
