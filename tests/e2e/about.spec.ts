// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// The About page, the element photographs with their credits, and the element descriptions
// (SPEC §6.4, §9.2, §12, §15.4).
import { expect, test } from "@playwright/test";
import { axeViolations, open, tile } from "./helpers";

test.describe("the About page", () => {
  test("#/about shows the privacy statement, the coverage table and every source", async ({ page }) => {
    await open(page, "#/about");
    const about = page.getByTestId("about");
    await expect(about).toBeVisible();
    await expect(about.getByRole("heading", { level: 2 })).toHaveText("About PTE-21C");
    await expect(about.getByTestId("privacy")).toContainText("No cookies, no analytics");
    const coverage = about.getByTestId("coverage");
    await expect(coverage.getByRole("row")).not.toHaveCount(0);
    await expect(coverage.getByRole("row", { name: /Ground configuration \(NIST or published prediction\)/ })).toContainText(
      "118 / 118",
    );
    for (const id of ["nist_gsie", "iaea_livechart", "cod", "lodders2025", "images_of_elements"]) {
      await expect(about.locator(`li[data-source="${id}"]`)).toBeVisible();
    }
    await expect(about.locator('li[data-source="nist_gsie"]')).toContainText(/retrieved \d{4}-\d{2}-\d{2}/);
  });

  test("the header button opens it as a history entry; Esc and Back close it", async ({ page }) => {
    await open(page);
    await page.getByRole("button", { name: "About", exact: true }).click();
    await expect(page.getByTestId("about")).toBeVisible();
    await expect(page).toHaveURL(/#\/about$/);
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("about")).toBeHidden();
    await expect(page).toHaveURL(/Elements\/(#\/)?$/);

    await page.getByRole("button", { name: "About", exact: true }).click();
    await expect(page.getByTestId("about")).toBeVisible();
    await page.goBack();
    await expect(page.getByTestId("about")).toBeHidden();
  });

  test("axe: the About page", async ({ page }) => {
    await open(page, "#/about");
    await expect(page.getByTestId("coverage")).toBeVisible();
    expect(await axeViolations(page)).toEqual([]);
  });
});

test.describe("photographs and descriptions in the sheet", () => {
  test("a photo carries its title, author, licence link and source link", async ({ page }) => {
    await open(page, "#/Fe/orbitals");
    const sheet = page.getByTestId("sheet");
    const figure = sheet.locator("figure").first();
    await expect(figure.locator("img")).toHaveAttribute("src", /img\/elements\/26\/\d+-800\.webp$/);
    const caption = figure.locator("figcaption");
    await expect(caption).toContainText("Jürgen Kummer");
    await expect(caption.getByRole("link", { name: "CC BY 3.0" })).toHaveAttribute("href", /creativecommons\.org\/licenses\/by\/3\.0/);
    await expect(caption.getByRole("link", { name: "images-of-elements.com" })).toHaveAttribute("href", /images-of-elements\.com\/iron\.php/);
  });

  test("an element no one has seen shows an honest placeholder", async ({ page }) => {
    await open(page, "#/Og/orbitals");
    const placeholder = page.getByTestId("sheet").locator('[data-image-kind="placeholder"]');
    await expect(placeholder).toHaveAttribute("role", "img");
    await expect(placeholder).toHaveAttribute("aria-label", /No photograph exists/);
  });

  test("the sheet shows our own short description with the sources consulted", async ({ page }) => {
    await open(page);
    await tile(page, 26).click();
    const prose = page.getByTestId("sheet-prose");
    await expect(prose).toContainText("Iron is the most used of all metals");
    await expect(prose).toContainText("Sources consulted");
  });
});
