// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Spectrum & energy levels (SPEC §10.8): the visible emission spectrum of the neutral atom drawn from
// NIST's lines on black — the discharge-tube look — with the singly charged ion on request; the
// strongest lines; the flame-test colour where documented; and a Grotrian diagram of the lowest
// levels with the strongest transitions, the laser-cooling and clock transitions and the
// ionization limit.

import { scaleLinear } from "d3-scale";
import { type PointerEvent, useMemo, useState } from "react";
import { useColourTable, useElementDetail, useLevels, useMetrology, useSpectra } from "../../data/load";
import { concise } from "../../data/format";
import type {
  ClockRecord,
  ColourMatchingFile,
  ElementDetailFile,
  ElementIndexEntry,
  LaserCooling,
  LevelsFile,
  MetrologyFile,
  SourcesFile,
  SpectraFile,
  SpectralLine,
} from "../../data/types";
import { mixtureColour, toHex, wavelengthColour } from "../../physics/color/cie";
import { MissingValue } from "../../ui/Quantity";
import { SideScroll } from "../../ui/SideScroll";
import { ChartFrame } from "../../viz/ChartFrame";
import viz from "../../viz/viz.module.css";
import { Badge, Section, SourcesFooter, WhenLoaded } from "../shared/Panel";
import shared from "../shared/panel.module.css";
import { collectSources } from "../shared/sources";
import type { PanelProps } from "../types";
import {
  brightness,
  columnOf,
  columns,
  energyFromFrequency,
  energyFromWavelength,
  findPair,
  formatConfiguration,
  formatLevel,
  formatTerm,
  matchLevel,
  type Pair,
  sci3,
  strongest,
} from "./model";
import styles from "./spectrum.module.css";

type Sources = SourcesFile["sources"];

const LOW = 380;
const HIGH = 780;
const TRANSITIONS_DRAWN = 25;

function intensityText(l: SpectralLine): string {
  if (l.intensity !== undefined) return l.intensityText ?? String(l.intensity);
  return "not given by NIST";
}

const LINE_CODES =
  "Letters after an intensity are NIST's line codes — for example r: easily reversed, h: hazy, w: wide, bl: blended, *: intensity shared by several lines.";

const akiText = (l: SpectralLine) => (l.Aki !== undefined ? `${sci3(l.Aki)} s⁻¹` : "not given by NIST");

function transitionText(l: SpectralLine): string {
  if (!l.lower && !l.upper) return "unclassified line";
  return `${formatLevel(l.lower ?? {})} → ${formatLevel(l.upper ?? {})}`;
}

// --- Spectrum strip -----------------------------------------------------------------------------

interface Row {
  label: string;
  lines: SpectralLine[];
  max: number;
  kept: number;
  listed: number;
}

function rowOf(file: SpectraFile, charge: number): Row | null {
  const lines = file.lines.filter((l) => l.charge === charge && l.nm >= LOW && l.nm <= HIGH);
  if (lines.length === 0) return null;
  const sp = file.species.find((s) => s.charge === charge);
  const max = Math.max(0, ...lines.map((l) => l.intensity ?? 0));
  return {
    label: sp?.label ?? `${file.symbol} ${charge === 0 ? "I" : "II"}`,
    lines,
    max,
    kept: sp?.kept ?? lines.length,
    listed: sp?.linesInWindow ?? lines.length,
  };
}

