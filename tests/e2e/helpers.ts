// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Shared helpers for the end-to-end tests.
import AxeBuilder from "@axe-core/playwright";
import { type BrowserContext, expect, type Page, type TestInfo } from "@playwright/test";

export const tile = (page: Page, z: number) => page.locator(`button[data-z="${z}"]`);

export async function open(page: Page, hash = "") {
  await page.goto(`./${hash}`);
  await expect(page.locator("button[data-z]")).toHaveCount(118);
}

export const isPhone = (info: TestInfo) => info.project.use.isMobile === true;

/** Waits until no layout morph (or other animation) is running. */
export async function settled(page: Page) {
  await page.waitForFunction(() => document.getAnimations().length === 0, null, { timeout: 10_000 });
}

/** Every tile's position, by Z. */
export async function positions(page: Page) {
  return page.locator("button[data-z]").evaluateAll((els) =>
    Object.fromEntries(
      els.map((e) => {
        const r = e.getBoundingClientRect();
        return [Number((e as HTMLElement).dataset.z), { x: Math.round(r.x), y: Math.round(r.y) }];
      }),
    ),
  ) as Promise<Record<number, { x: number; y: number }>>;
}

export async function chooseLayout(page: Page, label: "Standard" | "Long form" | "Janet" | "ADOMAH") {
  await page.getByRole("radio", { name: label, exact: true }).check();
}

/** axe-core with the WCAG 2.2 AA rule set; returns critical and serious violations only. */
export async function axeViolations(page: Page, include?: string) {
  let builder = new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"])
    // axe's experimental label-content-name-mismatch wants every visible character of a tile (all of
    // its data) inside the button's name. WCAG 2.5.3 concerns the text that labels a control — here
    // the symbol and the name — which table.spec.ts checks directly. See docs/approach.md.
    .disableRules(["label-content-name-mismatch"]);
  if (include) builder = builder.include(include);
  const results = await builder.analyze();
  return results.violations
    .filter((v) => v.impact === "critical" || v.impact === "serious")
    .map((v) => `${v.id}: ${v.help} (${v.nodes.length}) ${v.nodes[0]?.target.join(" ") ?? ""}`);
}

/** A one-finger horizontal swipe with real touch events (Chromium, via the DevTools protocol). */
export async function swipe(context: BrowserContext, page: Page, from: { x: number; y: number }, dx: number) {
  const cdp = await context.newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [from] });
  const steps = 12;
  for (let i = 1; i <= steps; i++) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: from.x + (dx * i) / steps, y: from.y }] });
    await page.waitForTimeout(16);
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}

/** Two-finger pinch about a point, with real touch events (Chromium). */
export async function pinch(context: BrowserContext, page: Page, at: { x: number; y: number }, from: number, to: number) {
  const cdp = await context.newCDPSession(page);
  const points = (d: number) => [
    { x: at.x - d / 2, y: at.y, id: 0 },
    { x: at.x + d / 2, y: at.y, id: 1 },
  ];
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: points(from) });
  const steps = 10;
  for (let i = 1; i <= steps; i++) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: points(from + ((to - from) * i) / steps) });
    await page.waitForTimeout(16);
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}

/** Press and hold one finger on a point (Chromium). */
export async function longPress(context: BrowserContext, page: Page, at: { x: number; y: number }, ms = 600) {
  const cdp = await context.newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [at] });
  await page.waitForTimeout(ms);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}
