import js from "@eslint/js";
import tseslint from "typescript-eslint";
import eslintPluginAstro from "eslint-plugin-astro";
import globals from "globals";

export default [
  {
    ignores: [
      "dist/",
      ".astro/",
      ".netlify/",
      "temp/",
      "tools/",
      // Pagefind ships its search-index runtime as bundled, minified
      // JS into public/ during `npm run build`. It's not code we wrote
      // or maintain; linting it produces hundreds of no-undef errors
      // for browser/WASM globals (TextDecoder, WebAssembly, fetch …)
      // and uglified-name unused-var noise that drowns out real
      // warnings.
      "public/pagefind/",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...eslintPluginAstro.configs.recommended,
  {
    // Node-environment globals for the build scripts AND the Astro
    // config itself - astro.config.mjs runs in Node at build time, so
    // `process.env` and `URL` are perfectly legal there.
    files: ["scripts/**/*.mjs", "astro.config.mjs"],
    languageOptions: { globals: globals.node },
  },
];
