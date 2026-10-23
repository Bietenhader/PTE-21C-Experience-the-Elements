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

  test("six groups of life, in order, each saying its status in words", async ({ page }) => {
    await openBiology(page, "Fe");
    const panel = current(page);
    const cards = panel.locator('[data-section="essential"] [data-testid^="need-"]');
    await expect(cards).toHaveCount(6);
    const ids = await cards.evaluateAll((els) => els.map((el) => el.getAttribute("data-testid")));
    expect(ids).toEqual(["need-humans", "need-animals", "need-plants", "need-fungi", "need-bacteria", "need-archaea"]);
    await expect(panel.getByTestId("need-animals")).toContainText("Animals: Essential");
    await expect(panel.getByTestId("need-animals")).toContainText("haemerythrin");
    await expect(panel.getByTestId("need-bacteria")).toContainText("Borrelia burgdorferi");
    await expect(panel.getByTestId("need-archaea")).toContainText("Ferroplasma");
    await expect(panel.getByTestId("needs-legend")).toContainText("used by some, not all");
  });

  test("molybdenum: used by some bacteria, in nitrogenase, with the paper's DOI", async ({ page }) => {
    await openBiology(page, "Mo");
    const bacteria = current(page).getByTestId("need-bacteria");
    await expect(bacteria).toContainText("Bacteria: Used by some, not all");
    await expect(bacteria).toContainText("nitrogenase");
    await expect(bacteria.getByRole("link", { name: "doi:10.1016/j.jmb.2008.03.051" })).toBeVisible();
    await expect(current(page).getByTestId("need-animals")).toContainText("sulfite oxidase");
    await expect(current(page).getByTestId("need-fungi")).toContainText("baker's yeast");
  });

  test("nickel in methanogens, cerium in a methanotroph, bromine in fruit flies", async ({ page }) => {
    await openBiology(page, "Ni");
    await expect(current(page).getByTestId("need-archaea")).toContainText("F430");
    await openBiology(page, "Ce");
    await expect(current(page).getByTestId("need-bacteria")).toContainText("Methylacidiphilum fumariolicum");
    await openBiology(page, "Br");
    const animals = current(page).getByTestId("need-animals");
    await expect(animals).toContainText("Animals: Used by some, not all");
    await expect(animals).toContainText("Shown in fruit flies");
  });

  test("farm animals from Suttle's handbook: silicon beneficial, fluorine with no known role", async ({ page }) => {
    await openBiology(page, "Si");
    const animals = current(page).getByTestId("need-animals");
    await expect(animals).toContainText("Animals: Beneficial");
    await expect(animals).toContainText("connective tissue");
    await expect(animals.getByRole("link", { name: "doi:10.1079/9781789240924.0017" })).toBeVisible();
    await expect(current(page).getByTestId("needs-legend")).toContainText("beneficial");
    await openBiology(page, "F");
    await expect(current(page).getByTestId("need-animals")).toContainText("Animals: No known role");
    await expect(current(page).getByTestId("need-animals")).toContainText("fluorosis");
  });

  test("a group with no known role says so, and never 'not essential'", async ({ page }) => {
    await openBiology(page, "Ar");
    const panel = current(page);
    for (const group of ["animals", "fungi", "bacteria", "archaea"]) {
      const card = panel.getByTestId(`need-${group}`);
      await expect(card).toContainText("No known role");
      await expect(card).toContainText(`No role for argon in ${group} is known from PTE-21C's sources.`);
      await expect(card).toContainText("That does not mean there is none.");
      await expect(card).not.toContainText("Not essential");
    }
    await openBiology(page, "Se");
    await expect(current(page).getByTestId("need-fungi")).toContainText("Fungi: No known role");
    await expect(current(page).getByTestId("need-fungi")).toContainText("lost all their selenium");
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

  test("axe: the biology panel for Fe, Mo, Cs, U and Og", async ({ page }) => {
    for (const s of ["Fe", "Mo", "Cs", "U", "Og"]) {
      await openBiology(page, s);
      expect(await axeViolations(page), s).toEqual([]);
    }
  });
});
