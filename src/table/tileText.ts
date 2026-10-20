// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Everything a tile says, derived from one index entry (SPEC §7.1). Pure, so it can be unit-tested;
// Tile.tsx only lays it out. Each visible value carries a tooltip naming its source.

import {
  MISSING_TEXT,
  concise,
  describeMissing,
  formatQuantity,
  fraction,
  groupDigits,
  isInterval,
  isMissing,
  shortest,
  signed,
  tileNumber,
} from "../data/format";
import type { Category, ElementIndexEntry, Missing, SourcesFile, Subshell } from "../data/types";
import { kjPerMolToEv } from "../physics/units";

export const CATEGORY_NAME: Record<Category, string> = {
  "alkali-metal": "alkali metal",
  "alkaline-earth-metal": "alkaline earth metal",
  lanthanide: "lanthanide",
  actinide: "actinide",
  "transition-metal": "transition metal",
  "post-transition-metal": "post-transition metal",
  metalloid: "metalloid",
  "reactive-nonmetal": "reactive nonmetal",
  "noble-gas": "noble gas",
  unknown: "unknown properties",
};

export interface Field {
  text: string;
  title: string;
  missing: boolean;
}

export interface TileText {
  weight: Field;
  ie: Field;
  en: Field;
  /** All oxidation states, highest first, as on the reference table; `common` ones are shown bold. */
  ox: { states: Array<{ text: string; common: boolean }>; title: string };
  config: { core: string | undefined; subshells: Subshell[]; anomalous: boolean; predicted: boolean; title: string };
  hfs: Field & { isotope?: number };
  label: string;
  description: string;
}

type Sources = SourcesFile["sources"];

export function sourceName(sources: Sources, id: string): string {
  return sources[id]?.title ?? id;
}

function missingField(m: Missing, what: string): Field {
  return { text: MISSING_TEXT[m.reason].short, title: `${what}: ${describeMissing(m)}`, missing: true };
}

function weight(e: ElementIndexEntry, sources: Sources): Field {
  const w = e.atomicWeight;
  if (isMissing(w)) {
    if (e.mostStableMassNumber !== undefined) {
      return {
        text: `(${e.mostStableMassNumber})`,
        title:
          `No standard atomic weight. (${e.mostStableMassNumber}) is the mass number of the longest-lived isotope ` +
          `(${sourceName(sources, "iaea_livechart")}). ${w.note ?? ""}`.trim(),
        missing: false,
      };
    }
    return missingField(w, "Standard atomic weight");
  }
  if (isInterval(w)) {
    const conv = w.conventional;
    return {
      text: conv ? tileNumber(conv.value, 4) : `${w.low}–${w.high}`,
      title:
        `Standard atomic weight: the interval [${w.low}, ${w.high}] (${sourceName(sources, w.source)}).` +
        (conv ? ` Shown: ${conv.value} — ${conv.note ?? ""} (${sourceName(sources, conv.source)})` : ""),
      missing: false,
    };
  }
  return {
    text: tileNumber(w.value, 4),
    title: `Standard atomic weight ${concise(w.value, w.unc)} (${sourceName(sources, w.source)})`,
    missing: false,
  };
}

function ionization(e: ElementIndexEntry, sources: Sources): Field {
  const q = e.ie1;
  if (isMissing(q)) return missingField(q, "First ionization energy");
  const v = tileNumber(q.value, 1);
  const text = q.flag === "interpolated" ? `[${v}]` : q.flag === "calculated" ? `(${v})` : v;
  const ev = kjPerMolToEv(q.value);
  return {
    text,
    title:
      `First ionization energy ${formatQuantity(q)} ≈ ${ev.toFixed(4)} eV` +
      (q.flag && q.flag !== "measured" ? ` — ${q.flag}` : "") +
      ` (${sourceName(sources, q.source)})`,
    missing: false,
  };
}

