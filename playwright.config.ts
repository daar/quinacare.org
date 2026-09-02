import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  // These tests share one Astro dev server that mutates real content/media
  // on disk (Keystatic writes, uploads) and can trigger a Vite dependency
  // re-optimization + full reload the first time a route is visited in a
  // session — a server-wide event that isn't safe across parallel workers.
  // Force serial execution instead of Playwright's default auto-parallelism.
  workers: 1,
  use: {
    baseURL: "http://localhost:4321",
  },
  projects: [
    {
      name: "chrome",
      use: {
        ...devices["Desktop Chrome"],
        channel: "chrome",
      },
    },
  ],
  // Dev server must be running separately (npm run dev)
  webServer: {
    command: "npm run dev",
    url: "http://localhost:4321",
    reuseExistingServer: true,
    timeout: 60000,
  },
});
