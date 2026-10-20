// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Performance budgets (SPEC §13.4), measured with Lighthouse against the production build:
//   1. Lighthouse performance score ≥ 90 on its mobile profile (simulated slow 4G, 4× CPU);
//   2. initial JavaScript ≤ 300 kB gzip (lazily loaded chunks excluded);
//   3. index.json ≤ 150 kB gzip;
//   4. first table paint < 1.5 s on the same mobile profile with the throttling applied for
//      real (Lighthouse's "devtools" method), read from the app's own `pte:table` mark.
// The build is served the way GitHub Pages serves it: under the repository path, gzip-compressed.
//
//   npm run build && npm run lighthouse          (CHROME_PATH may point at a Chrome/Chromium binary)

import { spawn } from "node:child_process";
import { readFileSync, existsSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";
import { gzipSync } from "node:zlib";

const ROOT = resolve(import.meta.dirname, "..");
const DIST = join(ROOT, "dist");
const BASE = "/PTE-21C-Experience-the-Elements/";
const PORT = 4180;
const URL = `http://localhost:${PORT}${BASE}`;
const OUT = join(ROOT, "lighthouse-report");

const BUDGET = { score: 0.9, initialJsGzip: 300_000, indexGzip: 150_000, tablePaintMs: 1500 };

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".webp": "image/webp",
  ".map": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
};
const COMPRESS = new Set([".html", ".js", ".css", ".json", ".svg", ".map", ".txt"]);

function serve() {
  const server = createServer((req, res) => {
    const path = decodeURIComponent((req.url ?? "/").split("?")[0] ?? "/");
    if (!path.startsWith(BASE)) {
      res.writeHead(404).end();
      return;
    }
    let file = normalize(join(DIST, path.slice(BASE.length)));
    if (!file.startsWith(DIST)) {
      res.writeHead(403).end();
      return;
    }
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
    if (!existsSync(file)) {
      res.writeHead(404).end();
      return;
    }
    const ext = extname(file);
    let body = readFileSync(file);
    const headers = { "content-type": TYPES[ext] ?? "application/octet-stream", "cache-control": "max-age=600" };
    if (COMPRESS.has(ext) && /\bgzip\b/.test(req.headers["accept-encoding"] ?? "")) {
      body = gzipSync(body);
      headers["content-encoding"] = "gzip";
    }
    res.writeHead(200, headers).end(body);
  });
  return new Promise((ok) => server.listen(PORT, () => ok(server)));
}

function lighthouse(args) {
  const chromeFlags = "--headless=new --no-sandbox --disable-gpu";
  return new Promise((ok, fail) => {
    const p = spawn(
      "npx",
      ["lighthouse", URL, "--quiet", "--output=json", "--output-path=stdout", "--only-categories=performance", `--chrome-flags=${chromeFlags}`, ...args],
      { cwd: ROOT, env: process.env, stdio: ["ignore", "pipe", "inherit"] },
    );
    let out = "";
    p.stdout.on("data", (d) => (out += d));
    p.on("exit", (code) => (code === 0 ? ok(JSON.parse(out)) : fail(new Error(`lighthouse exited with ${code}`))));
  });
}

const kB = (n) => `${(n / 1000).toFixed(1)} kB`;

if (!existsSync(join(DIST, "index.html"))) {
  console.error("No build found: run `npm run build` first.");
  process.exit(2);
}
mkdirSync(OUT, { recursive: true });
const server = await serve();
let failed = false;
const lines = [];
const check = (ok, text) => {
  lines.push(`${ok ? "✓" : "✗"} ${text}`);
  if (!ok) failed = true;
};

try {
  const simulated = await lighthouse([]);
  writeFileSync(join(OUT, "mobile-simulated.json"), JSON.stringify(simulated));
  const score = simulated.categories.performance.score;
  check(score >= BUDGET.score, `performance score ${Math.round(score * 100)} (budget ≥ ${BUDGET.score * 100})`);
  for (const id of ["first-contentful-paint", "largest-contentful-paint", "total-blocking-time", "cumulative-layout-shift"]) {
    lines.push(`  ${simulated.audits[id].title}: ${simulated.audits[id].displayValue}`);
  }

  const requests = simulated.audits["network-requests"].details.items;
  const scripts = requests.filter((r) => r.resourceType === "Script" && r.url.startsWith(URL));
  const jsGzip = scripts.reduce((sum, r) => sum + gzipSync(readFileSync(join(DIST, new globalThis.URL(r.url).pathname.slice(BASE.length)))).length, 0);
  check(jsGzip <= BUDGET.initialJsGzip, `initial JavaScript ${kB(jsGzip)} gzip in ${scripts.length} file(s) (budget ≤ ${kB(BUDGET.initialJsGzip)})`);

  const indexGzip = gzipSync(readFileSync(join(DIST, "data/index.json"))).length;
  check(indexGzip <= BUDGET.indexGzip, `index.json ${kB(indexGzip)} gzip (budget ≤ ${kB(BUDGET.indexGzip)})`);

  const applied = await lighthouse(["--throttling-method=devtools"]);
  writeFileSync(join(OUT, "mobile-applied.json"), JSON.stringify(applied));
  const marks = applied.audits["user-timings"]?.details?.items ?? [];
  const mark = marks.find((m) => m.name === "pte:table");
  check(
    mark !== undefined && mark.startTime < BUDGET.tablePaintMs,
    `first table paint ${mark ? `${Math.round(mark.startTime)} ms` : "not recorded"} with throttling applied (budget < ${BUDGET.tablePaintMs} ms)`,
  );
} finally {
  server.close();
}

const report = lines.join("\n");
console.log(report);
writeFileSync(join(OUT, "summary.txt"), `${report}\n`);
process.exit(failed ? 1 : 0);
