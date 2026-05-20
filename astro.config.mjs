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
  adapter: netlify(),
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
