// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// The orbitals panel (SPEC §10.1) and its M3 acceptance criterion (SPEC §17.5): the gallery draws
// every occupied subshell of Fe, Cs, Gd and Og within 2 s on an M1 Mac (desktop, 96³ grid) and 6 s
// on the mobile profile (64³ grid). CI runners are slower than an M1 and draw WebGL in software, so
// the budget there is multiplied by PTE_PERF_FACTOR (default 4; set it to 1 on an M1 Mac to check
// the criterion itself). The measured times are attached to the test report either way.
import { expect, type Page, test } from "@playwright/test";
import { axeViolations, isPhone, open } from "./helpers";

const FACTOR = Number(process.env.PTE_PERF_FACTOR ?? 4);

/** Waits for the gallery to finish; returns the tile count and the time from its start to its last picture. */
async function galleryDone(page: Page) {
  const gallery = page.getByTestId("orbital-gallery");
  await expect(gallery).toHaveAttribute("data-complete", "true", { timeout: 60_000 });
  const ms = await page.evaluate(() => performance.getEntriesByName("pte:orbitals-ready").at(-1)?.duration ?? Number.NaN);
  return { tiles: await gallery.locator("li").count(), total: Number(await gallery.getAttribute("data-total")), ms };
}

function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(String(e)));
  return errors;
}

test.describe("orbitals panel", () => {
  for (const [symbol, count] of [
    ["Fe", 7],
    ["Cs", 12],
    ["Gd", 14],
    ["Og", 19],
  ] as const) {
    test(`${symbol}: the gallery draws all ${count} occupied subshells within budget`, async ({ page }, info) => {
      const errors = collectErrors(page);
      await open(page, `#/${symbol}/orbitals`);
      const { tiles, total, ms } = await galleryDone(page);
      expect(tiles).toBe(count);
      expect(total).toBe(count);
      await expect(page.getByTestId("orbital-gallery").locator("li[data-state=failed]")).toHaveCount(0);
      const budget = (isPhone(info) ? 6000 : 2000) * FACTOR;
      info.annotations.push({ type: "orbital gallery time", description: `${symbol}: ${Math.round(ms)} ms (budget ${budget} ms)` });
      expect(ms).toBeLessThan(budget);
      expect(errors).toEqual([]);
    });
  }

  test("the approximation is named on screen, and Slater's rules where they are used", async ({ page }) => {
    await open(page, "#/Gd/orbitals");
    const badge = page.getByRole("note").filter({ hasText: "Hydrogenic approximation" });
    await expect(badge).toContainText("Clementi–Raimondi");
    await expect(badge).toContainText("Tier B (Hartree–Fock radial functions) planned");
    await expect(badge).toContainText("Slater's rules");
    // Gadolinium's 5d is not in the Clementi–Raimondi table: its row carries the Slater source.
    const row = page.getByTestId("nodes-table").getByRole("row", { name: /^5d/ });
    await expect(row.getByRole("button", { name: /Slater/ })).toBeVisible();
  });

  test("the viewer: orientations, complex orbitals, nodal surfaces, slice, turning", async ({ page }) => {
    const errors = collectErrors(page);
    await open(page, "#/Fe/orbitals");
    await galleryDone(page);
    await page.getByTestId("orbital-gallery").getByRole("button", { name: /^3d subshell/ }).click();
    const viewer = page.getByTestId("orbital-viewer");
    await expect(page.getByRole("region", { name: "3d in 3D" })).toBeVisible();
    await viewer.getByRole("button", { name: "3d xy" }).click();
    await expect(viewer.getByRole("button", { name: "3d xy" })).toHaveAttribute("aria-pressed", "true");
    await expect(viewer.getByRole("img", { name: /3d xy orbital of Iron in 3D/ })).toBeVisible();
    await viewer.getByLabel("Nodal surfaces").check();
    await expect(viewer).toContainText("Grey sheets are the nodal surfaces");
    await viewer.getByLabel("|ψ|² slice").check();
    await expect(viewer.getByRole("img", { name: /\|ψ\|² of 3d xy in the xz-plane/ })).toBeVisible();
    await viewer.getByRole("button", { name: "Turn left" }).click();
    await viewer.getByRole("button", { name: "Reset view" }).click();
    await viewer.getByLabel(/Complex/).check();
    await viewer.getByRole("button", { name: "3d, m = +2" }).click();
    await expect(viewer.getByRole("img", { name: /3d, m = \+2 orbital of Iron/ })).toBeVisible();
    await expect(viewer.getByLabel(/Nodal surfaces/)).toBeDisabled();
    expect(errors).toEqual([]);
  });

  test("shell stack: linear and log r, and the same numbers as a table", async ({ page }) => {
    await open(page, "#/Gd/orbitals");
    const stack = page.getByTestId("shell-stack");
    await expect(stack.locator("path[data-valence]")).toHaveCount(3);
    await page.getByRole("button", { name: "Linear r" }).click();
    await expect(stack).toContainText("P(r) = r²R²(r) against r");
    await expect(stack).toContainText("The inner shells reach above the top of the chart");
    await page.getByRole("button", { name: "Logarithmic r" }).click();
    await expect(stack).toContainText("r·P(r) against r on a logarithmic axis");
    await stack.getByRole("button", { name: "Show as table" }).click();
    await expect(stack.getByRole("table").getByRole("row")).toHaveCount(15);
    // The comparison radii: gadolinium has both.
    await expect(stack).toContainText("Covalent radius: 196 pm");
  });

  test("no orbital energies beyond uranium: Missing, with the reason", async ({ page }) => {
    await open(page, "#/Og/orbitals");
    const table = page.getByTestId("nodes-table");
    await expect(table.getByText("not measured").first()).toBeVisible();
    await expect(page.getByText("is a prediction: no one has measured it")).toBeVisible();
  });

  test("axe: the orbitals panel for Fe and Og", async ({ page }) => {
    for (const s of ["Fe", "Og"]) {
      await open(page, `#/${s}/orbitals`);
      await galleryDone(page);
      expect(await axeViolations(page, '[role="tabpanel"][data-current]'), s).toEqual([]);
    }
  });
});
