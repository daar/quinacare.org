// @ts-check
import { defineConfig, fontProviders } from "astro/config";
import sharp from "sharp";
import markdoc from "@astrojs/markdoc";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import netlify from "@astrojs/netlify";
import react from "@astrojs/react";
import keystatic from "@keystatic/astro";
import missesRedirects from "./src/data/missesRedirects.mjs";

// Keep the build-time image-optimization pass within the Netlify
// container's memory. Source images are already capped to a sane size
// (scripts/resize-images.mjs + the pre-commit hook), so this is just
// insurance: a single-threaded, cacheless libvips avoids it retaining
// decoded buffers across the many images Astro optimizes in parallel.
// These are global, static Sharp settings shared with Astro's image
// service (same process, same module).
sharp.concurrency(1);
sharp.cache(false);

// https://astro.build/config
export default defineConfig({
  site: "https://quinacare.org",
  output: "static",
  adapter: netlify({
    imageCDN: false,
    // The adapter emulates Netlify Edge Functions during `astro dev`,
    // which needs a local Deno runtime. This project has no edge
    // functions — no netlify/edge-functions directory and no edge
    // middleware — so the emulator has nothing to serve, and on a
    // machine without Deno it only produces an unhandled rejection:
    // "Could not establish a connection to the Netlify Edge Functions
    // local development server". Turn it off; re-enable it (and install
    // Deno) if edge functions are ever added.
    devFeatures: {
      edgeFunctions: false,
      images: true,
      environmentVariables: false,
    },
  }),
  // Astro's default checkOrigin guard rejects every POST without a
  // matching Origin header. Mollie's webhook calls don't send one,
  // so every payment webhook was being silently 403'd — leaving
  // recurring donations stuck without their Mollie subscription
  // and one-time payments unconfirmed until the hourly cron caught
  // up. Our POST endpoints carry their own auth (Mollie webhook
  // re-fetches the payment from Mollie's authenticated API; cron
  // is x-cron-secret-gated), so this guard isn't the right tool
  // here. Disable it globally.
  security: { checkOrigin: false },
  integrations: [markdoc(), sitemap(), react(), keystatic()],
  vite: {
    plugins: [tailwindcss()],
    server: {
      // Vite blocks any Host header that doesn't match localhost by
      // default. When PUBLIC_WEBHOOK_ORIGIN points at an ngrok /
      // cloudflared tunnel so Mollie can reach our webhook, requests
      // to `https://<random>.ngrok-free.dev` get a "Blocked request"
      // page instead of the dev server. Whitelist the tunnel host
      // taken from that env var, plus the standard tunnel-provider
      // suffixes as a belt-and-braces fallback when the env var is
      // not set but a tunnel is still in use.
      allowedHosts: [
        ...(process.env.PUBLIC_WEBHOOK_ORIGIN
          ? [new URL(process.env.PUBLIC_WEBHOOK_ORIGIN).hostname]
          : []),
        ".ngrok-free.app",
        ".ngrok-free.dev",
        ".ngrok.io",
        ".trycloudflare.com",
      ],
    },
  },
  i18n: {
    defaultLocale: "nl",
    locales: ["nl", "en", "es"],
    routing: {
      prefixDefaultLocale: false,
    },
  },
  redirects: {
    ...missesRedirects,
  },
  fonts: [
    {
      provider: fontProviders.google(),
      name: "Arimo",
      cssVariable: "--astro-font-arimo",
      weights: [400, 500, 600, 700],
      styles: ["normal"],
      subsets: ["latin"],
    },
    {
      provider: fontProviders.google(),
      name: "Cormorant Garamond",
      cssVariable: "--astro-font-cormorant",
      weights: [300],
      styles: ["italic"],
      subsets: ["latin"],
    },
    {
      provider: fontProviders.local(),
      name: "Effra",
      cssVariable: "--astro-font-effra",
      options: {
        variants: [
          {
            weight: 400,
            style: "normal",
            src: ["./src/assets/fonts/Effra_Lt.ttf"],
          },
        ],
      },
    },
  ],
  image: {
    layout: "constrained",
  },
});
