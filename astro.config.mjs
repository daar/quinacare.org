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
    // Resolved from the Turso 404 log (auto-generated).
    ...missesRedirects,
    // Payment-return safety net: Mollie historically redirected NL/ES donors
    // to the non-localized /donate/return, which 404'd. create-payment now
    // builds the native path, but keep these so in-flight / cached payment
    // returns still land on the right page (query string is preserved).
    "/donate/return": "/doneer/return",
    "/es/donate/return": "/es/donar/return",
    // Old WordPress ES contact slug.
    "/es/es-contacto": "/es/contacto",
    // Demi and Thomas ran for the Putumayo Loop, so their fundraiser was
    // merged into it (#144) and their page deleted. Each language keeps
    // its own slug, and each goes to the Putumayo Loop in that language.
    // "/doneer/demi-en-thomas" is the old WordPress URL, which used to
    // point at the fundraiser page and would now land on nothing.
    "/acties/demi-en-thomas": "/putumayo-loop",
    "/en/fundraisers/demi-and-thomas": "/en/putumayo-run",
    "/es/campañas/demi-y-thomas": "/es/putumayo-carrera",
    "/doneer/demi-en-thomas": "/putumayo-loop",
    // The bequest post moved from the news collection to a standalone page
    // under "What can you do"; keep the old published news URLs alive.
    // The EN and ES targets were the English words rather than the pages'
    // actual slugs, so both redirects landed visitors on a 404 — which is
    // how /es/legado turned up in the 404 log with Google as its referrer.
    "/actueel/nalatenschap": "/nalatenschap",
    "/en/news/bequest": "/en/legacy",
    "/es/noticias/legado": "/es/herencia",
    // Legacy WordPress URLs, retargeted to the native routes. Note:
    // /doneer is now the real NL donate page, so it no longer redirects.
    "/blogs-vlogs": "/actueel",
    "/doneer/anbi": "/doneer",
    "/doneer/andrea-halve-marathon": "/acties/andrea-halve-marathon",
    "/doneer/esmee-en-diana": "/acties/esmee-en-diana",
    "/doneer/karin-martens-maakt-operaties-mogelijk": "/acties/karin-martens",
    "/doneer/putumayo-loop-2025": "/putumayo-loop/2025",
    "/doneer/quina-yura": "/yura-boom",
    "/doneer/sponsor-booklet": "/sponsor-medewerker",
    "/fietsen-voor-hospital-san-miguel-2":
      "/acties/fietsen-voor-hospital-san-miguel",
    "/vrijwilligers": "/word-vrijwilliger",
    // Sponsor booklet moved from donate subroutes to standalone pages
    "/en/donate/sponsor-booklet": "/en/sponsor-a-staff-member",
    "/es/donar/sponsor-booklet": "/es/patrocinar-personal",

    // --- Resolved from issue #101 (curated, not from the auto-generated
    // 404 log) --------------------------------------------------------

    // Annual report PDFs from the old WordPress uploads folder — the
    // reports themselves are already hosted at their native paths.
    "/wp-content/uploads/2025/05/Jaarverslag-Quina-Care-2024.pdf":
      "/nl/jaarverslagen/Jaarverslag-Quina-Care-2024.pdf",
    "/wp-content/uploads/2024/06/Jaarverslag-Quina-Care-2023.pdf":
      "/nl/jaarverslagen/Jaarverslag-Quina-Care-2023.pdf",
    "/wp-content/uploads/2023/06/Jaarverslag-Quina-Care-2022.pdf":
      "/nl/jaarverslagen/Jaarverslag-Quina-Care-2022.pdf",

    // Old WordPress "about us" pages, retargeted per Yvonne's review.
    "/over-ons/wie-zijn-wij": "/over-ons",
    "/over-ons/beleidsplan": "/over-ons",
    "/over-ons/waarom-willen-we-dit": "/over-ons",
    "/wat-is-quina-care/quina-care": "/over-ons",
    "/wat-is-quina-care/beleid": "/over-ons",
    "/en/about-us/annual-report-and-policy-plan": "/en/annual-reports",
    "/en/about-us/en-media": "/en/news",
    "/en/what-is-quina-care/the-beginning": "/en/news/the-beginning",
    "/en/about-us/newsletter/2018-newsletter": "/en/news",
    "/en/en-blogs-vlogs/2018-blogs-vlogs": "/en/news",

    // Old sponsor-action URLs — the fundraiser kept a different working
    // title internally (Mollie donations were tagged "lopen-lopen-lopen"),
    // and "sponsorboekje" is the current "sponsor a staff member" page.
    "/doneer/lopen-lopen-lopen": "/acties/ellen-en-gerrit",
    "/doneer/van-amsterdam-tot-putumayo": "/acties/marathon-amsterdam-2021",
    "/doneer/sponsorboekje": "/sponsor-medewerker",

    // Old WordPress person pages ("-1"/"-2"/"-3" collision-cruft slugs).
    // Most go to the staff overview; three have a specific post instead.
    "/mercedes-lidia-dagua-noteno-1": "/personeelsleden",
    "/angelo-xavier-reyes-barco-2": "/personeelsleden",
    "/gema-karolina-zambrano-garcia-3": "/personeelsleden",
    "/maria-vanessa-davila-campos-3": "/personeelsleden",
    "/nl-andrea-diaz-saenz": "/personeelsleden",
    "/es/es-rosa-perez-tobar": "/es/personal",
    "/hanna-hazenberg-3": "/actueel/hanna-hazenberg",
    "/cootjebouwman-zaaijer": "/actueel/cootje-bouwman-zaaijer",
    "/en/baukje-zaaijer-2": "/en/news/baukje-zaaijer",

    // Small confirmed fixes: a typo, an old contact path, and old blog
    // paths that moved into the news collection.
    "/putomayo-loop": "/putumayo-loop",
    "/en/en-contact": "/en/contact",
    "/blogs-vlogs/rotterdam-marathon": "/acties/rotterdam-marathon",
    "/blogs-vlogs/nuevo-rocafuerte-is-de-wereld":
      "/actueel/nuevo-rocafuerte-is-de-wereld",
    "/en/en-blogs-vlogs/renovation-started": "/en/news/renovation-started",
    "/en/en-blogs-vlogs/en-ricardo-salazar": "/en/news/ricardo-salazar",
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
