// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// The probability & statistics panel (SPEC §10.3).
import { expect, type Page, test } from "@playwright/test";
import { axeViolations, open } from "./helpers";

const current = (page: Page) => page.locator('[role="tabpanel"][data-current]');

async function openProbability(page: Page, symbol: string) {
  await open(page, `#/${symbol}/probability`);
  await expect(page.getByTestId("sheet")).toBeVisible();
  await expect(current(page).locator('[data-section="uncertainty"]')).toBeVisible();
}

test.describe("probability & statistics", () => {
  test("no console errors, Missing with reasons, no sideways scrolling, for a spread of elements", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (m) => m.type() === "error" && errors.push(`${page.url()}: ${m.text()}`));
    page.on("pageerror", (e) => errors.push(`${page.url()}: ${String(e)}`));
    for (const s of ["H", "He", "Li", "Na", "Rb", "Sr", "Cs", "Yb", "Al", "Hg", "Th", "U", "Og"]) {
      await openProbability(page, s);
      const panel = current(page);
      await expect(panel.getByTestId("radial-chart").locator("svg")).toBeVisible();
      const overflow = await panel.evaluate((el) => el.scrollWidth - el.clientWidth);
      expect(overflow, `${s}: the panel scrolls sideways`).toBeLessThanOrEqual(1);
      for (const reason of await panel.locator("[data-missing]").evaluateAll((els) => els.map((e) => e.getAttribute("data-missing")))) {
        expect(["not_measured", "not_applicable", "no_stable_isotope", "predicted_only", "source_unavailable_at_build"]).toContain(reason);
      }
    }
    expect(errors).toEqual([]);
  });

  test("where is the electron: the radius slider reads out the enclosed probability", async ({ page }) => {
    await openProbability(page, "Na");
    const panel = current(page);
    const readout = panel.getByTestId("within-readout");
    await expect(readout).toContainText("3s electron");
    const slider = panel.getByLabel("Within a radius of");
    await slider.focus();
    await page.keyboard.press("End");
    await expect(readout).toContainText(/probability (99|100)\.\d %/);
    await page.keyboard.press("Home");
    await expect(readout).toContainText("1 pm");
    await panel.getByRole("button", { name: "1s", exact: true }).click();
    await expect(readout).toContainText("1s electron");
  });

  test("rubidium: bosons with their condensates; the temperature slider and the cooling limits", async ({ page }) => {
    await openProbability(page, "Rb");
    const panel = current(page);
    await expect(panel.getByTestId("statistics")).toContainText("⁸⁷Rb: 87 + 37 = 124 fermions → boson");
    await expect(panel.getByTestId("statistics")).toContainText("Bose–Einstein condensate 1995");
    const readout = panel.getByTestId("temperature-readout");
    await expect(readout).toHaveText("300 K");
    await panel.getByRole("button", { name: /Doppler limit/ }).click();
    await expect(readout).toContainText("μK");
    await panel.getByRole("button", { name: "Recoil limit" }).click();
    await expect(readout).toContainText("nK");
    await panel.getByTestId("temperature").focus();
    await page.keyboard.press("End");
    await expect(readout).toHaveText("1000 K");
    await expect(panel.getByTestId("thermal-readouts")).toContainText("atoms per m³");
  });

  test("potassium-40 is a fermion with a degenerate Fermi gas", async ({ page }) => {
    await openProbability(page, "K");
    await expect(current(page).getByTestId("statistics")).toContainText(/⁴⁰K: .* → fermion/);
    await expect(current(page).getByTestId("statistics")).toContainText("degenerate Fermi gas 1999");
  });

  test("hydrogen's atomic weight is an interval, explained as a statistic", async ({ page }) => {
    await openProbability(page, "H");
    const mixture = current(page).locator('[data-section="mixture"]');
    await expect(mixture).toContainText("interval");
    await expect(mixture).toContainText("[1.00784, 1.00811] u");
    await expect(mixture).toContainText("is a statistic");
  });

  test("every chart can be shown as a table", async ({ page }) => {
    await openProbability(page, "Cs");
    for (const id of ["radial-chart", "speed-chart"]) {
      const frame = current(page).getByTestId(id);
      await frame.getByRole("button", { name: "Show as table" }).click();
      await expect(frame.getByRole("table")).toBeVisible();
    }
  });

  test("the uncertainty section names the most and least precisely known values", async ({ page }) => {
    await openProbability(page, "Cs");
    const p = current(page).getByTestId("precision");
    await expect(p).toContainText("Most precisely known");
    await expect(p).toContainText("Least precisely known");
    await expect(p).toContainText("exact by definition");
  });

  test("axe: the probability panel for Fe, Cs, U and Og", async ({ page }) => {
    for (const s of ["Fe", "Cs", "U", "Og"]) {
      await openProbability(page, s);
      expect(await axeViolations(page, '[role="tabpanel"][data-current]'), s).toEqual([]);
    }
  });
});
