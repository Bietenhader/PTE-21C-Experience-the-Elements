// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// The sheet shell and routing (SPEC §9.2, §9.4, §13.3).
import { expect, test } from "@playwright/test";
import { axeViolations, longPress, open, pinch, settled, swipe, tile } from "./helpers";

test.describe("routing and the sheet", () => {
  test("click opens the sheet and the URL becomes #/Fe/<panel>", async ({ page }) => {
    await open(page);
    await tile(page, 26).click();
    const sheet = page.getByTestId("sheet");
    await expect(sheet).toBeVisible();
    await expect(page).toHaveURL(/#\/Fe\/orbitals$/);
    await expect(sheet.getByRole("heading", { level: 2 })).toContainText("Iron");
    await expect(sheet.getByRole("tab", { selected: true })).toHaveText("Orbitals");
  });

  test("←/→ and tab clicks change the panel and the URL", async ({ page }) => {
    await open(page, "#/Fe/orbitals");
    const sheet = page.getByTestId("sheet");
    await expect(sheet).toBeVisible();
    await page.keyboard.press("ArrowRight");
    await expect(page).toHaveURL(/#\/Fe\/em$/);
    await page.keyboard.press("ArrowRight");
    await expect(page).toHaveURL(/#\/Fe\/probability$/);
    await page.keyboard.press("ArrowLeft");
    await expect(page).toHaveURL(/#\/Fe\/em$/);
    await sheet.getByRole("tab", { name: "Nucleus & isotopes" }).click();
    await expect(page).toHaveURL(/#\/Fe\/nucleus$/);
    await expect(sheet.getByRole("tab", { selected: true })).toHaveText("Nucleus & isotopes");
    await expect(sheet.locator('[role="tabpanel"][data-current]')).toContainText("Nucleus & isotopes");
  });

  test("deep link #/Cs/amo opens Caesium on the AMO panel", async ({ page }) => {
    await open(page, "#/Cs/amo");
    const sheet = page.getByTestId("sheet");
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole("heading", { level: 2 })).toContainText("Caesium");
    await expect(sheet.getByRole("tab", { selected: true })).toHaveText("AMO & metrology");
    await expect(sheet.locator('[role="tabpanel"][data-current]')).toBeInViewport();
  });

  test("#/Cs opens the remembered panel", async ({ page }) => {
    await open(page, "#/Fe/history");
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("sheet")).toBeHidden();
    await page.goto("./#/Cs");
    await expect(page.getByTestId("sheet")).toBeVisible();
    await expect(page).toHaveURL(/#\/Cs\/history$/);
  });

  test("a scroll event on the closed sheet does not change the remembered panel", async ({ page }) => {
    // WebKit fires a scroll event on the panel strip as the dialog closes (its scroll position resets);
    // that must not count as a swipe to the first panel.
    await open(page, "#/Fe/history");
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("sheet")).toBeHidden();
    await page.getByTestId("panel-strip").evaluate((s) => {
      s.scrollLeft = 0;
      s.dispatchEvent(new Event("scroll"));
      s.dispatchEvent(new Event("scrollend"));
    });
    await page.waitForTimeout(300);
    await page.goto("./#/Cs");
    await expect(page).toHaveURL(/#\/Cs\/history$/);
  });

  test("table state rides in the URL: #/?layout=janet&g3=la&trend=ie1&view=heat", async ({ page }) => {
    await open(page, "#/?layout=janet&g3=la&trend=ie1&view=heat");
    await expect(page.getByRole("radio", { name: "Janet", exact: true })).toBeChecked();
    await expect(page.getByRole("combobox", { name: "Trend", exact: true })).toHaveValue("heat:ie1");
    await expect(page.locator('button[data-face="heat"]')).toHaveCount(118);
  });

  test("Esc closes and returns focus to the tile; Back closes too", async ({ page }) => {
    await open(page);
    await tile(page, 79).click();
    await expect(page.getByTestId("sheet")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("sheet")).toBeHidden();
    await expect(tile(page, 79)).toBeFocused();
    await expect(page).toHaveURL(/Elements\/(#\/)?$/);

    await tile(page, 26).click();
    await expect(page.getByTestId("sheet")).toBeVisible();
    await page.goBack();
    await expect(page.getByTestId("sheet")).toBeHidden();
    await page.goForward();
    await expect(page.getByTestId("sheet")).toBeVisible();
  });

  test("a mistyped link opens the table, not an error", async ({ page }) => {
    await open(page, "#/Xx/nothing?layout=spiral");
    await expect(page.getByTestId("sheet")).toBeHidden();
    await expect(page).toHaveURL(/Elements\/(#\/)?$/);
  });

  test("axe: the sheet for Fe, Cs, U and Og", async ({ page }) => {
    // Four full-page axe scans of a sheet with its panels mounted: about 7 s each on a loaded runner.
    test.setTimeout(60_000);
    for (const s of ["Fe", "Cs", "U", "Og"]) {
      await open(page, `#/${s}/orbitals`);
      await expect(page.getByTestId("sheet")).toBeVisible();
      expect(await axeViolations(page), s).toEqual([]);
    }
  });
});

test.describe("mobile (SPEC §13.3)", () => {
  test.skip(({ isMobile }) => !isMobile, "phone emulation only");

  test("tap opens the bottom sheet", async ({ page }) => {
    await open(page);
    await tile(page, 26).tap();
    const sheet = page.getByTestId("sheet");
    await expect(sheet).toBeVisible();
    await settled(page);
    const box = await sheet.boundingBox();
    const vp = page.viewportSize();
    expect(Math.round((box?.y ?? 0) + (box?.height ?? 0))).toBeGreaterThanOrEqual((vp?.height ?? 0) - 1);
    expect(box?.width).toBeGreaterThanOrEqual((vp?.width ?? 0) - 1);
  });

  test("swipe changes the panel", async ({ page, context, browserName }) => {
    test.skip(browserName !== "chromium", "touch events through the DevTools protocol");
    await open(page, "#/Fe/orbitals");
    // The bottom sheet slides up when it opens; measure where the strip is once it has arrived.
    await expect(page.getByTestId("sheet")).toBeVisible();
    await settled(page);
    const strip = page.getByTestId("panel-strip");
    const box = await strip.boundingBox();
    if (!box) throw new Error("no strip");
    await swipe(context, page, { x: box.x + box.width * 0.85, y: box.y + 60 }, -box.width * 0.7);
    await expect(page).toHaveURL(/#\/Fe\/em$/);
  });

  test("pinch zooms the table", async ({ page, context, browserName }) => {
    test.skip(browserName !== "chromium", "touch events through the DevTools protocol");
    await open(page);
    const before = (await tile(page, 26).boundingBox())?.width ?? 0;
    const box = await tile(page, 26).boundingBox();
    if (!box) throw new Error("no tile");
    await pinch(context, page, { x: box.x + box.width / 2, y: box.y + box.height / 2 }, 40, 160);
    await expect.poll(async () => (await tile(page, 26).boundingBox())?.width ?? 0).toBeGreaterThan(before * 2);
    await expect(tile(page, 26).locator('[data-field="name"]')).toBeVisible();
  });

  test("long-press peeks without opening the sheet", async ({ page, context, browserName }) => {
    test.skip(browserName !== "chromium", "touch events through the DevTools protocol");
    await open(page);
    const box = await tile(page, 26).boundingBox();
    if (!box) throw new Error("no tile");
    await longPress(context, page, { x: box.x + box.width / 2, y: box.y + box.height / 2 });
    await expect(page.getByTestId("hovercard")).toBeVisible();
    await expect(page.getByTestId("hovercard")).toContainText("Iron");
    await page.waitForTimeout(300);
    await expect(page.getByTestId("sheet")).toBeHidden();
  });
});
