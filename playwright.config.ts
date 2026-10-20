// SPDX-License-Identifier: CC-BY-NC-SA-4.0
import { defineConfig, devices } from "@playwright/test";

const PORT = 4173;
export const BASE_URL = `http://localhost:${PORT}/PTE-21C-Experience-the-Elements/`;

// Every push runs Chromium on desktop and an Android phone profile; the nightly job
// (.github/workflows/nightly.yml, PW_ALL_BROWSERS=1) adds Firefox, WebKit and an iPhone
// (SPEC §13.3, §17.2).
const chromium = [
  { name: "desktop-chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1000 } } },
  { name: "phone-chromium", use: { ...devices["Pixel 7"] } },
];
const others = [
  { name: "desktop-firefox", use: { ...devices["Desktop Firefox"], viewport: { width: 1440, height: 1000 } } },
  { name: "desktop-webkit", use: { ...devices["Desktop Safari"], viewport: { width: 1440, height: 1000 } } },
  { name: "phone-webkit", use: { ...devices["iPhone 15"] } },
];

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: { baseURL: BASE_URL, trace: "retain-on-failure" },
  projects: process.env.PW_ALL_BROWSERS ? [...chromium, ...others] : chromium,
  webServer: {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