function Strip({ file, cie }: { file: SpectraFile; cie: ColourMatchingFile }) {
  const neutral = rowOf(file, 0);
  const ion = rowOf(file, 1);
  const [withIon, setWithIon] = useState(false);
  const [hover, setHover] = useState<{
    line: SpectralLine;
    x: number;
    y: number;
  } | null>(null);
  const rows = [neutral, withIon ? ion : null].filter((r): r is Row => r !== null);
  const colour = useMemo(() => {
    const m = new Map<number, string>();
    for (const l of file.lines) m.set(l.nm, toHex(wavelengthColour(l.nm, cie) ?? [1, 1, 1]));
    return m;
  }, [file, cie]);

  if (!neutral) {
    return (
      <p>
        <MissingValue
          m={{
            missing: true,
            reason: "not_measured",
            note: ion
              ? `NIST lists no visible lines of the neutral atom; only the singly charged ion (${ion.label}) has lines in this window.`
              : "NIST lists no lines for this element in the visible window.",
          }}
        />
      </p>
    );
  }

  const caption = (
    <>
      Plotted: the visible lines ({LOW}–{HIGH} nm) of the neutral atom, {neutral.label}
      {withIon && ion ? `, and of the singly charged ion, ${ion.label}, in the second row` : ""}, from the NIST Atomic Spectra Database.
      Wavelengths are in air, as NIST gives them in this range. The strip keeps the strongest 400 lines per species ({neutral.label}:{" "}
      {neutral.kept} of {neutral.listed} listed
      {withIon && ion ? `; ${ion.label}: ${ion.kept} of ${ion.listed}` : ""}). Brightness is √(intensity ÷ strongest) with a floor so faint
      lines stay visible; NIST intensities are relative, comparable only within one species, and depend on the light source behind each
      measurement. Dashed lines have no intensity in NIST. {LINE_CODES} Colours: the CIE 1931 observer converted to sRGB, each wavelength at
      full brightness, desaturated toward white where sRGB cannot show it.
    </>
  );
  const shown = rows.flatMap((r) => r.lines.map((l) => ({ l, species: r.label })));
  const table = {
    columns: ["λ in air (nm)", "Species", "Relative intensity", "A_ki", "Transition"],
    rows: shown.map(({ l, species }) => ({
      key: `${species}-${l.nm}`,
      cells: [l.nm, species, intensityText(l), akiText(l), transitionText(l)],
    })),
  };

  const ROW_H = 56;
  const GAP = 10;
  const M = { top: 6, right: 10, bottom: 30, left: 52 };
  const H = M.top + rows.length * ROW_H + (rows.length - 1) * GAP + M.bottom;

  return (
    <>
      {ion && (
        <button type="button" className={styles.toggle} aria-pressed={withIon} onClick={() => setWithIon((v) => !v)}>
          {/* A toggle keeps its name; aria-pressed and the tick carry the state. */}
          <span className={styles.tick} aria-hidden="true">
            {withIon ? "✓" : ""}
          </span>
          Show the singly charged ion ({ion.label})
        </button>
      )}
      <ChartFrame title="Visible emission spectrum" caption={caption} table={table} testId="spectrum-strip">
        {({ width, captionId }) => {
          const x = scaleLinear()
            .domain([LOW, HIGH])
            .range([M.left, width - M.right]);
          const top = (i: number) => M.top + i * (ROW_H + GAP);
          const onMove = (ev: PointerEvent<SVGSVGElement>) => {
            const rect = ev.currentTarget.getBoundingClientRect();
            const px = ev.clientX - rect.left;
            const py = ev.clientY - rect.top;
            const i = rows.findIndex((_, k) => py >= top(k) && py <= top(k) + ROW_H);
            const row = rows[i];
            if (!row) return setHover(null);
            let best: SpectralLine | null = null;
            let dist = 6;
            for (const l of row.lines) {
              const d = Math.abs(x(l.nm) - px);
              if (d < dist) {
                dist = d;
                best = l;
              }
            }
            setHover(best ? { line: best, x: x(best.nm), y: top(i) } : null);
          };
          return (
            <div className={styles.stripBox}>
              <svg
                width={width}
                height={H}
                role="img"
                aria-labelledby={captionId}
                onPointerMove={onMove}
                onPointerDown={onMove}
                onPointerLeave={() => setHover(null)}
                data-testid="spectrum-svg"
              >
                {rows.map((r, i) => (
                  <g key={r.label} data-species={r.label}>
                    <rect x={M.left} y={top(i)} width={width - M.left - M.right} height={ROW_H} className={styles.night} />
                    <text className={viz.label} x={M.left - 6} y={top(i) + ROW_H / 2} dy="0.32em" textAnchor="end">
                      {r.label}
                    </text>
                    {r.lines.map((l) => (
                      <line
                        key={l.nm}
                        x1={x(l.nm)}
                        x2={x(l.nm)}
                        y1={top(i) + 2}
                        y2={top(i) + ROW_H - 2}
                        stroke={colour.get(l.nm)}
                        strokeOpacity={brightness(l.intensity, r.max)}
                        strokeWidth={1.6}
                        strokeDasharray={l.intensity === undefined ? "3 3" : undefined}
                        data-line=""
                      />
                    ))}
                  </g>
                ))}
                <g className={viz.axis}>
                  {[400, 450, 500, 550, 600, 650, 700, 750].map((nm) => (
                    <g key={nm}>
                      <line x1={x(nm)} x2={x(nm)} y1={H - M.bottom} y2={H - M.bottom + 4} className={viz.grid} />
                      <text x={x(nm)} y={H - M.bottom + 16} textAnchor="middle">
                        {nm}
                      </text>
                    </g>
                  ))}
                </g>
                <text className={viz.axisTitle} x={(M.left + width - M.right) / 2} y={H - 2} textAnchor="middle">
                  Wavelength in air (nm)
                </text>
              </svg>
              {hover && (
                <div
                  className={styles.tip}
                  style={{ left: Math.min(Math.max(hover.x - 120, 0), Math.max(0, width - 260)), top: hover.y + ROW_H + 4 }}
                  aria-hidden="true"
                >
                  <strong>{hover.line.nm} nm</strong> (air) · intensity {intensityText(hover.line)} · A_ki {akiText(hover.line)}
                  <br />
                  {transitionText(hover.line)}
                </div>
              )}
            </div>
          );
        }}
      </ChartFrame>
      <Glow row={neutral} cie={cie} />
    </>
  );
}

