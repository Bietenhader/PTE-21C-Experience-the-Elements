// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// The spectrum & energy levels panel (SPEC §10.8): the visible strip with its ion toggle and table, the
// strongest lines, the Grotrian diagram with cooling and clock transitions, Missing where NIST has
// nothing, and axe.
import { expect, type Page, test } from "@playwright/test";
import { axeViolations, open } from "./helpers";

const panel = (page: Page) => page.locator('section[data-slug="spectrum"]');

function consoleErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(String(e)));
  return errors;
}

test.describe("spectrum & energy levels panel", () => {
  for (const s of ["H", "Na", "Fe", "Sr", "Hg"]) {
    test(`${s}: strip, strongest lines and Grotrian diagram, no console errors`, async ({ page }) => {
      const errors = consoleErrors(page);
      await open(page, `#/${s}/spectrum`);
      const p = panel(page);
      await expect(p.getByTestId("spectrum-svg")).toBeVisible();
      expect(await p.getByTestId("spectrum-svg").locator("[data-line]").count()).toBeGreaterThan(10);
      await expect(p.getByTestId("strongest-lines").locator("tbody tr")).toHaveCount(12);
      await expect(p.getByTestId("grotrian").locator("svg")).toBeVisible();
      await expect(p.getByText(/Approximate overall glow/)).toBeVisible();
      expect(errors).toEqual([]);
    });
  }

  test("Sr: the 461 nm cooling line and the 429 THz clock are drawn on the diagram", async ({ page }) => {
    await open(page, "#/Sr/spectrum");
    const g = panel(page).getByTestId("grotrian");
    await expect(g.locator('[data-mark="cooling"]')).toHaveCount(1);
    await expect(g.locator('[data-mark="clock"]')).toHaveCount(1);
    await expect(panel(page).getByTestId("marked-transitions")).toContainText("Clock: 87Sr 429 THz");
  });

  test("Og: no lines and no levels in NIST — Missing with its reason, never a blank", async ({ page }) => {
    const errors = consoleErrors(page);
    await open(page, "#/Og/spectrum");
    const p = panel(page);
    // strip, strongest lines, flame test, energy levels
    await expect(p.getByText("not measured", { exact: true })).toHaveCount(4);
    await expect(p.getByTestId("spectrum-strip")).toHaveCount(0);
    await expect(p.getByTestId("grotrian")).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test("the ion toggle adds a labelled second row of lines", async ({ page }) => {
    await open(page, "#/Fe/spectrum");
    const p = panel(page);
    const svg = p.getByTestId("spectrum-svg");
    await expect(svg.locator("[data-species]")).toHaveCount(1);
    const before = await svg.locator("[data-line]").count();
    const toggle = p.getByRole("button", { name: "Show the singly charged ion (Fe II)" });
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    await expect(svg.locator("[data-species]")).toHaveCount(2);
    await expect(svg.locator('[data-species="Fe II"]')).toContainText("Fe II");
    expect(await svg.locator("[data-line]").count()).toBeGreaterThan(before);
    await expect(p.getByTestId("spectrum-strip").locator("figcaption")).toContainText("Fe II");
  });

  test("pointing at a line shows its wavelength, A_ki and levels", async ({ page }) => {
    await open(page, "#/Na/spectrum");
    const strip = panel(page).getByTestId("spectrum-strip");
    const svg = strip.getByTestId("spectrum-svg");
    await svg.scrollIntoViewIfNeeded();
    const box = await svg.boundingBox();
    if (!box) throw new Error("no strip");
    // The brightest line is sodium's D2 line at 588.995 nm.
    const x = Number(await svg.locator('[data-line][stroke-opacity="1"]').getAttribute("x1"));
    await page.mouse.move(box.x + x, box.y + 20);
    await expect(strip.getByText(/588\.995095 nm/)).toBeVisible();
    await expect(strip.getByText(/A_ki 6\.16 × 10⁷ s⁻¹/)).toBeVisible();
    await expect(strip.getByText(/3s ²S, J = 1\/2 → 2p⁶ 3p ²P°, J = 3\/2/)).toBeVisible();
  });

  test("show as table lists every line of the strip, and the levels with their notes", async ({ page }) => {
    await open(page, "#/Na/spectrum");
    const strip = panel(page).getByTestId("spectrum-strip");
    await expect(strip.getByTestId("spectrum-svg")).toBeVisible();
    const lines = await strip.locator("[data-line]").count();
    expect(lines).toBeGreaterThan(100);
    await strip.getByRole("button", { name: "Show as table" }).click();
    await expect(strip.locator("table tbody tr")).toHaveCount(lines);
    await expect(strip.getByRole("button", { name: "Hide table" })).toHaveAttribute("aria-expanded", "true");

    const grotrian = panel(page).getByTestId("grotrian");
    await grotrian.getByRole("button", { name: "Show as table" }).click();
    await expect(grotrian.locator("table tbody tr")).toHaveCount(60);
    await expect(grotrian.locator("table")).toContainText("ground level");
    await expect(grotrian.locator("table")).toContainText("above the ionization limit (autoionizing), not drawn");
    await expect(grotrian.locator("table")).toContainText("lower level of the laser cooling transition");
  });

  test("axe: the spectrum panel for Fe, Cs, U and Og", async ({ page }) => {
    for (const s of ["Fe", "Cs", "U", "Og"]) {
      await open(page, `#/${s}/spectrum`);
      await expect(page.getByTestId("sheet")).toBeVisible();
      await expect(panel(page).getByText("Sources used on this panel")).toBeVisible();
      await expect(panel(page).getByText("Loading…")).toHaveCount(0);
      expect(await axeViolations(page), s).toEqual([]);
    }
  });
});
