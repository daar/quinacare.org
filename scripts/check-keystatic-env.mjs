#!/usr/bin/env node

if (process.env.NETLIFY === "true" && process.env.CONTEXT === "production") {
  const required = [
    "KEYSTATIC_GITHUB_CLIENT_ID",
    "KEYSTATIC_GITHUB_CLIENT_SECRET",
    "KEYSTATIC_SECRET",
    "PUBLIC_KEYSTATIC_GITHUB_APP_SLUG",
  ];
  const missing = required.filter((name) => !process.env[name]?.trim());

  if (missing.length > 0) {
    console.error(
      `Missing Keystatic environment variables for the Netlify production deploy:\n${missing.map((name) => `- ${name}`).join("\n")}`,
    );
    process.exit(1);
  }

  if (process.env.KEYSTATIC_SECRET.length < 32) {
    console.error("KEYSTATIC_SECRET must be at least 32 characters long.");
    process.exit(1);
  }
}
