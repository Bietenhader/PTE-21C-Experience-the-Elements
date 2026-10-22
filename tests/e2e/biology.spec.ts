// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// The biology & ecology panel (SPEC §10.10).
import { expect, type Page, test } from "@playwright/test";
import { axeViolations, open } from "./helpers";

const current = (page: Page) => page.locator('[role="tabpanel"][data-current]');

async function openBiology(page: Page, symbol: string) {
  await open(page, `#/${symbol}/biology`);
  await expect(page.getByTestId("sheet")).toBeVisible();
  await expect(current(page).getByTestId("need-plants")).toBeVisible();
}

test.describe("biology & ecology", () => {
  test("renders for H, C, N, P, K, Fe, Tc, I, Gd, Pu and Og without console errors or sideways scrolling", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    page.on("pageerror", (e) => errors.push(String(e)));
    for (const s of ["H", "C", "N", "P", "K", "Fe", "Tc", "I", "Gd", "Pu", "Og"]) {
      await openBiology(page, s);
      const panel = current(page);
      await expect(panel.getByTestId("need-humans")).toBeVisible();
      await expect(panel.getByTestId("body-content")).toBeVisible();
      await expect(panel.getByTestId("panel-sources")).toBeVisible();
      const overflow = await panel.evaluate((el) => el.scrollWidth - el.clientWidth);
      expect(overflow, `${s}: the panel scrolls sideways`).toBeLessThanOrEqual(1);
    }
    expect(errors).toEqual([]);
  });

  test("iron: a plant micronutrient, essential for people, 4.2 g in the reference body", async ({ page }) => {
    await openBiology(page, "Fe");
    const panel = current(page);
    await expect(panel.getByTestId("need-plants")).toContainText("Plants: Essential");
    await expect(panel.getByTestId("need-plants")).toContainText("micronutrient");
    await expect(panel.getByTestId("need-humans")).toContainText("Humans: Essential");
    await expect(panel.getByTestId("need-humans")).toContainText("haemoglobin");
    await expect(panel.getByTestId("body-content")).toContainText("4.2");
    await expect(panel.getByTestId("body-content")).toContainText("70 kg reference adult");
  });

  test("a missing amount says why; a missing toxicity note is not called safe", async ({ page }) => {
    await openBiology(page, "Tc");
    const panel = current(page);
    await expect(panel.getByTestId("body-content").locator('[data-missing="not_measured"]')).toBeVisible();
    await expect(panel.getByTestId("toxicity")).toContainText("does not mean it is safe");
  });

  test("isotope uses are grouped by field, named for screen readers and cite their papers", async ({ page }) => {
    await openBiology(page, "C");
    const uses = current(page).getByTestId("isotope-uses");
    await expect(uses.locator("li")).toHaveCount(3);
    await expect(uses.locator("li").first()).toHaveAttribute("data-field", "tracer");
    await expect(uses).toContainText("carbon-14");
    await expect(uses).toContainText("Dating");
    await expect(uses.getByRole("link", { name: "doi:10.1126/science.110.2869.678" })).toBeVisible();

    await openBiology(page, "Tc");
    await expect(current(page).getByTestId("isotope-uses")).toContainText("technetium-99m");
    await expect(current(page).getByTestId("isotope-uses")).toContainText("Medicine");
  });

  test("lead: a WHO note and IARC groups read from the IARC list", async ({ page }) => {
    await openBiology(page, "Pb");
    const panel = current(page);
    await expect(panel.getByTestId("toxicity")).toContainText("young children");
    const iarc = panel.getByTestId("iarc");
    await expect(iarc.getByRole("row", { name: /Lead compounds, inorganic/ })).toContainText("Group 2A");
    await expect(iarc.getByRole("rowheader", { name: "Lead", exact: true })).toBeVisible();
  });

  test("cadmium: soils and food webs", async ({ page }) => {
    await openBiology(page, "Cd");
    await expect(current(page).getByTestId("environment")).toContainText("phosphate fertilisers");
    await expect(current(page).getByTestId("iarc")).toContainText("Group 1");
  });

  test("axe: the biology panel for Fe, Cs, U and Og", async ({ page }) => {
    for (const s of ["Fe", "Cs", "U", "Og"]) {
      await openBiology(page, s);
      expect(await axeViolations(page), s).toEqual([]);
    }
  });
});
