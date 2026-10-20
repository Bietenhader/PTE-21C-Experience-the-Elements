// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Licence audit of npm dependencies (SPEC §15.2). Fails on any GPL/AGPL/LGPL package (unless it is
// also offered under a permissive licence), on any shipped (production) package that is not
// permissive, and on any package without a licence. Prints the production list for NOTICE.md.
import { execFileSync } from "node:child_process";

const PERMISSIVE = new Set([
  "MIT", "MIT-0", "ISC", "BSD-2-Clause", "BSD-3-Clause", "0BSD", "Apache-2.0", "BlueOak-1.0.0",
  "CC0-1.0", "CC-BY-3.0", "CC-BY-4.0", "Unlicense", "Python-2.0", "PSF-2.0", "OFL-1.1", "Zlib", "WTFPL",
]);
// Weak copyleft, allowed only for tools that are never shipped to visitors
// (axe-core for the accessibility tests and lightningcss inside Vite are MPL-2.0).
const DEV_ONLY = new Set(["MPL-2.0"]);

const query = (selector) =>
  JSON.parse(execFileSync("npm", ["query", selector], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }));

const licenceOf = (pkg) => (typeof pkg.license === "string" ? pkg.license : pkg.license?.type) ?? "";
const options = (expr) => expr.replace(/[()]/g, "").split(/\s+OR\s+/).map((s) => s.trim());
const choose = (expr, allowed) => options(expr).find((o) => allowed.has(o));

const problems = [];
const all = query("*").filter((p) => p.name !== "pte-21c"); // the project itself is CC BY-NC-SA
const prod = query(".prod").filter((p) => p.name !== "pte-21c");
const prodNames = new Set(prod.map((p) => `${p.name}@${p.version}`));

for (const pkg of all) {
  const id = `${pkg.name}@${pkg.version}`;
  const lic = licenceOf(pkg);
  const shipped = prodNames.has(id);
  if (!lic) problems.push(`${id}: no licence declared`);
  else if (shipped && !choose(lic, PERMISSIVE)) problems.push(`${id}: shipped to visitors under ${lic}`);
  else if (!choose(lic, PERMISSIVE) && !choose(lic, DEV_ONLY)) problems.push(`${id}: ${lic} is not allowed`);
}

console.log("Shipped (production) packages:");
for (const pkg of prod) console.log(`  ${pkg.name}@${pkg.version}  ${licenceOf(pkg)}`);
const devOnly = all.filter((p) => !prodNames.has(`${p.name}@${p.version}`) && !choose(licenceOf(p), PERMISSIVE));
if (devOnly.length) {
  console.log("Development-only packages under weak-copyleft licences (never shipped):");
  for (const pkg of devOnly) console.log(`  ${pkg.name}@${pkg.version}  ${licenceOf(pkg)}`);
}
console.log(`${all.length} packages checked.`);
if (problems.length) {
  console.error(`\nLicence problems:\n  ${problems.join("\n  ")}`);
  process.exit(1);
}
console.log("licence check: ok");
