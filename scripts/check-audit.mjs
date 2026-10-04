#!/usr/bin/env node
/**
 * Runs `npm audit --omit=dev` and fails on any high/critical advisory
 * EXCEPT the ones explicitly allowlisted below. Replaces a plain
 * `npm audit --audit-level=high` in CI because two advisories currently
 * have no fixed release at all (the installed version is the latest
 * published one — confirmed via `npm view <pkg> versions`), so a flat
 * audit-level gate would permanently red CI with no way to fix it.
 *
 * Both allowlisted packages are Netlify CLI's own build/dev-time
 * tooling (bundling functions for deploy, and the local dev proxy) —
 * neither runs in our deployed serverless functions at request time.
 *
 * Re-check periodically: remove an entry once `npm audit` stops
 * reporting it (i.e. upstream ships a fix), and verify there isn't a
 * newer, still-unlisted advisory for the same package.
 *
 * Usage:
 *   node scripts/check-audit.mjs
 */

import { execSync } from "node:child_process";

// Keyed by GHSA advisory URL so a *different* future advisory on the
// same package is never silently allowed through.
const ALLOWLIST = new Map([
  [
    "https://github.com/advisories/GHSA-vfj7-8cjw-p6xm",
    {
      package: "braces",
      reason:
        "No fixed release exists yet (3.0.3 is latest and still vulnerable, checked 2026-10-04). " +
        "Reached only via @astrojs/netlify's build-time function-bundling " +
        "(@netlify/zip-it-and-ship-it -> fast-glob -> micromatch -> braces), " +
        "not part of the deployed runtime.",
    },
  ],
  [
    "https://github.com/advisories/GHSA-86w9-cpqp-85rv",
    {
      package: "node-forge",
      reason:
        "No fixed release exists yet (1.4.0 is latest and still vulnerable, checked 2026-10-04). " +
        "Reached only via @astrojs/netlify's local dev proxy tooling " +
        "(@netlify/images -> ipx -> listhen -> node-forge), not part of the deployed runtime.",
    },
  ],
]);

let report;
try {
  const out = execSync("npm audit --omit=dev --json", {
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 20,
  });
  report = JSON.parse(out);
} catch (err) {
  // npm audit exits non-zero when it finds anything — stdout still has
  // the JSON report we need.
  const out = err.stdout?.toString();
  if (!out) {
    console.error("npm audit did not return a report:", err.message);
    process.exit(1);
  }
  report = JSON.parse(out);
}

const unaddressed = [];

for (const [name, vuln] of Object.entries(report.vulnerabilities ?? {})) {
  if (vuln.severity !== "high" && vuln.severity !== "critical") continue;

  for (const via of vuln.via) {
    if (typeof via !== "object") continue; // a string entry just names a parent package
    const allowed = ALLOWLIST.get(via.url);
    if (allowed && allowed.package === name) continue;
    unaddressed.push({
      name,
      severity: vuln.severity,
      title: via.title,
      url: via.url,
    });
  }
}

if (unaddressed.length > 0) {
  console.error(
    `${unaddressed.length} high/critical advisor${unaddressed.length === 1 ? "y is" : "ies are"} not on the allowlist:\n`,
  );
  for (const v of unaddressed) {
    console.error(`  [${v.severity}] ${v.name}: ${v.title}\n    ${v.url}`);
  }
  console.error("\nRun `npm audit --omit=dev` for the full report.");
  process.exit(1);
}

console.log(
  `npm audit: clean, aside from ${ALLOWLIST.size} explicitly allowlisted advisor${ALLOWLIST.size === 1 ? "y" : "ies"} with no fix available yet:`,
);
for (const [url, info] of ALLOWLIST) {
  console.log(`  - ${info.package}: ${url}`);
}
