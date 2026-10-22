// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// The physical & engineering panel (SPEC §10.4): renders for a spread of elements, says why values are
// missing, offers every chart as a table, draws the unit cell of the common structure types, keeps the
// three.js chunk out of the first load, and passes axe.
import { expect, type Page, test } from "@playwright/test";
import { axeViolations, open } from "./helpers";

const current = (page: Page) => page.locator('[role="tabpanel"][data-current]');

async function openPhysical(page: Page, symbol: string) {
  await open(page, `#/${symbol}/physical`);
  await expect(page.getByTestId("sheet")).toBeVisible();
  await expect(current(page).getByTestId("panel-sources")).toBeVisible();
}

function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(String(e)));
  return errors;
}

test.describe("physical & engineering", () => {
  test("renders for H, He, C, Na, Fe, Hg, U and Og without console errors or sideways scrolling", async ({ page }) => {
    const errors = collectErrors(page);
    for (const s of ["H", "He", "C", "Na", "Fe", "Hg", "U", "Og"]) {
      await openPhysical(page, s);
      const panel = current(page);
      for (const id of ["state", "heat", "crystal", "allotropes", "abundance", "production", "uses", "hazards", "not-compiled"]) {
        await expect(panel.locator(`[data-section="${id}"]`), `${s}: section ${id}`).toBeAttached();
      }
      expect(await panel.getByTestId("uses").locator("li").count(), `${s}: uses`).toBeGreaterThanOrEqual(2);
      const overflow = await panel.evaluate((el) => el.scrollWidth - el.clientWidth);
      expect(overflow, `${s}: the panel scrolls sideways`).toBeLessThanOrEqual(1);
    }
    expect(errors).toEqual([]);
  });

  test("iron: heat capacity and its specific value with the formula, GHS diamond, the EU flag, a dated price", async ({ page }) => {
    await openPhysical(page, "Fe");
    const panel = current(page);
    await expect(panel.locator('[data-section="heat"]')).toContainText("25.1 J/(mol·K)");
    await expect(panel.getByTestId("specific-heat")).toContainText("0.4495 J/(g·K)");
    await expect(panel.getByTestId("specific-heat").locator(".katex")).toBeVisible();
    const hazards = panel.getByTestId("hazards");
    await expect(hazards.getByRole("list", { name: "GHS pictograms" })).toContainText("GHS02: Flammable");
    await expect(hazards).toContainText("Signal word: Danger");
    await expect(hazards).toContainText("Most of the reports (74.1 %");
    await expect(panel.getByTestId("crm-flag")).toContainText("Not on the EU list");
    await expect(panel.locator('[data-section="production"]')).toContainText("Unit value, 2025");
  });

  test("missing values say why, and what is not compiled is listed plainly", async ({ page }) => {
    await openPhysical(page, "Og");
    let panel = current(page);
    await expect(panel.locator('[data-section="state"] [data-missing="predicted_only"]')).toBeVisible();
    await expect(panel.locator('[data-section="heat"] [data-missing="not_measured"]').first()).toContainText("Never made in a weighable amount");
    await expect(panel.locator('[data-section="hazards"] [data-missing="not_applicable"]')).toBeVisible();
    await expect(panel.locator('[data-section="crystal"] [data-missing]')).toBeVisible();
    await expect(panel.getByTestId("not-compiled")).toContainText("Thermal conductivity");
    await expect(panel.getByTestId("uses")).toContainText("No use outside research");

    await openPhysical(page, "Rn");
    panel = current(page);
    await expect(panel.getByTestId("specific-heat").locator('[data-missing="no_stable_isotope"]')).toBeVisible();
    await expect(panel.locator('[data-section="hazards"] [data-missing="not_measured"]')).toContainText("radioactivity");
  });

  test("the abundance chart can be shown as a table", async ({ page }) => {
    await openPhysical(page, "Fe");
    const chart = current(page).getByTestId("abundance-chart");
    await expect(chart.locator("svg")).toBeVisible();
    await chart.getByRole("button", { name: "Show as table" }).click();
    const table = chart.getByRole("table");
    await expect(table.getByRole("row", { name: /Earth's crust/ })).toContainText("56");
    await expect(table.getByRole("row", { name: /Human body/ })).toContainText("60 mg/kg");
    await chart.getByRole("button", { name: "Hide table" }).click();
    await expect(chart.getByRole("table")).toHaveCount(0);
  });

  for (const [symbol, kind, atoms] of [
    ["Fe", "body-centred cubic", 9],
    ["Cu", "face-centred cubic", 14],
    ["Mg", "hexagonal close-packed", 9],
    ["Si", "diamond cubic", 18],
  ] as const) {
    test(`${symbol}: the unit cell (${kind}) is drawn and turns`, async ({ page }) => {
      const errors = collectErrors(page);
      await openPhysical(page, symbol);
      const cell = current(page).getByTestId("unit-cell");
      await expect(cell.locator("[data-drawn=true]")).toBeAttached({ timeout: 30_000 });
      await expect(cell.locator(`[data-atoms="${atoms}"]`)).toBeAttached();
      await expect(cell.getByRole("img", { name: new RegExp(`Unit cell of .*${kind}`) })).toBeVisible();
      await cell.getByRole("button", { name: "Turn left" }).click();
      await cell.getByRole("button", { name: "Reset view" }).click();
      await cell.getByRole("button", { name: "Show as table" }).click();
      await expect(cell.getByRole("table").locator("tbody tr")).toHaveCount(atoms);
      expect(errors).toEqual([]);
    });
  }

  test("three.js is not loaded until a 3D view is shown", async ({ page }) => {
    const scripts: string[] = [];
    page.on("request", (r) => r.resourceType() === "script" && scripts.push(r.url()));
    await open(page);
    expect(scripts.filter((u) => /UnitCell|OrbitalViewer/.test(u))).toEqual([]);
    await page.goto("./#/Fe/physical");
    await expect(current(page).getByTestId("unit-cell").locator("[data-drawn=true]")).toBeAttached({ timeout: 30_000 });
    expect(scripts.some((u) => /UnitCell/.test(u))).toBe(true);
  });

  test("axe: no serious or critical violations for Fe, Cs, U and Og", async ({ page }) => {
    test.setTimeout(120_000);
    for (const s of ["Fe", "Cs", "U", "Og"]) {
      await openPhysical(page, s);
      expect(await axeViolations(page), s).toEqual([]);
    }
  });
});
