#!/usr/bin/env node
/**
 * Cut studio portraits into square avatars for the team grid.
 *
 * The team grid shows each portrait in a circle. A non-square source is
 * then cropped again by `object-fit: cover`, which trims equally top and
 * bottom — and because these sitters are framed high, that sliced the top
 * off their heads. Producing a square avoids that second crop entirely:
 * what this script frames is exactly what the circle shows.
 *
 * Framing is measured, not assumed. The sitters are photographed against
 * a plain wall but are not consistently placed: the crown sits anywhere
 * between 2% and 15% down the frame, and the body is not always centred.
 * So the head is located per photo and the square is cut around it, with
 * the crown given headroom so it never touches the circle's edge.
 *
 * Usage:
 *   node scripts/crop-portraits.mjs --map <json> --out <dir> [--size 900]
 *   node scripts/crop-portraits.mjs --probe <file>      # report the head box
 *
 * `--map` is a JSON object of { "<source file>": "<output name>" }.
 */
import { readFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";

const ANALYSIS_WIDTH = 400;
// A head darker than the wall by this much counts as the sitter. Hair and
// skin both clear it; the wall's own shading does not.
const SUBJECT_DELTA = 38;
// Every avatar is cut to the same zoom: the square is a fixed multiple of
// the sitter's head width, with the crown a fixed fraction down from the
// top edge. The numbers come from Dayana's portrait, which was chosen as
// the reference framing. Keying off head width rather than head height
// matters — the chin is the least reliable of the measurements, and
// letting it drive the size made the same person read as nearer or
// further away from card to card.
const SIDE_PER_HEAD_WIDTH = 2.325;
const HEADROOM = 0.13;
// Everyone was photographed at the same distance with the same lens, so
// their heads are all about the same size in frame. A silhouette that
// measures much wider is voluminous hair, not a bigger head, and letting
// it drive the crop pushes that person visibly further away than the rest.
// Clamp each measurement to a band around the median before scaling.
const WIDTH_CLAMP = 0.12;

function parseArgs(argv) {
  const value = (flag, fallback) => {
    const i = argv.indexOf(flag);
    return i !== -1 && argv[i + 1] ? argv[i + 1] : fallback;
  };
  return {
    map: value("--map", null),
    out: value("--out", null),
    size: Number(value("--size", 900)),
    probe: value("--probe", null),
  };
}

/** Locate the crown, the head's width, and the chin, in source pixels. */
export async function headBox(file) {
  const img = sharp(file).rotate();
  const meta = await img.metadata();
  const h = Math.round((ANALYSIS_WIDTH * meta.height) / meta.width);
  const { data } = await img
    .clone()
    .resize(ANALYSIS_WIDTH, h)
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const at = (x, y) => data[y * ANALYSIS_WIDTH + x];

  // The wall: sample both top corners, which are always background.
  const corner = [];
  for (let y = 0; y < Math.round(h * 0.12); y++) {
    for (const x of [
      0,
      1,
      2,
      3,
      ANALYSIS_WIDTH - 4,
      ANALYSIS_WIDTH - 3,
      ANALYSIS_WIDTH - 2,
      ANALYSIS_WIDTH - 1,
    ]) {
      corner.push(at(x, y));
    }
  }
  corner.sort((a, b) => a - b);
  const wall = corner[Math.floor(corner.length / 2)];
  const isSubject = (x, y) => wall - at(x, y) > SUBJECT_DELTA;

  // Scan only the middle of the frame: these rooms have a dark doorway and
  // a grey floor at the edges, which a plain darker-than-wall test reads as
  // the sitter. Work in contiguous runs, not loose pixel counts, and accept
  // only runs that could plausibly be a head.
  const from = Math.round(ANALYSIS_WIDTH * 0.25);
  const to = Math.round(ANALYSIS_WIDTH * 0.75);
  const MIN_RUN = Math.round(ANALYSIS_WIDTH * 0.05);
  const MAX_RUN = Math.round(ANALYSIS_WIDTH * 0.35);

  const longestRun = (y) => {
    let best = null;
    let start = -1;
    for (let x = from; x <= to; x++) {
      const on = x < to && isSubject(x, y);
      if (on && start < 0) start = x;
      if (!on && start >= 0) {
        const run = { from: start, to: x - 1, len: x - start };
        if (!best || run.len > best.len) best = run;
        start = -1;
      }
    }
    return best;
  };

  const runs = [];
  for (let y = 0; y < h; y++) runs[y] = longestRun(y);

  const headLike = (r) => r && r.len >= MIN_RUN && r.len <= MAX_RUN;

  let top = -1;
  for (let y = 0; y < h - 5 && top < 0; y++) {
    if (!headLike(runs[y])) continue;
    if ([1, 2, 3, 4].every((k) => headLike(runs[y + k]))) top = y;
  }
  if (top < 0) top = Math.round(h * 0.08);

  const band = runs
    .slice(top + Math.round(h * 0.03), top + Math.round(h * 0.12))
    .filter(headLike);
  const headW = band.length
    ? band.reduce((m, r) => Math.max(m, r.len), 0)
    : Math.round(ANALYSIS_WIDTH * 0.16);
  const centreX = band.length
    ? Math.round(
        band.reduce((s, r) => s + (r.from + r.to) / 2, 0) / band.length,
      )
    : Math.round(ANALYSIS_WIDTH / 2);
  const rowXs = runs.map((r) => (r ? [r.from, r.to] : []));

  // Shoulders: where the silhouette suddenly grows much wider than the head.
  let chin = top + Math.round(headW * 1.35);
  for (let y = top + Math.round(headW * 0.9); y < h; y++) {
    const r = rowXs[y];
    if (r?.length && r[r.length - 1] - r[0] > headW * 1.9) {
      chin = y;
      break;
    }
  }

  const scale = meta.width / ANALYSIS_WIDTH;
  return {
    top: top * scale,
    centreX: centreX * scale,
    headW: headW * scale,
    chin: chin * scale,
    width: meta.width,
    height: meta.height,
  };
}

/** Square crop at the reference zoom, centred on the head. */
export function squareFrom(b) {
  let side = Math.round(b.headW * SIDE_PER_HEAD_WIDTH);
  side = Math.min(side, b.height, b.width);
  let top = Math.round(b.top - side * HEADROOM);
  let left = Math.round(b.centreX - side / 2);
  top = Math.max(0, Math.min(top, b.height - side));
  left = Math.max(0, Math.min(left, b.width - side));
  return { left, top, width: side, height: side };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.probe) {
    const b = await headBox(args.probe);
    const s = squareFrom(b);
    console.log(
      `crown ${((b.top / b.height) * 100).toFixed(1)}%  centre ${((b.centreX / b.width) * 100).toFixed(1)}%  ` +
        `head ${Math.round(b.headW)}px  ->  ${s.width}px square at ${s.left},${s.top}`,
    );
    return;
  }

  if (!args.map || !args.out) {
    console.error("need --map <json> and --out <dir>");
    process.exitCode = 1;
    return;
  }

  const map = JSON.parse(await readFile(args.map, "utf8"));
  await mkdir(args.out, { recursive: true });

  // Measure everyone first, so each crop can be sized against the group.
  const measured = [];
  for (const [src, name] of Object.entries(map)) {
    const b = await headBox(src);
    measured.push({ src, name, b, ratio: b.headW / b.width });
  }
  const ratios = measured.map((m) => m.ratio).sort((a, b) => a - b);
  const median = ratios[Math.floor(ratios.length / 2)];

  for (const { src, name, b, ratio } of measured) {
    const clamped = Math.min(
      Math.max(ratio, median * (1 - WIDTH_CLAMP)),
      median * (1 + WIDTH_CLAMP),
    );
    const s = squareFrom({ ...b, headW: clamped * b.width });
    const note =
      clamped !== ratio ? ` (clamped from ${Math.round(b.headW)}px)` : "";
    // Never enlarge: a few of these sitters were shot at 1200x800, and
    // upscaling them to the nominal size would invent detail that is not
    // there. Those stay at their native size and show up honestly in the
    // image-quality report.
    await sharp(src)
      .rotate()
      .extract(s)
      .resize(args.size, args.size, { withoutEnlargement: true })
      .jpeg({ quality: 86, mozjpeg: true })
      .toFile(join(args.out, `${name}.jpg`));
    const out = Math.min(args.size, s.width);
    console.log(
      `  ${name}: ${s.width}px square at ${s.left},${s.top} -> ${out}px${note}`,
    );
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main();
