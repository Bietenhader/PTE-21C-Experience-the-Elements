// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// The table search (SPEC §7.4): name, symbol, Z, keywords ("noble gas", "radioactive",
// "laser-cooled") and comparisons ("ionization > 1000", "melting < 300 K"). Pure functions;
// the search field only shows the result.

import { isMissing } from "../data/format";
import type { Category, ElementIndexEntry } from "../data/types";
import { convertEnergy, convertTemperature, type EnergyUnit, type TemperatureUnit } from "../physics/units";
import { rawQuantity } from "../trends/values";

export interface SearchUnits {
  energy: EnergyUnit;
  temperature: TemperatureUnit;
}

export interface SearchResult {
  /** Matching atomic numbers, best match first (Enter opens the first). */
  matches: number[];
  /** One sentence for the live region. */
  message: string;
}

type Op = ">" | ">=" | "<" | "<=" | "=";

interface NumericField {
  label: string;
  kind: "energy" | "temperature" | "plain";
  get: (e: ElementIndexEntry) => { value: number; unit: string } | null;
}

function quantityField(field: string) {
  return (e: ElementIndexEntry) => {
    const q = rawQuantity(e, field);
    return isMissing(q) ? null : { value: q.value, unit: q.unit };
  };
}

const FIELDS: Record<string, NumericField> = {
  ie1: { label: "first ionization energy", kind: "energy", get: quantityField("ie1") },
  en: { label: "Pauling electronegativity", kind: "plain", get: quantityField("electronegativityPauling") },
  ea: { label: "electron affinity", kind: "energy", get: quantityField("electronAffinity") },
  radius: { label: "covalent radius (pm)", kind: "plain", get: quantityField("radiusCovalent") },
  vdw: { label: "van der Waals radius (pm)", kind: "plain", get: quantityField("radiusVdw") },
  weight: { label: "atomic weight", kind: "plain", get: quantityField("atomicWeight") },
  melting: { label: "melting point", kind: "temperature", get: quantityField("meltingPoint") },
  boiling: { label: "boiling point", kind: "temperature", get: quantityField("boilingPoint") },
  density: { label: "density (g/cm³)", kind: "plain", get: quantityField("density") },
  isotopes: { label: "number of stable isotopes", kind: "plain", get: quantityField("stableIsotopes") },
  z: { label: "atomic number", kind: "plain", get: (e) => ({ value: e.Z, unit: "" }) },
  period: { label: "period", kind: "plain", get: (e) => ({ value: e.period, unit: "" }) },
  group: { label: "group", kind: "plain", get: (e) => (e.group === null ? null : { value: e.group, unit: "" }) },
  year: { label: "year of discovery", kind: "plain", get: (e) => (e.discovery.year === undefined ? null : { value: e.discovery.year, unit: "" }) },
};

const FIELD_ALIASES: Record<string, keyof typeof FIELDS> = {
  ionization: "ie1",
  ionisation: "ie1",
  "ionization energy": "ie1",
  "ionisation energy": "ie1",
  ie: "ie1",
  ie1: "ie1",
  en: "en",
  electronegativity: "en",
  ea: "ea",
  affinity: "ea",
  "electron affinity": "ea",
  radius: "radius",
  "covalent radius": "radius",
  vdw: "vdw",
  "van der waals": "vdw",
  "van der waals radius": "vdw",
  mass: "weight",
  weight: "weight",
  "atomic weight": "weight",
  melting: "melting",
  "melting point": "melting",
  mp: "melting",
  boiling: "boiling",
  "boiling point": "boiling",
  bp: "boiling",
  density: "density",
  isotopes: "isotopes",
  "stable isotopes": "isotopes",
  z: "z",
  "atomic number": "z",
  period: "period",
  group: "group",
  year: "year",
  discovered: "year",
  discovery: "year",
};

