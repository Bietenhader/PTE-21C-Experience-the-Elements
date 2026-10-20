// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// M1 acceptance (SPEC §13.3, §18): hover card, layouts and the morph, the group-3 toggle, trends,
// search, keyboard, and zero third-party requests over a whole session.
import { expect, test } from "@playwright/test";
import { axeViolations, chooseLayout, isPhone, open, positions, settled, tile } from "./helpers";

test.describe("hover card (SPEC §9.1)", () => {
  test.skip(({ isMobile }) => isMobile, "pointer hover is a desktop interaction");

  test("appears within 400 ms of hovering, with at least one image", async ({ page }) => {
    await open(page);
    const start = Date.now();
    await tile(page, 26).hover();
    const card = page.getByTestId("hovercard");
    await expect(card).toBeVisible({ timeout: 400 });
    expect(Date.now() - start).toBeLessThan(400 + 150);
    await expect(card).toContainText("Iron");
    await expect(card).toContainText("transition metal");
    expect(await card.locator("[data-image-kind]").count()).toBeGreaterThanOrEqual(1);
  });

  test("keyboard focus shows it and Esc dismisses it", async ({ page }) => {
    await open(page);
    await tile(page, 25).focus();
    await page.keyboard.press("Tab");
    await expect(tile(page, 26)).toBeFocused();
    const card = page.getByTestId("hovercard");
    await expect(card).toBeVisible();
    await expect(card).toContainText("Iron");
    await page.keyboard.press("Escape");
    await expect(card).toBeHidden();
    await expect(tile(page, 26)).toBeFocused();
  });

  test("stays while the pointer moves onto it (WCAG 1.4.13) and leaves with it", async ({ page }) => {
    await open(page);
    await tile(page, 26).hover();
    const card = page.getByTestId("hovercard");
    await expect(card).toBeVisible();
    await card.hover();
    await page.waitForTimeout(300);
    await expect(card).toBeVisible();
    await page.mouse.move(5, 5);
    await expect(card).toBeHidden();
  });
});

