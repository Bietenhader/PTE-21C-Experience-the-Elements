// SPDX-License-Identifier: CC-BY-NC-SA-4.0
import { readFileSync } from "node:fs";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// GitHub Pages serves the site under /<repo>/ (SPEC §17.3). Every build uses that base, so
// `npm run preview` and the end-to-end tests exercise exactly what is deployed.
export const PAGES_BASE = "/PTE-21C-Experience-the-Elements/";

const { version } = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as { version: string };

export default defineConfig(({ command, isPreview, isSsrBuild }) => ({
  base: command === "build" || isPreview ? PAGES_BASE : "/",
  plugins: [react()],
  define: { __APP_VERSION__: JSON.stringify(version) },
  // The SSR build only produces tools/prerender.mjs's renderer (src/prerender.tsx).
  build: { target: "es2022", sourcemap: !isSsrBuild, copyPublicDir: !isSsrBuild },
  test: { include: ["src/**/*.test.ts"], environment: "node" },
}));