const CATEGORY_WORDS: Record<string, Category> = {
  "alkali metal": "alkali-metal",
  "alkaline earth metal": "alkaline-earth-metal",
  "alkaline earth": "alkaline-earth-metal",
  lanthanide: "lanthanide",
  actinide: "actinide",
  "transition metal": "transition-metal",
  "post-transition metal": "post-transition-metal",
  "post transition metal": "post-transition-metal",
  metalloid: "metalloid",
  "reactive nonmetal": "reactive-nonmetal",
  nonmetal: "reactive-nonmetal",
  "noble gas": "noble-gas",
  unknown: "unknown",
};

/** Common spellings that differ from the IUPAC names the table uses. */
const NAME_ALIASES: Record<string, string> = { cesium: "Cs", aluminum: "Al", sulphur: "S" };

type Keyword = { label: string; test: (e: ElementIndexEntry) => boolean | undefined; pending?: string };

const KEYWORDS: Record<string, Keyword> = {
  radioactive: { label: "radioactive (no stable isotope)", test: (e) => e.radioactive },
  stable: { label: "with at least one stable isotope", test: (e) => !e.radioactive },
  anomalous: { label: "with a measured configuration that breaks the Aufbau rule", test: (e) => e.configuration.anomalous },
  madelung: { label: "with a measured configuration that breaks the Aufbau rule", test: (e) => e.configuration.anomalous },
  gas: { label: "gases at standard conditions", test: (e) => e.standardState === "gas" },
  liquid: { label: "liquids at standard conditions", test: (e) => e.standardState === "liquid" },
  solid: { label: "solids at standard conditions", test: (e) => e.standardState === "solid" },
  halogen: { label: "halogens (group 17)", test: (e) => e.group === 17 },
  "laser-cooled": {
    label: "laser-cooled",
    test: (e) => e.flags.laserCooled,
  },
  "laser cooled": {
    label: "laser-cooled",
    test: (e) => e.flags.laserCooled,
  },
  clock: {
    label: "used in atomic clocks or as standard frequencies",
    test: (e) => e.flags.clockSpecies,
  },
  essential: {
    label: "essential for humans or for plants",
    test: (e) => e.flags.essentialHuman || e.flags.essentialPlant,
  },
};

for (const b of ["s", "p", "d", "f"] as const) {
  KEYWORDS[`${b}-block`] = { label: `in the ${b}-block`, test: (e) => e.block === b };
  KEYWORDS[`${b} block`] = { label: `in the ${b}-block`, test: (e) => e.block === b };
}

const COMPARE = /^(.+?)\s*(>=|<=|≥|≤|>|<|=)\s*(−?-?\d+(?:\.\d+)?(?:e[-−]?\d+)?)\s*([a-z°/³µ]*)$/i;
const BARE = /^(period|group|z)\s+(\d+)$/i;

function singular(s: string): string {
  return s.replace(/(?<=metal|gas|nonmetal|lanthanide|actinide|metalloid|halogen)(?:e?s)$/, "");
}

