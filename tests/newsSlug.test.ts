import { test } from "node:test";
import assert from "node:assert/strict";

import { resolveNewsSlug } from "../src/lib/newsSlug.ts";

test("resolveNewsSlug: uses the configured slug when present", () => {
  assert.equal(
    resolveNewsSlug({
      id: "en/2024/some-article",
      data: { slug: "custom-slug" },
    }),
    "custom-slug",
  );
});

test("resolveNewsSlug: trims whitespace around the configured slug", () => {
  assert.equal(
    resolveNewsSlug({
      id: "en/2024/some-article",
      data: { slug: "  custom-slug  " },
    }),
    "custom-slug",
  );
});

test("resolveNewsSlug: falls back to the last id segment when slug is blank", () => {
  assert.equal(
    resolveNewsSlug({ id: "en/2024/some-article", data: { slug: "   " } }),
    "some-article",
  );
});

test("resolveNewsSlug: falls back to the last id segment when slug is missing", () => {
  assert.equal(
    resolveNewsSlug({ id: "en/2024/some-article", data: {} }),
    "some-article",
  );
});

test("resolveNewsSlug: falls back to the last id segment when slug is an empty string", () => {
  assert.equal(
    resolveNewsSlug({ id: "en/2024/some-article", data: { slug: "" } }),
    "some-article",
  );
});

test("resolveNewsSlug: uses the whole id when it has no path separators", () => {
  assert.equal(
    resolveNewsSlug({ id: "some-article", data: {} }),
    "some-article",
  );
});

test("resolveNewsSlug: falls back to the id itself when it ends in a trailing slash", () => {
  // split("/").pop() on a trailing slash yields "", which the empty-length check rejects.
  assert.equal(resolveNewsSlug({ id: "en/2024/", data: {} }), "en/2024/");
});
