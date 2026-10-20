// SPDX-License-Identifier: CC-BY-NC-SA-4.0
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// GitHub Pages serves the site under /<repo>/ (SPEC §17.3). Every build uses that base, so
// `npm run preview` and the end-to-end tests exercise exactly what is deployed.
export const PAGES_BASE = "/PTE-21C-Experience-the-Elements/";

export default defineConfig(({ command, isPreview }) => ({
  base: command === "build" || isPreview ? PAGES_BASE : "/",
  plugins: [react()],
  build: { target: "es2022", sourcemap: true },
  test: { include: ["src/**/*.test.ts"], environment: "node" },
}));