export function search(elements: ElementIndexEntry[], input: string, units: SearchUnits): SearchResult {
  const text = input.trim().replace(/\s+/g, " ");
  if (!text) return { matches: [], message: "" };
  const lower = text.toLowerCase();

  const compare = COMPARE.exec(text);
  const bare = BARE.exec(text);
  const parsed = compare
    ? { field: compare[1] ?? "", op: compare[2] ?? "", value: compare[3] ?? "", unit: compare[4] ?? "" }
    : bare
      ? { field: bare[1] ?? "", op: "=", value: bare[2] ?? "", unit: "" }
      : null;
  const key = parsed && FIELD_ALIASES[parsed.field.toLowerCase().trim()];
  if (parsed && key) {
    const field = FIELDS[key] as NumericField;
    return compareSearch(elements, field, normaliseOp(parsed.op), parseNumber(parsed.value), parsed.unit, units, text);
  }

  const keyword = KEYWORDS[lower] ?? KEYWORDS[singular(lower)];
  if (keyword) {
    const matches = elements.filter((e) => keyword.test(e) === true).map((e) => e.Z);
    if (!matches.length && keyword.pending) return { matches, message: `No data yet: ${keyword.pending}` };
    return { matches, message: describe(elements, matches, `elements ${keyword.label}`) };
  }

  const category = CATEGORY_WORDS[singular(lower)] ?? CATEGORY_WORDS[lower];
  if (category) {
    const matches = elements.filter((e) => e.category === category).map((e) => e.Z);
    return { matches, message: describe(elements, matches, `${singular(lower)} elements`) };
  }

  if (/^\d+$/.test(text)) {
    const z = Number(text);
    const hit = elements.find((e) => e.Z === z);
    return hit
      ? { matches: [z], message: `Atomic number ${z}: ${hit.name}. Press Enter to open it.` }
      : { matches: [], message: `No element has atomic number ${z}.` };
  }

  const ranked: Array<[number, number]> = [];
  const alias = NAME_ALIASES[lower];
  for (const e of elements) {
    const name = e.name.toLowerCase();
    let rank = -1;
    if (e.symbol.toLowerCase() === lower || alias === e.symbol) rank = 0;
    else if (name === lower) rank = 1;
    else if (name.startsWith(lower)) rank = 2;
    else if (lower.length >= 3 && name.includes(lower)) rank = 3;
    if (rank >= 0) ranked.push([rank, e.Z]);
  }
  ranked.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const matches = ranked.map(([, z]) => z);
  if (!matches.length) {
    return {
      matches,
      message: `Nothing matches “${text}”. Try a name, a symbol, an atomic number, or a comparison such as “ionization > 1000”.`,
    };
  }
  return { matches, message: describe(elements, matches, "elements") };
}

function normaliseOp(op: string): Op {
  return ({ "≥": ">=", "≤": "<=" } as Record<string, Op>)[op] ?? (op as Op);
}

function parseNumber(s: string): number {
  return Number(s.replace(/−/g, "-"));
}

function compareSearch(
  elements: ElementIndexEntry[],
  field: NumericField,
  op: Op,
  target: number,
  rawUnit: string,
  units: SearchUnits,
  text: string,
): SearchResult {
  const unit = rawUnit.toLowerCase();
  let energy: EnergyUnit = units.energy;
  let temperature: TemperatureUnit = units.temperature;
  if (field.kind === "energy" && unit) {
    if (unit === "ev") energy = "eV";
    else if (unit === "kj/mol" || unit === "kj") energy = "kJ/mol";
    else return { matches: [], message: `Use eV or kJ/mol for the ${field.label}.` };
  }
  if (field.kind === "temperature" && unit) {
    if (unit === "k") temperature = "K";
    else if (unit === "°c" || unit === "c") temperature = "°C";
    else return { matches: [], message: `Use K or °C for the ${field.label}.` };
  }
  const shownUnit = field.kind === "energy" ? energy : field.kind === "temperature" ? temperature : "";

  let unknown = 0;
  const matches: number[] = [];
  for (const e of elements) {
    const got = field.get(e);
    if (!got) {
      unknown++;
      continue;
    }
    let v = got.value;
    if (field.kind === "energy") v = convertEnergy(v, got.unit as EnergyUnit, energy);
    if (field.kind === "temperature") v = convertTemperature(v, temperature);
    const ok = op === ">" ? v > target : op === ">=" ? v >= target : op === "<" ? v < target : op === "<=" ? v <= target : v === target;
    if (ok) matches.push(e.Z);
  }
  const what = `elements with ${field.label} ${op} ${target}${shownUnit ? ` ${shownUnit}` : ""}`;
  const skipped = unknown ? ` ${unknown} without a value were not compared.` : "";
  if (!matches.length) return { matches, message: `No ${what} (“${text}”).${skipped}` };
  return { matches, message: `${describe(elements, matches, what)}${skipped}` };
}

function describe(elements: ElementIndexEntry[], matches: number[], what: string): string {
  if (!matches.length) return `No ${what}.`;
  const names = matches.slice(0, 5).map((z) => elements[z - 1]?.name ?? String(z));
  const more = matches.length > 5 ? `, and ${matches.length - 5} more` : "";
  const count = matches.length === 1 ? `1 match` : `${matches.length} matches`;
  return `${count} (${what}): ${names.join(", ")}${more}. Press Enter to open ${names[0]}.`;
}
