// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// The history & naming panel (SPEC §10.11).
import { expect, type Page, test } from "@playwright/test";
import { axeViolations, open } from "./helpers";

const current = (page: Page) => page.locator('[role="tabpanel"][data-current]');

async function openHistory(page: Page, symbol: string) {
  await open(page, `#/${symbol}/history`);
  await expect(page.getByTestId("sheet")).toBeVisible();
  await expect(current(page).getByTestId("history-facts")).toBeVisible();
}

test.describe("history & naming", () => {
  test("renders for H, C, N, P, K, Fe, Tc, I, Gd, Pu and Og without console errors or sideways scrolling", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    page.on("pageerror", (e) => errors.push(String(e)));
    for (const s of ["H", "C", "N", "P", "K", "Fe", "Tc", "I", "Gd", "Pu", "Og"]) {
      await openHistory(page, s);
      const panel = current(page);
      await expect(panel.getByTestId("name-origin")).not.toBeEmpty();
      await expect(panel.getByTestId("discovery-timeline").locator("svg")).toBeVisible();
      const overflow = await panel.evaluate((el) => el.scrollWidth - el.clientWidth);
      expect(overflow, `${s}: the panel scrolls sideways`).toBeLessThanOrEqual(1);
    }
    expect(errors).toEqual([]);
  });

  test("hydrogen: Cavendish in London, a dot on the map, the coordinates as a table", async ({ page }) => {
    await openHistory(page, "H");
    const panel = current(page);
    await expect(panel.getByTestId("history-facts")).toContainText("Henry Cavendish");
    await expect(panel.getByTestId("history-place")).toHaveText("London, United Kingdom");
    const map = panel.getByTestId("place-map");
    await expect(map.locator("svg circle")).toHaveCount(2);
    await expect(map.locator("figcaption")).toContainText("51.50° N");
    await map.getByRole("button", { name: "Show as table" }).click();
    await expect(map.getByRole("rowheader", { name: "London, United Kingdom" })).toBeVisible();
    await expect(map.getByRole("table")).toContainText("0.12° W");
  });

  test("oganesson: Dubna, and its temporary name", async ({ page }) => {
    await openHistory(page, "Og");
    const panel = current(page);
    await expect(panel.getByTestId("history-place")).toContainText("Dubna");
    await expect(panel.getByTestId("place-map").locator("svg text")).toHaveText("Dubna");
    await expect(panel.locator('[data-section="name"]')).toContainText("ununoctium");
  });

  test("an ancient element has no place and no map; an unplaced discovery says so", async ({ page }) => {
    await openHistory(page, "Fe");
    const panel = current(page);
    await expect(panel.getByTestId("history-facts")).toContainText("Known since antiquity");
    await expect(panel.getByTestId("history-place")).toContainText("known in prehistory");
    await expect(panel.getByTestId("place-map")).toHaveCount(0);
    await expect(panel.locator('[data-section="name"]')).toContainText("ferrum");

    await openHistory(page, "Ti");
    await expect(current(page).getByTestId("history-place")).toContainText("no single place");
    await expect(current(page).getByTestId("place-map")).toHaveCount(0);
  });

  test("the timeline marks this element among all 118 and lists them as a table", async ({ page }) => {
    await openHistory(page, "Pu");
    const timeline = current(page).getByTestId("discovery-timeline");
    await expect(timeline.locator("svg rect")).toHaveCount(118);
    await expect(timeline.locator("svg text").first()).toHaveText("Pu");
    await timeline.getByRole("button", { name: "Show as table" }).click();
    await expect(timeline.getByRole("row", { name: /Antiquity/ })).toContainText("Fe");
    await expect(timeline.getByRole("row", { name: /1940s/ })).toContainText("Pu (1940)");
  });

  test("radium shows its historical photograph with its credit", async ({ page }) => {
    await openHistory(page, "Ra");
    const photo = current(page).locator('[data-section="photo"]');
    await expect(photo.locator('img[data-image-kind="historical"]')).toBeVisible();
    await expect(photo.locator("figcaption")).toContainText("radium standard");
    await openHistory(page, "Fe");
    await expect(current(page).locator('[data-section="photo"]')).toHaveCount(0);
  });

  test("axe: the history panel for Fe, Cs, U and Og", async ({ page }) => {
    for (const s of ["Fe", "Cs", "U", "Og"]) {
      await openHistory(page, s);
      expect(await axeViolations(page), s).toEqual([]);
    }
  });
});