test.describe("layouts (SPEC §7.2)", () => {
  test("every tile is present in every layout", async ({ page }) => {
    await open(page);
    for (const layout of ["Long form", "Janet", "ADOMAH", "Standard"] as const) {
      await chooseLayout(page, layout);
      await settled(page);
      await expect(page.locator("button[data-z]")).toHaveCount(118);
      const pos = await positions(page);
      const cells = new Set(Object.values(pos).map((p) => `${p.x},${p.y}`));
      expect(cells.size, `${layout}: every tile in its own cell`).toBe(118);
    }
  });

  test("the morph animates, and is instant with reduced motion", async ({ page }) => {
    await open(page);
    await chooseLayout(page, "Janet");
    expect(await page.evaluate(() => document.getAnimations().length)).toBeGreaterThan(100);
    await settled(page);

    await page.emulateMedia({ reducedMotion: "reduce" });
    await chooseLayout(page, "ADOMAH");
    expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
    await expect(page).toHaveURL(/layout=adomah/);
  });

  test("L cycles the layouts and the URL follows", async ({ page }, info) => {
    test.skip(isPhone(info), "keyboard shortcut");
    await open(page);
    await page.keyboard.press("l");
    await expect(page).toHaveURL(/#\/\?layout=long32$/);
    await page.keyboard.press("l");
    await expect(page).toHaveURL(/layout=janet/);
    await page.keyboard.press("Shift+L");
    await expect(page).toHaveURL(/layout=long32/);
  });

  test("arrow keys move between tiles in the active layout", async ({ page }, info) => {
    test.skip(isPhone(info), "keyboard");
    await open(page);
    await tile(page, 26).focus();
    await page.keyboard.press("ArrowDown");
    await expect(tile(page, 44)).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(tile(page, 45)).toBeFocused();
    await page.keyboard.press("ArrowUp");
    await expect(tile(page, 27)).toBeFocused();
    await chooseLayout(page, "ADOMAH");
    await settled(page);
    await tile(page, 1).focus();
    await page.keyboard.press("ArrowUp"); // n increases upwards in ADOMAH
    await expect(tile(page, 3)).toBeFocused();
  });
});

test.describe("group 3 (SPEC §7.2, §13.3)", () => {
  test.use({ contextOptions: { reducedMotion: "reduce" } });

  test("in standard18 the toggle moves exactly La, Lu, Ac and Lr", async ({ page }) => {
    await open(page);
    const before = await positions(page);
    await page.getByRole("radio", { name: "La · Ac" }).check();
    await expect(page).toHaveURL(/g3=la/);
    const after = await positions(page);
    const moved = Object.keys(before)
      .map(Number)
      .filter((z) => before[z]?.x !== after[z]?.x || before[z]?.y !== after[z]?.y);
    expect(moved).toEqual([57, 71, 89, 103]);
  });

  test("in long32 La↔Lu and Ac↔Lr change places between group 3 and the inline block", async ({ page }) => {
    await open(page);
    await chooseLayout(page, "Long form");
    const before = await positions(page);
    await page.getByRole("radio", { name: "La · Ac" }).check();
    const after = await positions(page);
    // La and Ac take the group-3 cells that Lu and Lr held …
    expect(after[57]).toEqual(before[71]);
    expect(after[89]).toEqual(before[103]);
    // … Lu and Lr close the 14-wide block, Ce–Yb and Th–No shift one column, nothing else moves.
    expect(after[71]).toEqual(before[70]);
    expect(after[103]).toEqual(before[102]);
    for (const z of [...range(58, 70), ...range(90, 102)]) expect(after[z], `Z=${z}`).toEqual(before[z - 1]);
    const shifted = new Set([57, 71, 89, 103, ...range(58, 70), ...range(90, 102)]);
    for (let z = 1; z <= 118; z++) if (!shifted.has(z)) expect(after[z], `Z=${z}`).toEqual(before[z]);
  });

  test("Janet and ADOMAH ignore it", async ({ page }) => {
    await open(page);
    await chooseLayout(page, "Janet");
    await expect(page.getByRole("radio", { name: "La · Ac" })).toBeDisabled();
  });
});

test.describe("trends (SPEC §8)", () => {
  test("arrows render in standard18 and are disabled in janet", async ({ page }) => {
    await open(page);
    const trend = page.getByRole("combobox", { name: "Trend", exact: true });
    await trend.selectOption("arrows:ie1");
    const svg = page.getByTestId("trend-arrows");
    await expect(svg).toBeVisible();
    expect(await svg.locator("line").count()).toBeGreaterThanOrEqual(2);
    expect(await svg.locator("circle").count()).toBe(4); // B, O, Al, S
    await expect(page.getByTestId("trend-legend")).toContainText("Lower than beryllium");
    await expect(page).toHaveURL(/trend=ie1&view=arrows/);

    await chooseLayout(page, "Janet");
    await expect(svg).toHaveCount(0);
    await expect(trend.locator('option[value="arrows:ie1"]')).toBeDisabled();
    await expect(page).not.toHaveURL(/view=arrows/);
  });

  test("a heatmap colours every tile, prints values and hatches gaps with their reason", async ({ page }) => {
    await open(page);
    await page.getByRole("combobox", { name: "Trend", exact: true }).selectOption("heat:density");
    await expect(page.locator('button[data-face="heat"]')).toHaveCount(118);
    await expect(tile(page, 118)).toHaveAttribute("data-face-missing", "true");
    await expect(tile(page, 118).locator('[data-field="value"]')).toHaveText("n/m");
    await expect(tile(page, 26)).toHaveAccessibleDescription(/Heatmap, Density: 7\.874 g\/cm³/);
    await page.getByRole("button", { name: "Show as chart" }).click();
    await expect(page.getByTestId("trend-chart-z")).toBeVisible();
    await page.getByRole("button", { name: "Show as table" }).click();
    await expect(page.getByRole("table")).toContainText("Fe");
  });

  test("a categorical map labels every tile, not just colours it", async ({ page }) => {
    await open(page);
    await page.getByRole("combobox", { name: "Trend", exact: true }).selectOption("map:madelung");
    await expect(page.locator('button[data-face="map"]')).toHaveCount(118);
    await expect(tile(page, 79).locator('[data-field="value"]')).toHaveText("◆");
    await expect(page.getByTestId("trend-legend")).toContainText("Breaks the Aufbau rule");
  });

  test("the units setting changes the heatmap values", async ({ page }) => {
    await open(page, "#/?trend=ie1&view=heat");
    await expect(tile(page, 55).locator('[data-field="value"]')).toHaveText("376");
    await page.getByRole("button", { name: "Settings" }).click();
    await page.getByRole("radio", { name: "eV" }).check();
    await page.getByRole("button", { name: "Done" }).click();
    await expect(tile(page, 55).locator('[data-field="value"]')).toHaveText("3.89");
  });

  test("offers all eleven arrow trends, at least ten heatmaps and six maps", async ({ page }) => {
    await open(page);
    const trend = page.getByRole("combobox", { name: "Trend", exact: true });
    expect(await trend.locator('option[value^="arrows:"]').count()).toBe(11);
    expect(await trend.locator('option[value^="heat:"]').count()).toBeGreaterThanOrEqual(10);
    expect(await trend.locator('option[value^="map:"]').count()).toBeGreaterThanOrEqual(6);
  });
});

test.describe("search (SPEC §7.4)", () => {
  test("highlights matches, dims the rest, and Enter opens the first", async ({ page }) => {
    await open(page);
    const search = page.getByRole("searchbox", { name: "Search", exact: true });
    await search.fill("ionization > 2000");
    await expect(page.locator('button[data-match="true"]')).toHaveCount(2);
    await expect(page.getByTestId("search-status")).toContainText("Helium");
    await search.fill("iron");
    await expect(page.locator('button[data-match="true"]')).toHaveCount(1);
    await search.press("Enter");
    await expect(page).toHaveURL(/#\/Fe\/orbitals/);
  });

  test("/ focuses the search field", async ({ page }, info) => {
    test.skip(isPhone(info), "keyboard shortcut");
    await open(page);
    await page.keyboard.press("/");
    await expect(page.getByRole("searchbox", { name: "Search", exact: true })).toBeFocused();
  });
});

test.describe("zoom", () => {
  test("the zoom buttons change the tile size and disclose fields", async ({ page }) => {
    await open(page);
    const name = tile(page, 26).locator('[data-field="name"]');
    await page.getByRole("button", { name: "Full-size tiles" }).click();
    await expect(tile(page, 26).locator('[data-field="hfs"]')).toBeVisible();
    await page.getByRole("button", { name: "Zoom out" }).click();
    await page.getByRole("button", { name: "Zoom out" }).click();
    await page.getByRole("button", { name: "Zoom out" }).click();
    await expect(tile(page, 26).locator('[data-field="hfs"]')).toBeHidden();
    await expect(name).toBeVisible();
  });

  test("Ctrl + wheel zooms the table, not the page", async ({ page }, info) => {
    test.skip(isPhone(info), "desktop gesture");
    await open(page);
    const before = (await tile(page, 26).boundingBox())?.width ?? 0;
    const box = await tile(page, 26).boundingBox();
    await page.mouse.move((box?.x ?? 0) + 5, (box?.y ?? 0) + 5);
    await page.keyboard.down("Control");
    await page.mouse.wheel(0, -200);
    await page.keyboard.up("Control");
    await expect.poll(async () => (await tile(page, 26).boundingBox())?.width ?? 0).toBeGreaterThan(before * 1.5);
    expect(await page.evaluate(() => window.visualViewport?.scale ?? 1)).toBe(1);
  });
});

test("a full session makes no request outside its own origin (SPEC §2.7)", async ({ page, baseURL }, info) => {
  const origin = new URL(baseURL ?? "").origin;
  const foreign: string[] = [];
  page.on("request", (r) => {
    const url = new URL(r.url());
    if (url.protocol !== "data:" && url.protocol !== "blob:" && url.origin !== origin) foreign.push(r.url());
  });
  await open(page);
  if (!isPhone(info)) await tile(page, 26).hover();
  for (const layout of ["Long form", "Janet", "ADOMAH", "Standard"] as const) await chooseLayout(page, layout);
  await page.getByRole("combobox", { name: "Trend", exact: true }).selectOption("heat:ie1");
  await page.getByRole("button", { name: "Show as chart" }).click();
  await page.getByRole("combobox", { name: "Trend", exact: true }).selectOption("map:block");
  await page.getByRole("combobox", { name: "Trend", exact: true }).selectOption("arrows:atomic-radius");
  await page.getByRole("searchbox", { name: "Search", exact: true }).fill("noble gas");
  await tile(page, 55).click();
  await expect(page.getByTestId("sheet")).toBeVisible();
  for (let i = 0; i < 11; i++) await page.getByRole("button", { name: /^Next panel/ }).click();
  await page.waitForLoadState("networkidle");
  expect(foreign).toEqual([]);
});

test("axe: the table with each kind of overlay and during a search", async ({ page }) => {
  await open(page);
  for (const option of ["arrows:ie1", "heat:melting-point", "map:discovery"]) {
    await page.getByRole("combobox", { name: "Trend", exact: true }).selectOption(option);
    await page.waitForTimeout(200);
    expect(await axeViolations(page), option).toEqual([]);
  }
  await page.getByRole("searchbox", { name: "Search", exact: true }).fill("metalloid");
  expect(await axeViolations(page), "search").toEqual([]);
  await page.getByRole("button", { name: "Settings" }).click();
  expect(await axeViolations(page), "settings").toEqual([]);
});

function range(a: number, b: number): number[] {
  return Array.from({ length: b - a + 1 }, (_, i) => a + i);
}
