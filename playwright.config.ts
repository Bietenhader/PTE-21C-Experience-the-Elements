// SPDX-License-Identifier: CC-BY-NC-SA-4.0
import { defineConfig, devices } from "@playwright/test";

const PORT = 4173;
export const BASE_URL = `http://localhost:${PORT}/PTE-21C-Experience-the-Elements/`;

// M0 runs Chromium desktop and an Android phone profile. The full matrix (WebKit, Firefox,
// iPhone) is added with the nightly job in M1 (SPEC §13.3, §17.2).
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: { baseURL: BASE_URL, trace: "retain-on-failure" },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1000 } } },
    { name: "phone-chromium", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
