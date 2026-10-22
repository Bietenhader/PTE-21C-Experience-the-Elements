// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// The AMO & metrology panel (SPEC §10.6) and its M4 acceptance criterion (SPEC §18): it shows the
// hyperfine, clock and laser-cooling data for Cs, Rb, Sr, Yb, Al, Hg and Th, and not_applicable
// reasons where physics forbids hyperfine structure (helium: J = 0).
import { readFileSync } from "node:fs";
import { expect, type Page, test } from "@playwright/test";
import { axeViolations, open } from "./helpers";

const index = JSON.parse(readFileSync(new URL("../../public/data/index.json", import.meta.url), "utf8")) as {
  elements: Array<{ Z: number; symbol: string }>;
};
const amo = (symbol: string) => {
  const z = index.elements.find((e) => e.symbol === symbol)?.Z ?? 0;
  return (
    JSON.parse(readFileSync(new URL(`../../public/data/elements/${z}.json`, import.meta.url), "utf8")) as {
      amo: { hyperfine: unknown[]; clocks: unknown[]; laserCooling: unknown[]; siHistory: unknown[] };
    }
  ).amo;
};

const current = (page: Page) => page.locator('[role="tabpanel"][data-current]');

async function openAmo(page: Page, symbol: string) {
  await open(page, `#/${symbol}/amo`);
  await expect(page.getByTestId("sheet")).toBeVisible();
  await expect(current(page).getByTestId("second-timeline")).toBeVisible();
}

function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(`${page.url()}: ${m.text()}`));
  page.on("pageerror", (e) => errors.push(`${page.url()}: ${String(e)}`));
  return errors;
}

test.describe("AMO & metrology", () => {
  for (const s of ["Cs", "Rb", "Sr", "Yb", "Al", "Hg", "Th"]) {
    test(`${s}: every hyperfine row, clock and laser-cooling line in the data is shown`, async ({ page }) => {
      const errors = collectErrors(page);
      const data = amo(s);
      await openAmo(page, s);
      const panel = current(page);
      await expect(panel.getByTestId("hyperfine-row")).toHaveCount(data.hyperfine.length);
      if (data.hyperfine.length === 0) await expect(panel.getByTestId("no-hyperfine").locator("[data-missing]")).toHaveCount(1);
      await expect(panel.getByTestId("clock-table").locator("tbody tr")).toHaveCount(data.clocks.length);
      await expect(panel.getByTestId("cooling-row")).toHaveCount(data.laserCooling.length);
      if (data.laserCooling.length === 0) await expect(panel.getByTestId("no-cooling")).toBeVisible();
      expect(errors).toEqual([]);
    });
  }

  test("caesium: the second's definition, the F = 3 and F = 4 levels, and the computed cooling limits", async ({ page }) => {
    await openAmo(page, "Cs");
    const panel = current(page);
    await expect(panel.getByTestId("clock-table")).toContainText("defines the SI second (1967–)");
    await expect(panel.getByRole("img", { name: /F levels of ¹³³Cs: F = 3, F = 4/ })).toBeVisible();
    const cooling = panel.getByTestId("cooling-row").first();
    await expect(cooling).toContainText("Doppler limit");
    await expect(cooling).toContainText("125.2 μK");
    await expect(cooling).toContainText("198.3 nK");
    await expect(panel.getByTestId("second-timeline").locator("li[data-mine]")).toHaveCount(2);
  });

  test("helium: no ground-state hyperfine structure, and the reason is that J = 0", async ({ page }) => {
    await openAmo(page, "He");
    const none = current(page).getByTestId("no-hyperfine");
    await expect(none.locator('[data-missing="not_applicable"]')).toContainText("J = 0");
    await expect(current(page).getByTestId("cooling-row").first()).toContainText("metastable");
  });

  test("thorium: the nuclear clock is in the table; uranium and oganesson have no clocks and say so", async ({ page }) => {
    await openAmo(page, "Th");
    await expect(current(page).getByTestId("clock-table")).toContainText("nuclear transition");
    for (const s of ["U", "Og"]) {
      await openAmo(page, s);
      await expect(current(page).getByTestId("no-clock")).toBeVisible();
      await expect(current(page).getByTestId("no-cooling")).toBeVisible();
    }
  });

  test("no console errors and no sideways scrolling for a spread of elements", async ({ page }) => {
    const errors = collectErrors(page);
    for (const s of ["H", "He", "Li", "Na", "Rb", "Sr", "Cs", "Yb", "Al", "Hg", "Th", "U", "Og"]) {
      await openAmo(page, s);
      const panel = current(page);
      const overflow = await panel.evaluate((el) => el.scrollWidth - el.clientWidth);
      expect(overflow, `${s}: the panel scrolls sideways`).toBeLessThanOrEqual(1);
      for (const reason of await panel.locator("[data-missing]").evaluateAll((els) => els.map((e) => e.getAttribute("data-missing")))) {
        expect(["not_measured", "not_applicable", "no_stable_isotope", "predicted_only", "source_unavailable_at_build"]).toContain(reason);
      }
    }
    expect(errors).toEqual([]);
  });

  test("axe: the AMO panel for Fe, Cs, U and Og", async ({ page }) => {
    for (const s of ["Fe", "Cs", "U", "Og"]) {
      await openAmo(page, s);
      expect(await axeViolations(page, '[role="tabpanel"][data-current]'), s).toEqual([]);
    }
  });
});