function electronegativity(e: ElementIndexEntry, sources: Sources): Field {
  const q = e.electronegativityPauling;
  if (isMissing(q)) return missingField(q, "Pauling electronegativity");
  return {
    text: shortest(q.value),
    title: `Pauling electronegativity ${shortest(q.value)} (${sourceName(sources, q.source)})`,
    missing: false,
  };
}

function hyperfine(e: ElementIndexEntry, sources: Sources): Field & { isotope?: number } {
  const h = e.hyperfineHeadline;
  if (!isMissing(h)) {
    const s = h.splitting;
    return {
      text: `${groupDigits(shortest(s.value))} Hz`,
      isotope: h.isotope,
      title:
        `Ground-state hyperfine splitting of ${h.isotope}${e.symbol}: ${formatQuantity(s)}` +
        `${s.note ? ` — ${s.note}` : ""} (${sourceName(sources, s.source)})`,
      missing: false,
    };
  }
  const note = h.note ?? "";
  const text =
    h.reason === "not_applicable"
      ? note.includes("J = 0")
        ? "no hfs (J = 0)"
        : note.includes("I = 0")
          ? "no hfs (I = 0)"
          : "no hfs (n/a)"
      : h.reason === "not_measured"
        ? "hfs n/m"
        : `hfs: ${MISSING_TEXT[h.reason].short}`;
  return { text, title: `Ground-state hyperfine splitting: ${describeMissing(h)}`, missing: true };
}

function configuration(e: ElementIndexEntry, sources: Sources): TileText["config"] {
  const c = e.configuration;
  const predicted = c.flag === "predicted";
  let title = `Ground configuration ${c.measured} (${sourceName(sources, c.source)})`;
  if (predicted) title = `Predicted ground configuration ${c.measured}. ${c.note ?? ""}`;
  if (c.anomalous) title += `. The Aufbau (Madelung) rule predicts ${c.aufbau}`;
  return {
    core: /^\[([A-Z][a-z]?)\]/.exec(c.measured)?.[1],
    subshells: c.valenceSubshells,
    anomalous: c.anomalous,
    predicted,
    title,
  };
}

export function tileText(e: ElementIndexEntry, sources: Sources): TileText {
  const w = weight(e, sources);
  const ie = ionization(e, sources);
  const en = electronegativity(e, sources);
  const hfs = hyperfine(e, sources);
  const config = configuration(e, sources);
  const ox = e.oxidationStates;
  const oxTitle =
    `Oxidation states (${sourceName(sources, ox.source)}${ox.flag === "predicted" ? ", predicted" : ""}): ` +
    (ox.common.length ? `common ${ox.common.map(signed).join(", ")}` : "no common states listed") +
    (ox.other.length ? `; others ${ox.other.map(signed).join(", ")}` : "") +
    (ox.note ? `. ${ox.note}` : "");

  // The symbol is in the name so speech-input users can say "click Cs" (WCAG 2.5.3, label in name).
  const label = `${e.name} (${e.symbol}), atomic number ${e.Z}, ${CATEGORY_NAME[e.category]}.`;
  const sentences = [
    `${e.block}-block, period ${e.period}${e.group === null ? "" : `, group ${e.group}`}.`,
    `${w.title}.`,
    `${ie.title}.`,
    `${en.title}.`,
    `${oxTitle}.`,
    `${config.title}.`,
    `${hfs.title}.`,
    e.radioactive ? "Radioactive: no stable isotope." : "",
  ];
  return {
    weight: w,
    ie,
    en,
    ox: {
      states: [...ox.common.map((v) => ({ v, common: true })), ...ox.other.map((v) => ({ v, common: false }))]
        .sort((a, b) => b.v - a.v)
        .map(({ v, common }) => ({ text: signed(v), common })),
      title: oxTitle,
    },
    config,
    hfs,
    label,
    description: sentences
      .filter(Boolean)
      .join(" ")
      .replace(/\.\.+/g, ".")
      .replace(/\s+/g, " "),
  };
}

export function fractionText(x: number): string {
  return fraction(x);
}
