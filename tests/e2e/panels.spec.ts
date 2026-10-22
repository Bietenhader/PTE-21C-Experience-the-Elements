// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// The M3 property test (SPEC §17.5): every element on each of the batch-1 panels — orbitals,
// electromagnetic & ionization, spectrum, nucleus — renders without a console error, every Missing
// value names one of the five reasons (SPEC §5.3), and no "NaN", "undefined" or "[object Object]"
// reaches the screen; the ionization ladder draws every stage the data lists. Desktop only (the phone
// profile runs the same panels in their own specs).
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { open } from "./helpers";

const index = JSON.parse(readFileSync(new URL("../../public/data/index.json", import.meta.url), "utf8")) as {
  elements: Array<{ Z: number; symbol: string; name: string }>;
};
const PANELS = ["orbitals", "em", "spectrum", "nucleus"] as const;
const stages = (z: number) =>
  (
    JSON.parse(readFileSync(new URL(`../../public/data/elements/${z}.json`, import.meta.url), "utf8")) as {
      em: { ionizationEnergies: { stages: unknown[] } };
    }
  ).em.ionizationEnergies.stages.length;
const REASONS = ["not_measured", "not_applicable", "no_stable_isotope", "predicted_only", "source_unavailable_at_build"];

test.describe("M3 panels × 118 elements", () => {
  test.skip(({ browserName, isMobile }) => isMobile || browserName !== "chromium", "desktop Chromium only");

  for (const panel of PANELS) {
    test(`${panel}: all 118 elements, no console errors, every Missing with its reason`, async ({ page }) => {
      test.setTimeout(12 * 60_000);
      const errors: string[] = [];
      page.on("console", (m) => m.type() === "error" && errors.push(`${page.url()}: ${m.text()}`));
      page.on("pageerror", (e) => errors.push(`${page.url()}: ${String(e)}`));
      await open(page, `#/H/${panel}`);
      let missing = 0;
      for (const e of index.elements) {
        await page.evaluate((h) => {
          location.hash = h;
        }, `#/${e.symbol}/${panel}`);
        await expect(page.locator("#sheet-title")).toContainText(e.name);
        const current = page.locator(`[role="tabpanel"][data-current][data-slug="${panel}"]`);
        await expect(current.getByTestId("panel-sources"), `${e.symbol} ${panel}`).toBeVisible({ timeout: 20_000 });
        if (panel === "orbitals") {
          await expect(current.getByTestId("orbital-gallery")).toHaveAttribute("data-complete", "true", { timeout: 30_000 });
        }
        if (panel === "em") {
          // The ladder draws every stage NIST lists (all Z of them up to Z = 103), or says why there are none.
          const n = stages(e.Z);
          const ladder = current.locator('[data-section="ladder"]');
          if (n > 0) await expect(ladder.getByTestId("ionization-ladder").locator("svg circle"), `${e.symbol} ladder`).toHaveCount(n);
          else await expect(ladder.locator("[data-missing]")).toHaveCount(1);
        }
        const text = await current.innerText();
        expect(text, `${e.symbol} ${panel}`).not.toMatch(/\bNaN\b|\bundefined\b|\[object Object\]|\bInfinity\b/);
        const found = await current
          .locator("[data-missing]")
          .evaluateAll((els) => els.map((el) => [el.getAttribute("data-missing") ?? "", (el.textContent ?? "").trim()]));
        for (const [reason, said] of found) {
          expect(REASONS, `${e.symbol} ${panel}: Missing reason`).toContain(reason);
          expect(said?.length ?? 0, `${e.symbol} ${panel}: Missing text`).toBeGreaterThan(5);
        }
        missing += found.length;
      }
      test.info().annotations.push({ type: "Missing values shown", description: `${panel}: ${missing} across 118 elements` });
      expect(errors).toEqual([]);
    });
  }
});
