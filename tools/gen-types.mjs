// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Generate src/data/types.ts from schema/pte.schema.json (SPEC §5). `--check` fails if it is stale.
import { readFileSync, writeFileSync } from "node:fs";
import { compileFromFile } from "json-schema-to-typescript";

const OUT = new URL("../src/data/types.ts", import.meta.url);
const banner = [
  "// SPDX-License-Identifier: CC-BY-NC-SA-4.0",
  "// GENERATED from schema/pte.schema.json by `npm run gen:types`. Do not edit by hand.",
].join("\n");

let ts = await compileFromFile(new URL("../schema/pte.schema.json", import.meta.url).pathname, {
  bannerComment: banner,
  unreachableDefinitions: true,
  additionalProperties: false,
  style: { printWidth: 110 },
});
// The root of pte.schema.json is only a container for definitions.
const rootStart = ts.indexOf("/**\n * SPDX-License-Identifier");
const rootEnd = ts.indexOf("}\n", ts.indexOf("export interface PTE21CSchema")) + 2;
if (rootStart > 0 && rootEnd > rootStart) ts = ts.slice(0, rootStart) + ts.slice(rootEnd);
ts = ts.replaceAll(/ \*\n \* This interface was referenced by `PTE21CSchema`'s JSON-Schema\n \* via the `definition` "\w+"\.\n/g, "");
ts = ts.replaceAll(/\/\*\*\n \* This interface was referenced by `PTE21CSchema`'s JSON-Schema\n \* via the `definition` "\w+"\.\n \*\/\n/g, "");

if (process.argv.includes("--check")) {
  if (readFileSync(OUT, "utf8") !== ts) {
    console.error("src/data/types.ts is out of date: run `npm run gen:types`");
    process.exit(1);
  }
  console.log("src/data/types.ts is up to date");
} else {
  writeFileSync(OUT, ts);
  console.log("wrote src/data/types.ts");
}
