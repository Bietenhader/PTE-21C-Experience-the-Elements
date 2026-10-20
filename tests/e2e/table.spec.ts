// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// M0 acceptance (SPEC §18): 118 tiles in standard18 with the reference table's fields and the
// hyperfine slot; plus the always-on guarantees of SPEC §2 — zero third-party requests,
// accessibility, no console errors.
import { expect, test } from "@playwright/test";
import { axeViolations, isPhone, open, tile } from "./helpers";

const fullSize = (page: import("@playwright/test").Page) => page.getByRole("button", { name: "Full-size tiles" }).click();

test("renders all 118 elements in Z order with accessible names", async ({ page }) => {
  await open(page);
  const zs = await page.locator("button[data-z]").evaluateAll((els) => els.map((e) => Number(e.getAttribute("data-z"))));
  expect(zs).toEqual(Array.from({ length: 118 }, (_, i) => i + 1));
  await expect(tile(page, 55)).toHaveAccessibleName("Caesium (Cs), atomic number 55, alkali metal. Press Enter for details.");
  await expect(tile(page, 55)).toHaveAccessibleDescription(/First ionization energy 375\.70/);
  // The accessibility tree normalises the narrow no-break digit-group spaces to plain spaces.
  await expect(tile(page, 55)).toHaveAccessibleDescription(/9\s192\s631\s770 Hz \(exact\)/);
});

test("full-size tiles show every reference-table field and the hyperfine slot", async ({ page }) => {
  await open(page);
  await fullSize(page);
  for (const z of [1, 26, 55, 79, 118]) {
    for (const field of ["weight", "z", "ie1", "en", "ox", "symbol", "name", "config", "hfs"]) {
      await expect(tile(page, z).locator(`[data-field="${field}"]`), `Z=${z} ${field}`).toBeVisible();
    }
  }
  const field = (z: number, f: string) => tile(page, z).locator(`[data-field="${f}"]`);
  await expect(field(55, "hfs")).toHaveText(/9\u202f192\u202f631\u202f770 Hz/);
  await expect(field(55, "weight")).toHaveText("132.9055");
  await expect(field(43, "weight")).toHaveText("(97)");
  await expect(field(58, "hfs")).toHaveText("no hfs (I = 0)");
  await expect(field(2, "hfs")).toHaveText("no hfs (J = 0)");
  await expect(field(1, "hfs")).toHaveText("hfs n/m");
  await expect(field(118, "hfs")).toHaveText("hfs: no stable isotope");
  await expect(field(79, "config")).toContainText("◆");
  await expect(field(26, "config")).not.toContainText("◆");
  await expect(field(26, "ox").locator("b")).toHaveText(["+3", "+2"]);
});

test("small tiles fall back to Z and symbol", async ({ page }, info) => {
  test.skip(!isPhone(info), "phone layout only");
  await open(page);
  await expect(tile(page, 26).locator('[data-field="symbol"]')).toBeVisible();
  await expect(tile(page, 26).locator('[data-field="z"]')).toBeVisible();
  await expect(tile(page, 26).locator('[data-field="name"]')).toBeHidden();
  await expect(tile(page, 26).locator('[data-field="hfs"]')).toBeHidden();
});

test("Tab order follows Z", async ({ page }, info) => {
  test.skip(isPhone(info), "keyboard test on desktop");
  await open(page);
  await tile(page, 1).focus();
  await page.keyboard.press("Tab");
  await expect(tile(page, 2)).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(tile(page, 3)).toBeFocused();
});

test("makes no request outside its own origin (SPEC §2.7)", async ({ page, baseURL }) => {
  const origin = new URL(baseURL ?? "").origin;
  const foreign: string[] = [];
  page.on("request", (r) => {
    const url = new URL(r.url());
    if (url.protocol !== "data:" && url.origin !== origin) foreign.push(r.url());
  });
  await open(page);
  await fullSize(page);
  await page.mouse.wheel(0, 4000);
  await page.waitForLoadState("networkidle");
  expect(foreign).toEqual([]);
});

test("no console errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(String(e)));
  await open(page);
  await fullSize(page);
  expect(errors).toEqual([]);
});

test("every tile's accessible name contains its visible label: symbol and name (WCAG 2.5.3)", async ({ page }) => {
  await open(page);
  const pairs = await page.locator("button[data-z]").evaluateAll((els) =>
    els.map((el) => ({
      label: el.getAttribute("aria-label") ?? "",
      symbol: el.querySelector('[data-field="symbol"]')?.textContent ?? "?",
      name: el.querySelector('[data-field="name"]')?.textContent ?? "?",
    })),
  );
  for (const p of pairs) {
    expect(p.label).toContain(`(${p.symbol})`);
    expect(p.label.startsWith(p.name)).toBe(true);
  }
});

test("axe: no critical or serious accessibility violations", async ({ page }) => {
  await open(page);
  expect(await axeViolations(page), "compact").toEqual([]);
  await fullSize(page);
  expect(await axeViolations(page), "full size").toEqual([]);
});
