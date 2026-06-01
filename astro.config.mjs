// @ts-check
import { defineConfig, fontProviders } from "astro/config";
import markdoc from "@astrojs/markdoc";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import netlify from "@astrojs/netlify";

// https://astro.build/config
export default defineConfig({
  site: "https://quinacare.org",
  output: "static",
  adapter: netlify({ imageCDN: false }),
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
  integrations: [markdoc(), sitemap()],
  vite: {
    plugins: [tailwindcss()],
  },
  i18n: {
    defaultLocale: "nl",
    locales: ["nl", "en", "es"],
    routing: {
      prefixDefaultLocale: false,
    },
  },
  redirects: {
    "/doneer": "/donate",
    "/doneer/quina-yura": "/yura-boom",
    "/doneer/demi-en-thomas": "/fundraisers/demi-en-thomas",
    "/blogs-vlogs": "/news",
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
