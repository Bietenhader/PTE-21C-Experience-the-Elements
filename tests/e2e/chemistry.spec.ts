// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// The chemistry & bonding panel (SPEC §10.9).
import { expect, type Page, test } from "@playwright/test";
import { axeViolations, open } from "./helpers";

const current = (page: Page) => page.locator('[role="tabpanel"][data-current]');

async function openChemistry(page: Page, symbol: string) {
  await open(page, `#/${symbol}/chemistry`);
  await expect(page.getByTestId("sheet")).toBeVisible();
  await expect(current(page).locator('[data-section="oxidation"]')).toBeVisible();
}

test.describe("chemistry & bonding", () => {
  test("renders for H, C, Na, Fe, Cu, Xe, U and Og without console errors or sideways scrolling", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    page.on("pageerror", (e) => errors.push(String(e)));
    for (const s of ["H", "C", "Na", "Fe", "Cu", "Xe", "U", "Og"]) {
      await openChemistry(page, s);
      const panel = current(page);
      for (const id of ["oxidation", "radii", "en", "bonding", "compounds", "reactivity", "coordination"]) {
        await expect(panel.locator(`[data-section="${id}"]`), `${s}: ${id}`).toBeVisible();
      }
      await expect(panel.getByTestId("panel-sources")).toBeVisible();
      const overflow = await panel.evaluate((el) => el.scrollWidth - el.clientWidth);
      expect(overflow, `${s}: the panel scrolls sideways`).toBeLessThanOrEqual(1);
    }
    expect(errors).toEqual([]);
  });

  test("iron: common states in bold with an example each, compounds with formulas, reactions with sources", async ({ page }) => {
    await openChemistry(page, "Fe");
    const panel = current(page);
    await expect(panel.getByTestId("oxidation-states").locator("strong")).toHaveText(["+3", "+2"]);
    const examples = panel.getByTestId("oxidation-examples");
    await expect(examples.locator('li[data-state="3"]')).toContainText("FeCl₃");
    await expect(examples.locator('li[data-state="2"]')).toContainText("FeSO₄");
    await expect(panel.getByTestId("compounds")).toContainText("Fe₂O₃");
    await expect(panel.locator('[data-section="bonding"] [data-bonding="metallic"]')).toBeVisible();
    const reactivity = panel.getByTestId("reactivity");
    await expect(reactivity.locator("dt")).toHaveText(["With air", "With water", "With acids"]);
    await expect(reactivity.getByRole("button")).toHaveCount(3); // one source chip per note
    await expect(panel.getByTestId("coordination")).toContainText("Fe³⁺, high spin");
  });

  test("the size ladder can be shown as a table", async ({ page }) => {
    await openChemistry(page, "Fe");
    const ladder = current(page).getByTestId("size-ladder");
    await expect(ladder.locator("svg")).toBeVisible();
    await expect(ladder.locator('g[data-kind="ionic"]')).toHaveCount(4);
    await ladder.getByRole("button", { name: "Show as table" }).click();
    const table = ladder.getByRole("table");
    await expect(table).toBeVisible();
    await expect(table.getByRole("rowheader", { name: "Fe³⁺ ionic, 6-coordinate, high spin" })).toBeVisible();
    await expect(table).toContainText("64.5");
    await expect(table).toContainText("194");
    await expect(ladder.getByRole("button", { name: "Hide table" })).toHaveAttribute("aria-expanded", "true");
  });

  test("missing chemistry says why", async ({ page }) => {
    await openChemistry(page, "Og");
    const panel = current(page);
    await expect(panel.locator('[data-section="bonding"] [data-missing="predicted_only"]')).toBeVisible();
    await expect(panel.locator('[data-section="compounds"] [data-missing="predicted_only"]')).toBeVisible();
    await expect(panel.locator('[data-section="reactivity"] [data-missing="predicted_only"]')).toHaveCount(1);
    await expect(panel.getByTestId("size-ladder")).toHaveCount(0);
    await expect(panel.locator('[data-section="radii"] [data-missing="not_measured"]')).toHaveCount(3);
    await openChemistry(page, "Xe");
    await expect(current(page).getByTestId("oxidation-examples").locator('li[data-state="0"]')).toContainText("the element itself");
    await openChemistry(page, "He");
    await expect(current(page).locator('[data-section="compounds"] [data-missing="not_applicable"]')).toBeVisible();
  });

  test("axe: the chemistry panel for Fe, Cs, U and Og", async ({ page }) => {
    for (const s of ["Fe", "Cs", "U", "Og"]) {
      await openChemistry(page, s);
      expect(await axeViolations(page), s).toEqual([]);
    }
  });
});
