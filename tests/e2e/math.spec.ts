// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// The mathematical & theoretical panel (SPEC §10.5).
import { expect, type Page, test } from "@playwright/test";
import { axeViolations, isPhone, open } from "./helpers";

function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(String(e)));
  return errors;
}

const panel = (page: Page) => page.locator('[role="tabpanel"][data-current][data-slug="math"]');

test.describe("mathematical & theoretical panel", () => {
  test("renders for a spread of elements without console errors or sideways scrolling", async ({ page }, info) => {
    const errors = collectErrors(page);
    for (const s of ["H", "C", "N", "Fe", "Cr", "Ce", "Gd", "Au", "Hg", "Pb", "Fr", "Lr", "Og"]) {
      await open(page, `#/${s}/math`);
      await expect(panel(page).getByTestId("panel-sources"), s).toBeVisible();
      await expect(panel(page)).not.toContainText("NaN");
      if (isPhone(info)) {
        const overflow = await panel(page).evaluate((p) => p.scrollWidth - p.clientWidth);
        expect(overflow, s).toBeLessThanOrEqual(1);
      }
    }
    expect(errors).toEqual([]);
  });

  test("iron: Hund's rules give ⁵D₄ as NIST measures; Slater's arithmetic gives 3.75 for 4s", async ({ page }) => {
    await open(page, "#/Fe/math");
    const p = panel(page);
    await expect(p.getByRole("img", { name: "quintet D, J = 4" }).first()).toBeVisible();
    await expect(p).toContainText("The same as the measured term");
    await expect(p.getByTestId("slater-steps")).toContainText("26 − 22.25 = 3.75");
    await expect(p).toContainText("g J = 1.5002".replace(" J ", "J "));
  });

  test("cerium: Hund's rules disagree with NIST, and the panel says so", async ({ page }) => {
    await open(page, "#/Ce/math");
    await expect(panel(page)).toContainText("Not the measured term");
    await expect(panel(page)).toContainText("several open subshells");
  });

  test("the Madelung anomalies are explained by kind, as explanations", async ({ page }) => {
    for (const [s, words] of [
      ["Cr", "half full or full"],
      ["Nb", "nearly the same energy"],
      ["Gd", "(n−2)f and (n−1)d"],
      ["Lr", "relativity pulls the s and p₁/₂ orbitals in"],
    ] as const) {
      await open(page, `#/${s}/math`);
      const section = panel(page).locator('[data-section="aufbau"]');
      await expect(section, s).toContainText(words);
      await expect(section, s).toContainText("Explanation, not derivation");
    }
    await open(page, "#/Fe/math");
    await expect(panel(page).locator('[data-section="aufbau"]')).toContainText("They agree");
  });

  test("lead's ground level is jj-coupled; J = 0 has no Landé factor", async ({ page }) => {
    await open(page, "#/Pb/math");
    const term = panel(page).locator('[data-section="term"]');
    await expect(term).toContainText("jj coupling");
    await expect(term).toContainText("not applicable");
  });

  test("relativity: gold's 1s at Zα = 0.5765, the chart as a table, and the notes with their papers", async ({ page }) => {
    await open(page, "#/Au/math");
    const rel = panel(page).locator('[data-section="relativity"]');
    await expect(rel).toContainText("0.5765");
    await expect(rel).toContainText("137.036");
    await expect(rel.locator("li[data-current]")).toContainText("Why gold is yellow");
    await rel.getByRole("button", { name: "Show as table" }).click();
    await expect(rel.getByRole("table")).toContainText("79");
  });

  test("axe: the mathematical panel for Fe, Cs, U and Og", async ({ page }) => {
    for (const s of ["Fe", "Cs", "U", "Og"]) {
      await open(page, `#/${s}/math`);
      await expect(panel(page).getByTestId("panel-sources")).toBeVisible();
      expect(await axeViolations(page, '[role="tabpanel"][data-current]'), s).toEqual([]);
    }
  });
});
