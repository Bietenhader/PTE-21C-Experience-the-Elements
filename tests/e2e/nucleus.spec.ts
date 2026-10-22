// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// The nucleus & isotopes panel (SPEC §10.7).
import { expect, type Page, test } from "@playwright/test";
import { axeViolations, open } from "./helpers";

const current = (page: Page) => page.locator('[role="tabpanel"][data-current]');

async function openNucleus(page: Page, symbol: string) {
  await open(page, `#/${symbol}/nucleus`);
  await expect(page.getByTestId("sheet")).toBeVisible();
  await expect(current(page).getByTestId("isotope-record")).toBeVisible();
}

test.describe("nucleus & isotopes", () => {
  test("renders for Fe, U, Og, H and Th without console errors or sideways scrolling", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    page.on("pageerror", (e) => errors.push(String(e)));
    for (const s of ["Fe", "U", "Og", "H", "Th"]) {
      await openNucleus(page, s);
      const panel = current(page);
      await expect(panel.getByTestId("isotope-strip").locator("svg")).toBeVisible();
      await expect(panel.locator('[data-section="origin"]')).toBeVisible();
      const overflow = await panel.evaluate((el) => el.scrollWidth - el.clientWidth);
      expect(overflow, `${s}: the panel scrolls sideways`).toBeLessThanOrEqual(1);
    }
    expect(errors).toEqual([]);
  });

  test("Fe opens on iron-56; the list and the chart both change the record", async ({ page }) => {
    await openNucleus(page, "Fe");
    const panel = current(page);
    const record = panel.getByTestId("isotope-record");
    await expect(record).toContainText("⁵⁶Fe");
    await panel.getByLabel("Isotope", { exact: true }).selectOption("54");
    await expect(record).toContainText("⁵⁴Fe");
    await expect(panel.getByRole("heading", { name: "How ⁵⁴Fe decays" })).toBeVisible();
    await panel.getByTestId("isotope-strip").locator('g[data-a="60"] rect').click();
    await expect(record).toContainText("⁶⁰Fe");
    await expect(panel.getByTestId("decay-modes")).toContainText("β⁻ decay");
  });

  test("a stable isotope has nothing to decay", async ({ page }) => {
    await openNucleus(page, "H");
    const panel = current(page);
    await expect(panel.getByTestId("isotope-record")).toContainText("¹H");
    await expect(panel.locator('[data-section="decay"]')).toContainText("nothing to decay");
    await expect(panel.getByTestId("survival-readout")).toHaveCount(0);
  });

  test("the survival readout gives 0.5 at one half-life and 0.25 at two", async ({ page }) => {
    await openNucleus(page, "U");
    const panel = current(page);
    await expect(panel.getByTestId("isotope-record")).toContainText("²³⁸U");
    const readout = panel.getByTestId("survival-readout");
    await expect(readout).toHaveText(/^0\.5000 /);
    const time = panel.getByLabel(/Probability that a given/);
    const oneHalfLife = Number(await time.inputValue());
    await time.fill(String(2 * oneHalfLife));
    await expect(readout).toHaveText(/^0\.2500 /);
    await time.fill("0");
    await expect(readout).toHaveText(/^1\.000 /);
    // Same moment in another unit: the probability does not change.
    await time.fill(String(oneHalfLife));
    await panel.getByLabel("Time unit").selectOption("d");
    await time.fill(String(oneHalfLife * 365.25));
    await expect(readout).toHaveText(/^0\.5000 /);
  });

  test("every chart can be shown as a table", async ({ page }) => {
    await openNucleus(page, "Fe");
    const strip = current(page).getByTestId("isotope-strip");
    await strip.getByRole("button", { name: "Show as table" }).click();
    await expect(strip.getByRole("table")).toBeVisible();
    await expect(strip.getByRole("rowheader", { name: "⁵⁶Fe", exact: true })).toBeVisible();
    await expect(strip.getByRole("button", { name: "Hide table" })).toHaveAttribute("aria-expanded", "true");
    const binding = current(page).getByTestId("binding-chart");
    await binding.getByRole("button", { name: "Show as table" }).click();
    await expect(binding.getByRole("table")).toContainText("8.79");
  });

  test("thorium: the nuclear clock, E = hν and the timeline", async ({ page }) => {
    await openNucleus(page, "Th");
    const th = current(page).locator('[data-section="thorium"]');
    await expect(th).toBeVisible();
    await expect(th).toContainText(/8\.355\s?733\s?554/); // E = hν from the frequency, digits grouped in threes
    await expect(th).toContainText("about 8.36 eV");
    await expect(th.getByRole("link", { name: "doi:10.1038/s41586-024-07839-6" }).first()).toBeVisible();
    await expect(th.locator("li")).not.toHaveCount(0);
  });

  test("the cosmic origin is flagged as approximate; missing origins say why", async ({ page }) => {
    await openNucleus(page, "Fe");
    await expect(current(page).locator('[data-section="origin"]')).toContainText("approximation");
    await expect(current(page).getByTestId("origin-bar")).toBeVisible();
    await openNucleus(page, "Og");
    await expect(current(page).getByTestId("origin-bar")).toHaveCount(0);
  });

  test("axe: the nucleus panel for Fe, Cs, U and Og", async ({ page }) => {
    for (const s of ["Fe", "Cs", "U", "Og"]) {
      await openNucleus(page, s);
      expect(await axeViolations(page), s).toEqual([]);
    }
  });
});