function Glow({ row, cie }: { row: Row; cie: ColourMatchingFile }) {
  const weighted = row.lines.filter((l) => l.intensity !== undefined).map((l) => ({ nm: l.nm, weight: l.intensity ?? 0 }));
  const rgb = weighted.length ? mixtureColour(weighted, cie) : null;
  if (!rgb) {
    return (
      <p className={styles.glow}>
        Overall glow:{" "}
        <MissingValue
          m={{ missing: true, reason: "not_measured", note: "NIST gives no intensities for these lines, so the colours cannot be mixed." }}
        />
      </p>
    );
  }
  const hex = toHex(rgb);
  return (
    <p className={styles.glow}>
      <span className={styles.swatch} style={{ background: hex }} role="img" aria-label={`Approximate overall glow colour ${hex}`} />
      <span>
        <strong>Approximate overall glow</strong> ({hex}): the colours of the {weighted.length} visible lines with a NIST intensity, mixed
        by those intensities. An approximation — a real lamp's colour depends on its pressure and current, and on lines outside this window.
      </span>
    </p>
  );
}

function StrongestLines({ row, cie }: { row: Row; cie: ColourMatchingFile | null }) {
  const top = strongest(row.lines, 12);
  return (
    <SideScroll className={styles.tableWrap} label={`Strongest lines of ${row.label}`}>
      <table className={styles.table} data-testid="strongest-lines">
        <caption className={styles.tableCaption}>
          The {top.length} strongest visible lines of {row.label} by NIST relative intensity (lines without an intensity follow, by A_ki).
          Wavelengths in air. {LINE_CODES}
        </caption>
        <thead>
          <tr>
            <th scope="col">λ (nm)</th>
            <th scope="col">Relative intensity</th>
            <th scope="col">A_ki</th>
            <th scope="col">Transition</th>
          </tr>
        </thead>
        <tbody>
          {top.map((l) => (
            <tr key={l.nm}>
              <th scope="row">
                {cie && (
                  <span className={styles.dot} style={{ background: toHex(wavelengthColour(l.nm, cie) ?? [1, 1, 1]) }} aria-hidden="true" />
                )}
                {l.nm}
              </th>
              <td>{intensityText(l)}</td>
              <td className={styles.nowrap}>{akiText(l)}</td>
              <td>{transitionText(l)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </SideScroll>
  );
}

// --- Grotrian diagram ---------------------------------------------------------------------------

interface Marked {
  kind: "cooling" | "clock";
  /** "laser cooling", "clock" or "standard frequency", and its short form for the diagram. */
  name: string;
  short: string;
  label: string;
  pair: Pair | null;
  why: string | undefined;
}

function marked(levels: LevelsFile, cooling: LaserCooling[], clocks: ClockRecord[], drawable: (i: number) => boolean): Marked[] {
  const out: Marked[] = [];
  // A pair whose levels lie above the ionization limit is not drawn; say so instead.
  const check = (pair: Pair | null, why: string) =>
    pair && !(drawable(pair.lower) && drawable(pair.upper))
      ? { pair: null, why: "its upper level lies above the ionization limit, outside the diagram" }
      : { pair, why: pair ? undefined : why };
  const seenCool = new Set<number>();
  for (const c of cooling) {
    if (c.charge !== 0 || seenCool.has(c.wavelength.value)) continue;
    seenCool.add(c.wavelength.value);
    const pair = findPair(levels.levels, energyFromWavelength(c.wavelength.value), c.state === "ground");
    out.push({
      kind: "cooling",
      name: "laser cooling",
      short: "cooling",
      label: `${c.wavelength.value} nm (vacuum), ${c.lower} → ${c.upper}`,
      ...check(pair, "its levels are not among the lowest levels listed here"),
    });
  }
  const seenClock = new Set<string>();
  for (const c of clocks) {
    const key = `${c.label}|${c.transition}`;
    if (seenClock.has(key)) continue;
    seenClock.add(key);
    const e = energyFromFrequency(c.frequency.value);
    const pair = findPair(levels.levels, e, true);
    const role = c.definesSecond ? "defines the second" : c.srs ? "secondary representation of the second" : "recommended by the BIPM";
    const clock = c.definesSecond || c.srs;
    out.push({
      kind: "clock",
      name: clock ? "clock" : "standard frequency",
      short: clock ? "clock" : "standard",
      label: `${c.species} ${c.label} (${role})${pair?.twoPhoton ? ", two photons" : ""}`,
      ...check(
        pair,
        e < 0.05 ? "a hyperfine transition inside one level, too small to draw" : "its levels are not among the lowest levels listed here",
      ),
    });
  }
  // Cooling first, then clocks, then other standard frequencies: the diagram labels only the first few.
  const rank = (m: Marked) => (m.kind === "cooling" ? 0 : m.short === "clock" ? 1 : 2);
  return out.sort((a, b) => rank(a) - rank(b));
}

function Grotrian({
  e,
  levels,
  lines,
  detail,
  metrology,
  cie,
}: {
  e: ElementIndexEntry;
  levels: LevelsFile;
  lines: SpectralLine[];
  detail: ElementDetailFile;
  metrology: MetrologyFile;
  cie: ColourMatchingFile | null;
}) {
  const lv = levels.levels;
  const ie1 = detail.em.ionizationEnergies.stages[0];
  const limit = ie1?.eV;
  // Core-excited levels above the first ionization limit (autoionizing) would squash the bound levels
  // into the bottom of the diagram; they stay in the table.
  const drawable = (i: number) => limit === undefined || (lv[i]?.eV ?? Infinity) <= limit;
  const shown = lv.filter((_, i) => drawable(i));
  const hidden = lv.length - shown.length;
  const cols = columns(shown);
  const colIndex = new Map(cols.map((c, i) => [c.key, i]));
  const neutral = lines.filter((l) => l.charge === 0);
  const drawn = strongest(neutral, neutral.length)
    .map((l) => ({ l, lo: matchLevel(l.lower, lv), hi: matchLevel(l.upper, lv) }))
    .filter((t) => t.lo >= 0 && t.hi >= 0 && t.lo !== t.hi && drawable(t.lo) && drawable(t.hi))
    .slice(0, TRANSITIONS_DRAWN);
  const marks = marked(
    levels,
    detail.amo.laserCooling,
    metrology.clocks.filter((c) => c.Z === e.Z && c.charge === 0 && c.kind === "atomic"),
    drawable,
  );
  const roles = new Map<number, string[]>();
  const addRole = (i: number, r: string) => roles.set(i, [...(roles.get(i) ?? []), r]);
  lv.forEach((l, i) => l.eV === 0 && addRole(i, "ground level"));
  lv.forEach((_, i) => !drawable(i) && addRole(i, "above the ionization limit (autoionizing), not drawn"));
  for (const m of marks) {
    if (!m.pair) continue;
    addRole(m.pair.lower, `lower level of the ${m.name} transition ${m.label}`);
    addRole(m.pair.upper, `upper level of the ${m.name} transition ${m.label}`);
  }

  const caption = (
    <>
      Plotted: the lowest {lv.length} energy levels of the neutral atom ({levels.levelsInDatabase} in NIST)
      {hidden > 0
        ? `, less ${hidden} that lie above the ionization limit (core-excited, autoionizing levels, listed in the table but not drawn)`
        : ""}
      , in columns by term — spin multiplicity, orbital angular momentum L, and parity (° marks odd parity); levels whose term NIST writes
      in another coupling, or without a term, share columns at the right. Thin lines: the {drawn.length} strongest visible lines whose two
      levels are both drawn. Bold lines: laser-cooling transitions (solid) and clock or standard frequencies (dashed), found by matching E =
      hc/λ or E = hν to a level difference. The dashed horizontal line is the ionization limit, taken from NIST's ionization-energy table.
      Data: NIST Atomic Spectra Database (levels, lines and ionization energies), BIPM, and the cited laser-cooling papers.
    </>
  );
  const table = {
    columns: ["Energy (eV)", "Configuration", "Term", "J", "Note"],
    rows: lv.map((l, i) => ({
      key: String(i),
      cells: [
        concise(l.eV, l.unc),
        formatConfiguration(l.configuration),
        formatTerm(l.term) || "no term given",
        l.J || "not given",
        (roles.get(i) ?? []).join("; "),
      ],
    })),
  };

  return (
    <>
      <ChartFrame title="Grotrian diagram" caption={caption} table={table} testId="grotrian">
        {({ width, captionId }) => {
          const narrow = width < 520;
          const H = narrow ? 380 : 440;
          const M = { top: 16, right: 12, bottom: narrow ? 70 : 56, left: 48 };
          const maxE = Math.max(limit ?? 0, ...shown.map((l) => l.eV)) * 1.04 || 1;
          const y = scaleLinear()
            .domain([0, maxE])
            .range([H - M.bottom, M.top]);
          const colW = (width - M.left - M.right) / Math.max(1, cols.length);
          const cx = (i: number) => M.left + colW * (colIndex.get(columnOf(lv[i] ?? { term: "", parity: "even" }).key) ?? 0) + colW / 2;
          const half = Math.min(colW * 0.36, 22);
          const rotate = colW < 34;
          let labelled = 0;
          return (
            <svg width={width} height={H} role="img" aria-labelledby={captionId}>
              <g className={viz.axis}>
                {y.ticks(6).map((t) => (
                  <g key={t} transform={`translate(0 ${y(t)})`}>
                    <line x1={M.left} x2={width - M.right} className={viz.grid} />
                    <text x={M.left - 6} dy="0.32em" textAnchor="end">
                      {t}
                    </text>
                  </g>
                ))}
                {cols.map((c, i) => (
                  <text
                    key={c.key}
                    x={M.left + colW * i + colW / 2}
                    y={H - M.bottom + 14}
                    textAnchor={rotate ? "end" : "middle"}
                    transform={rotate ? `rotate(-55 ${M.left + colW * i + colW / 2} ${H - M.bottom + 14})` : undefined}
                  >
                    {c.label}
                  </text>
                ))}
              </g>
              <text className={viz.axisTitle} transform={`translate(12 ${(M.top + H - M.bottom) / 2}) rotate(-90)`} textAnchor="middle">
                Energy above the ground level (eV)
              </text>
              {limit !== undefined && (
                <g>
                  <line x1={M.left} x2={width - M.right} y1={y(limit)} y2={y(limit)} className={styles.limit} />
                  <text className={viz.label} x={width - M.right} y={y(limit) - 4} textAnchor="end">
                    ionization limit {concise(limit, ie1?.unc)} eV
                  </text>
                </g>
              )}
              {drawn.map(({ l, lo, hi }) => (
                <line
                  key={`t-${l.nm}`}
                  x1={cx(lo)}
                  y1={y(lv[lo]?.eV ?? 0)}
                  x2={cx(hi)}
                  y2={y(lv[hi]?.eV ?? 0)}
                  className={styles.transition}
                  stroke={cie ? toHex(wavelengthColour(l.nm, cie) ?? [0.6, 0.6, 0.6]) : undefined}
                >
                  <title>{`${l.nm} nm: ${transitionText(l)}`}</title>
                </line>
              ))}
              {lv.map(
                (l, i) =>
                  drawable(i) && (
                    <line key={`l-${i}`} x1={cx(i) - half} x2={cx(i) + half} y1={y(l.eV)} y2={y(l.eV)} className={styles.level}>
                      <title>{`${concise(l.eV, l.unc)} eV — ${formatLevel(l)}`}</title>
                    </line>
                  ),
              )}
              {marks.map((m, k) => {
                if (!m.pair) return null;
                const x1 = cx(m.pair.lower);
                const y1 = y(lv[m.pair.lower]?.eV ?? 0);
                const x2 = cx(m.pair.upper);
                const y2 = y(lv[m.pair.upper]?.eV ?? 0);
                const showLabel = labelled++ < 4;
                return (
                  <g key={`m-${k}`} data-mark={m.kind}>
                    <line
                      x1={x1}
                      y1={y1}
                      x2={x2 === x1 ? x1 + 1 : x2}
                      y2={y2}
                      className={m.kind === "cooling" ? styles.cooling : styles.clock}
                    >
                      <title>{`${m.name}: ${m.label}`}</title>
                    </line>
                    {showLabel && (
                      <text className={styles.markLabel} x={(x1 + x2) / 2 + 4} y={(y1 + y2) / 2 + k * 11 - 4}>
                        {m.short}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          );
        }}
      </ChartFrame>
      {marks.length > 0 && (
        <ul className={styles.marks} data-testid="marked-transitions">
          {marks.map((m, k) => (
            <li key={k}>
              <span className={m.kind === "cooling" ? styles.keyCooling : styles.keyClock} aria-hidden="true" />
              {m.name.charAt(0).toUpperCase() + m.name.slice(1)}: {m.label}
              {m.pair
                ? ` — drawn from ${formatLevel(lv[m.pair.lower] ?? { configuration: "" })} to ${formatLevel(lv[m.pair.upper] ?? { configuration: "" })}.`
                : ` — not drawn: ${m.why}.`}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

// --- Panel --------------------------------------------------------------------------------------

function Body({ e, d, sources }: { e: ElementIndexEntry; d: ElementDetailFile; sources: Sources }) {
  const spectra = useSpectra(e.Z, d.files.spectra);
  const levels = useLevels(e.Z, d.files.levels);
  const cie = useColourTable();
  const metrology = useMetrology();
  const spectraReady = spectra.state === "ready" ? spectra.value : null;
  const levelsReady = levels.state === "ready" ? levels.value : null;
  const metroReady = metrology.state === "ready" ? metrology.value : null;
  const cieReady = cie.state === "ready" ? cie.value : null;
  const neutral = spectraReady ? rowOf(spectraReady, 0) : null;

  return (
    <div className={styles.panel}>
      <Section title="Visible spectrum" id="strip">
        {d.files.spectra ? (
          <WhenLoaded files={[spectra, cie]}>{(file, table) => <Strip file={file} cie={table} />}</WhenLoaded>
        ) : (
          <p>
            <MissingValue
              m={{ missing: true, reason: "not_measured", note: "NIST lists no lines for this element in the visible window." }}
            />
          </p>
        )}
      </Section>
      <Section title="Strongest lines" id="strongest">
        {d.files.spectra ? (
          neutral ? (
            <StrongestLines row={neutral} cie={cieReady} />
          ) : spectraReady ? (
            <p>
              <MissingValue m={{ missing: true, reason: "not_measured", note: "NIST lists no visible lines of the neutral atom." }} />
            </p>
          ) : (
            <p className={shared.muted}>Loading…</p>
          )
        ) : (
          <p>
            <MissingValue
              m={{ missing: true, reason: "not_measured", note: "NIST lists no lines for this element in the visible window." }}
            />
          </p>
        )}
        <p>
          Flame-test colour:{" "}
          <MissingValue
            m={{
              missing: true,
              reason: "not_measured",
              note: "PTE-21C has not yet compiled sourced flame-test colours; none is shown rather than a guess.",
            }}
          />
        </p>
      </Section>
      <Section title="Energy levels" id="levels">
        {d.files.levels ? (
          <WhenLoaded files={[levels, metrology]}>
            {(lf, m) => <Grotrian e={e} levels={lf} lines={spectraReady?.lines ?? []} detail={d} metrology={m} cie={cieReady} />}
          </WhenLoaded>
        ) : (
          <p>
            <MissingValue
              m={{ missing: true, reason: "not_measured", note: "NIST lists no energy levels for the neutral atom of this element." }}
            />
          </p>
        )}
        {d.files.levels && (
          <Badge>
            The ionization limit drawn is the first ionization energy from NIST's ionization-energy table; the strongest lines drawn are
            those in the visible window only, so ultraviolet and infrared transitions are missing from the diagram.
          </Badge>
        )}
      </Section>
      <SourcesFooter
        ids={collectSources(
          spectraReady,
          levelsReady,
          d.files.levels ? d.em.ionizationEnergies : null,
          d.amo.laserCooling.filter((c) => c.charge === 0),
          metroReady?.clocks.filter((c) => c.Z === e.Z && c.charge === 0 && c.kind === "atomic") ?? [],
          cieReady && d.files.spectra ? cieReady : null,
        )}
        sources={sources}
      />
    </div>
  );
}

export default function Panel({ element: e, sources }: PanelProps) {
  const detail = useElementDetail(e.Z);
  return <WhenLoaded files={[detail]}>{(d) => <Body e={e} d={d} sources={sources} />}</WhenLoaded>;
}
