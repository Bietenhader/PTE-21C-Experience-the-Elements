// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Orbitals (SPEC §10.1): what this atom's electrons are doing, at honest fidelity.
// - Gallery: one 3D isosurface per occupied subshell (hydrogenic, Z_eff from Clementi–Raimondi or
//   Slater), at the 90 % enclosed-probability level, ordered by orbital energy.
// - Viewer: the chosen subshell in 3D — real or complex orbitals, phase colours, nodal surfaces,
//   a |ψ|² slice.
// - Shell stack: every radial distribution on one axis, to true scale.
// - Nodes table, and the analytic checks.
// The approximation badge is always visible.

import { lazy, type RefObject, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useElementDetail } from "../../data/load";
import { groupDigits, isMissing } from "../../data/format";
import type { ElementIndexEntry, Missing, SourcesFile } from "../../data/types";
import { L_LETTER, type OrbitalKind, orbitalName, REAL_NAMES } from "../../physics/hydrogenic";
import { Formula } from "../../ui/Formula";
import { MissingValue } from "../../ui/Quantity";
import { SideScroll } from "../../ui/SideScroll";
import { SourceChip } from "../../ui/SourceChip";
import { PHASE_NEGATIVE, PHASE_POSITIVE, type OrbitalResult } from "../../viz/orbital/field";
import type { ViewTurn } from "../../viz/orbital/OrbitalViewer";
import { gridSize, requestOrbital } from "../../viz/orbital/pool";
import { drawSlice, thumbnailRenderer } from "../../viz/orbital/render";
import { Badge, Section, SourcesFooter, WhenLoaded } from "../shared/Panel";
import shared from "../shared/panel.module.css";
import { collectSources } from "../shared/sources";
import type { PanelProps } from "../types";
import { A0_PM, ENERGY_METHOD, orderedByEnergy, type SubshellInfo, subshells } from "./model";
import styles from "./orbitals.module.css";
import { ShellStack } from "./ShellStack";

const OrbitalViewer = lazy(() => import("../../viz/orbital/OrbitalViewer"));

type Sources = SourcesFile["sources"];
const THUMB = 220;
/** The orbital's name as read aloud and in labels: "3d xy", not "3d_xy". */
const spokenName = (n: number, l: number, m: number, kind: OrbitalKind) => orbitalName(n, l, m, kind).replace("_", " ");
const css = (c: readonly number[]) => `rgb(${c.map((v) => Math.round(v * 255)).join(" ")})`;

function GalleryTile({
  s,
  element,
  selected,
  onSelect,
  onDrawn,
}: {
  s: SubshellInfo;
  element: ElementIndexEntry;
  selected: boolean;
  onSelect: () => void;
  onDrawn: () => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<"computing" | "3d" | "slice" | "failed">("computing");
  useEffect(() => {
    let live = true;
    const renderer = thumbnailRenderer(THUMB);
    requestOrbital({ n: s.n, l: s.l, m: 0, z: s.zeff.value, kind: "real", grid: gridSize(), slice: renderer ? 0 : 96 })
      .then((o) => {
        if (!live || !canvas.current) return;
        if (renderer) {
          renderer.draw(o, canvas.current);
          setState("3d");
        } else if (o.sliceImage && o.sliceSize) {
          drawSlice(o.sliceImage, o.sliceSize, canvas.current);
          setState("slice");
        }
        onDrawn();
      })
      .catch(() => {
        if (live) {
          setState("failed");
          onDrawn();
        }
      });
    return () => {
      live = false;
    };
    // onDrawn is stable for the gallery's lifetime
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.n, s.l, s.zeff.value]);
  const shape = spokenName(s.n, s.l, 0, "real");
  return (
    <li className={styles.tile} data-valence={s.valence || undefined} data-state={state}>
      <button
        type="button"
        className={styles.tileButton}
        aria-pressed={selected}
        onClick={onSelect}
        aria-label={`${s.label} subshell of ${element.name}: ${s.occupancy} electron${s.occupancy === 1 ? "" : "s"}, effective charge ${s.zeff.value.toFixed(2)}${s.valence ? ", valence" : ""}. Show ${shape} in the 3D view.`}
      >
        <canvas ref={canvas} width={THUMB} height={THUMB} className={styles.thumb} aria-hidden="true" />
        <span className={styles.tileLabel}>
          <b>{s.label}</b>
          <sup>{s.occupancy}</sup>
          {s.valence && <span className={styles.valence}>valence</span>}
        </span>
        <span className={styles.tileMeta}>
          <OrbitalLabel n={s.n} l={s.l} m={0} kind="real" /> · Z<sub>eff</sub> {s.zeff.value.toFixed(2)}
          {state === "computing" ? " · computing…" : state === "slice" ? " · slice" : state === "failed" ? " · could not compute" : ""}
        </span>
      </button>
    </li>
  );
}

function Gallery({
  element,
  list,
  selected,
  onSelect,
}: {
  element: ElementIndexEntry;
  list: SubshellInfo[];
  selected: string;
  onSelect: (key: string) => void;
}) {
  const [drawn, setDrawn] = useState(0);
  const [elapsed, setElapsed] = useState<number | null>(null);
  const count = useRef(0);
  const done = drawn >= list.length;
  // From the gallery's start to its last picture: shown under the gallery, and read by the timing test
  // (SPEC §17.5, M3 acceptance).
  useEffect(() => {
    performance.mark("pte:orbitals-start");
  }, []);
  const onDrawn = () => {
    count.current += 1;
    setDrawn(count.current);
    if (count.current === list.length) {
      const m = performance.measure("pte:orbitals-ready", { start: "pte:orbitals-start", detail: { count: list.length } });
      setElapsed(m.duration);
    }
  };
  const noWebgl = thumbnailRenderer(THUMB) === null;
  return (
    <div>
      <p className={shared.muted}>
        {list.length} occupied subshells{orderedByEnergy(list) ? ", ordered by orbital energy (NIST SRD 141, LDA)" : ", in filling order"}.
        Each shows the m = 0 real orbital at the surface that encloses 90 % of the probability; choose one to turn it, see
        the other orientations and the nodes. Orange and blue are the two signs of ψ. Each tile is scaled to fit its
        orbital; the shell stack below shows their true sizes.
        {noWebgl ? " This browser cannot draw 3D (no WebGL), so each tile shows a slice through the orbital instead." : ""}
      </p>
      <ul
        className={styles.gallery}
        data-testid="orbital-gallery"
        data-drawn={drawn}
        data-total={list.length}
        data-complete={done || undefined}
        aria-label={`Orbital gallery of ${element.name}`}
      >
        {list.map((s) => (
          <GalleryTile
            key={`${s.n},${s.l}`}
            s={s}
            element={element}
            selected={selected === `${s.n},${s.l}`}
            onSelect={() => onSelect(`${s.n},${s.l}`)}
            onDrawn={onDrawn}
          />
        ))}
      </ul>
      {/* Announced once, when the last picture is in; each tile says "computing…" until then. */}
      <p className={shared.muted} aria-live="polite" data-testid="orbital-timing">
        {elapsed !== null &&
          `All ${list.length} computed and drawn in ${(elapsed / 1000).toFixed(1)} s on this device (${gridSize()}³ grid points each).`}
      </p>
    </div>
  );
}

function SliceImage({ o, label }: { o: OrbitalResult; label: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (canvas.current && o.sliceImage && o.sliceSize) drawSlice(o.sliceImage, o.sliceSize, canvas.current);
  }, [o]);
  const halfPm = Math.round(o.half * A0_PM);
  return (
    <figure className={styles.slice}>
      <div role="img" aria-label={label}>
        <canvas ref={canvas} width={240} height={240} aria-hidden="true" />
      </div>
      <figcaption className={shared.muted}>
        |ψ|² in the xz-plane (z up), from −{halfPm} to +{halfPm} pm; brighter is more probable (square-root scale, so the
        outer lobes stay visible).
      </figcaption>
    </figure>
  );
}

const STEP = Math.PI / 8;

/** "3d" with the real orbital's subscript, or "3d, m = −2". */
function OrbitalLabel({ n, l, m, kind }: { n: number; l: number; m: number; kind: OrbitalKind }) {
  if (l === 0) return <>{`${n}s`}</>;
  if (kind === "complex") return <>{orbitalName(n, l, m, kind)}</>;
  return (
    <>
      {n}
      {L_LETTER[l]}
      <sub>{REAL_NAMES[l]?.[m] ?? `m=${m}`}</sub>
    </>
  );
}

function Viewer({ element, s, chosen }: { element: ElementIndexEntry; s: SubshellInfo; chosen: boolean }) {
  const [kind, setKindState] = useState<OrbitalKind>("real");
  // What someone asked to see goes to the head of the queue; the first picture waits for the gallery.
  const [asked, setAsked] = useState(false);
  const urgent = chosen || asked;
  const setKind = (k: OrbitalKind) => {
    setAsked(true);
    setKindState(k);
  };
  // The orientation belongs to the subshell it was chosen for; a new subshell starts at m = 0.
  const here = `${s.n},${s.l}`;
  const [choice, setChoice] = useState({ shell: here, m: 0 });
  const m = choice.shell === here ? choice.m : 0;
  const setM = (mm: number) => {
    setAsked(true);
    setChoice({ shell: here, m: mm });
  };
  const [phase, setPhase] = useState(true);
  const [nodal, setNodal] = useState(false);
  const [slice, setSlice] = useState(false);
  const [turn, setTurn] = useState<ViewTurn>({ seq: 0, dAzimuth: 0, dElevation: 0 });
  // The last orbital that arrived stays on screen while the next one is computed.
  const want = `${here},${m},${kind}`;
  const [result, setResult] = useState<{ key: string; orbital?: OrbitalResult; failed?: boolean } | null>(null);
  const orbital = result?.orbital ?? null;
  const failed = result?.key === want && result.failed === true;
  const pending = result?.key !== want;
  const webgl = thumbnailRenderer(THUMB) !== null;

  useEffect(() => {
    let live = true;
    requestOrbital({ n: s.n, l: s.l, m, z: s.zeff.value, kind, grid: gridSize(), nodal: kind === "real", slice: 160 }, urgent)
      .then((o) => live && setResult({ key: want, orbital: o }))
      .catch(() => live && setResult((r) => ({ key: want, ...(r?.orbital ? { orbital: r.orbital } : {}), failed: true })));
    return () => {
      live = false;
    };
    // `urgent` only orders the queue; a change of it alone needs no new request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.n, s.l, s.zeff.value, m, kind, want]);

  const name = spokenName(s.n, s.l, m, kind);
  const mValues = Array.from({ length: 2 * s.l + 1 }, (_, i) => i - s.l);
  const turnBy = (dAzimuth: number, dElevation: number) => setTurn((t) => ({ seq: t.seq + 1, dAzimuth, dElevation }));
  const label = `${name} orbital of ${element.name} in 3D: hydrogenic, effective charge ${s.zeff.value.toFixed(2)}, surface enclosing 90 % of the probability, ${Math.round((orbital?.half ?? 0) * A0_PM)} pm half-width box.`;

  return (
    <div className={styles.viewer} data-testid="orbital-viewer">
      <div className={styles.controls}>
        <fieldset className={styles.fieldset}>
          <legend>Orbitals</legend>
          <label>
            <input type="radio" name="orbital-kind" checked={kind === "real"} onChange={() => setKind("real")} /> Real (p
            <sub>x</sub>, p<sub>y</sub>, p<sub>z</sub> …)
          </label>
          <label>
            <input type="radio" name="orbital-kind" checked={kind === "complex"} onChange={() => setKind("complex")} /> Complex
            (m<sub>l</sub> = −l … +l)
          </label>
        </fieldset>
        {s.l > 0 && (
          <fieldset className={styles.fieldset}>
            <legend>{kind === "real" ? "Orientation" : <>m<sub>l</sub></>}</legend>
            <div className={styles.mButtons}>
              {mValues.map((mm) => (
                <button
                  key={mm}
                  type="button"
                  aria-pressed={m === mm}
                  aria-label={spokenName(s.n, s.l, mm, kind)}
                  onClick={() => setM(mm)}
                  className={styles.mButton}
                >
                  {kind === "real" ? (
                    <>
                      {L_LETTER[s.l]}
                      <sub>{REAL_NAMES[s.l]?.[mm] ?? `m=${mm}`}</sub>
                    </>
                  ) : (
                    `${mm > 0 ? "+" : mm < 0 ? "−" : ""}${Math.abs(mm)}`
                  )}
                </button>
              ))}
            </div>
          </fieldset>
        )}
        <fieldset className={styles.fieldset}>
          <legend>Show</legend>
          <label>
            <input type="checkbox" checked={phase} onChange={(e) => setPhase(e.target.checked)} /> Phase colours
          </label>
          <label>
            <input type="checkbox" checked={nodal} disabled={kind !== "real"} onChange={(e) => setNodal(e.target.checked)} />{" "}
            Nodal surfaces{kind !== "real" ? " (real orbitals)" : ""}
          </label>
          <label>
            <input type="checkbox" checked={slice} onChange={(e) => setSlice(e.target.checked)} /> |ψ|² slice
          </label>
        </fieldset>
      </div>
      <div className={styles.stage}>
        <div className={styles.canvasBox}>
          {failed && <p className={shared.muted}>This orbital could not be computed.</p>}
          {!failed && !orbital && <p className={shared.muted}>Computing {name}…</p>}
          {!failed && orbital && webgl && (
            <Suspense fallback={<p className={shared.muted}>Loading the 3D view…</p>}>
              <OrbitalViewer orbital={orbital} nodal={nodal && kind === "real"} phase={phase} turn={turn} label={label} />
            </Suspense>
          )}
          {!failed && orbital && !webgl && <SliceImage o={orbital} label={label} />}
          {!failed && orbital && pending && (
            <p className={styles.busy} role="status">
              Computing {name}…
            </p>
          )}
        </div>
        <div className={styles.turns} role="group" aria-label="Turn the 3D view">
          <button type="button" onClick={() => turnBy(-STEP, 0)} aria-label="Turn left">
            ⟲
          </button>
          <button type="button" onClick={() => turnBy(STEP, 0)} aria-label="Turn right">
            ⟳
          </button>
          <button type="button" onClick={() => turnBy(0, STEP)} aria-label="Tilt up">
            ↑
          </button>
          <button type="button" onClick={() => turnBy(0, -STEP)} aria-label="Tilt down">
            ↓
          </button>
          <button type="button" onClick={() => setTurn((t) => ({ seq: t.seq + 1, dAzimuth: 0, dElevation: 0, reset: true }))}>
            Reset view
          </button>
        </div>
        <p className={shared.muted}>
          <b>
            <OrbitalLabel n={s.n} l={s.l} m={m} kind={kind} />
          </b>
          : drag or use the buttons to turn it; z points up.{" "}
          {phase ? (
            kind === "real" ? (
              <>
                <span className={styles.swatch} style={{ background: css(PHASE_POSITIVE) }} aria-hidden="true" /> ψ &gt; 0,{" "}
                <span className={styles.swatch} style={{ background: css(PHASE_NEGATIVE) }} aria-hidden="true" /> ψ &lt; 0.
              </>
            ) : (
              <>Colour is the phase of ψ, turning once around the colour wheel for each unit of m<sub>l</sub> around z.</>
            )
          ) : (
            "One colour: the shape of |ψ|² only."
          )}
          {nodal && kind === "real" ? " Grey sheets are the nodal surfaces, where ψ = 0." : ""}
          {orbital ? ` The surface encloses ${(orbital.enclosed * 100).toFixed(1)} % of the probability in the box.` : ""}
        </p>
        {slice && orbital && webgl && <SliceImage o={orbital} label={`|ψ|² of ${name} in the xz-plane`} />}
      </div>
    </div>
  );
}

/** The source most rows share: shown once in the column header; rows that differ carry their own chip. */
function commonSource(ids: string[]): string | undefined {
  const counts = new Map<string, number>();
  for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
  return [...counts].sort((x, y) => y[1] - x[1])[0]?.[0];
}

const NO_ENERGY: Missing = {
  missing: true,
  reason: "not_measured",
  note: "NIST SRD 141 computes orbital energies for Z = 1–92 only",
};

function NodesTable({ element, list, sources }: { element: ElementIndexEntry; list: SubshellInfo[]; sources: Sources }) {
  const zSource = commonSource(list.map((s) => s.zeff.source));
  const eSource = commonSource(list.flatMap((s) => (s.energy ? [s.energy.source] : [])));
  return (
    <>
      <p className={shared.muted}>
        Radial nodes n − l − 1 and angular nodes l are exact; ⟨r⟩ is hydrogenic with the effective charge shown;
        orbital energies are the {ENERGY_METHOD} eigenvalues of NIST SRD 141.
      </p>
      <SideScroll className={styles.tableWrap} label={`Subshells of ${element.name}`}>
        <table className={styles.table} data-testid="nodes-table">
          <caption className={shared.muted}>Occupied subshells of {element.name}, ground configuration</caption>
          <thead>
            <tr>
              <th scope="col">Subshell</th>
              <th scope="col">n</th>
              <th scope="col">l</th>
              <th scope="col">Electrons</th>
              <th scope="col">Radial nodes</th>
              <th scope="col">Angular nodes</th>
              <th scope="col">
                Z<sub>eff</sub> {zSource && <SourceChip id={zSource} sources={sources} />}
              </th>
              <th scope="col">⟨r⟩ (pm)</th>
              <th scope="col">Orbital energy (eV) {eSource && <SourceChip id={eSource} sources={sources} />}</th>
            </tr>
          </thead>
          <tbody>
            {list.map((s) => (
              <tr key={`${s.n},${s.l}`} data-valence={s.valence || undefined}>
                <th scope="row">
                  {s.label}
                  {s.valence ? " (valence)" : ""}
                </th>
                <td>{s.n}</td>
                <td>
                  {s.l} ({L_LETTER[s.l]})
                </td>
                <td>{s.occupancy}</td>
                <td>{s.radialNodes}</td>
                <td>{s.angularNodes}</td>
                <td>
                  {s.zeff.value.toFixed(s.zeff.method === "slater" ? 2 : 4)}
                  {s.zeff.source !== zSource && (
                    <>
                      {" "}
                      <SourceChip id={s.zeff.source} sources={sources} />
                    </>
                  )}
                </td>
                <td>{s.meanPm.toFixed(1)}</td>
                <td>
                  {s.energy ? (
                    <>
                      {groupDigits(s.energy.eV.toFixed(3))}
                      {s.energy.source !== eSource && (
                        <>
                          {" "}
                          <SourceChip id={s.energy.source} sources={sources} />
                        </>
                      )}
                    </>
                  ) : (
                    <MissingValue m={NO_ENERGY} />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </SideScroll>
    </>
  );
}

function Checks({ s }: { s: SubshellInfo }) {
  const nodeless = s.l === s.n - 1;
  return (
    <div className={styles.checks}>
      <p>
        Mean radius <Formula tex={String.raw`\langle r\rangle = \frac{a_0}{2Z_\mathrm{eff}}\,[3n^2 - l(l+1)]`} /> = {s.meanPm.toFixed(1)} pm
        for {s.label}.
      </p>
      <p>
        {nodeless ? (
          <>
            Most probable radius of a nodeless orbital{" "}
            <Formula tex={String.raw`r^* = \frac{n^2 a_0}{Z_\mathrm{eff}}`} /> = {s.mostProbablePm.toFixed(1)} pm.
          </>
        ) : (
          <>
            Most probable radius (the highest peak of P(r), found numerically): {s.mostProbablePm.toFixed(1)} pm; {s.label} has{" "}
            {s.radialNodes} radial node{s.radialNodes === 1 ? "" : "s"}.
          </>
        )}
      </p>
      <p>
        Nodes: <Formula tex={String.raw`n - l - 1`} /> = {s.radialNodes} radial, <Formula tex="l" /> = {s.angularNodes} angular.
      </p>
    </div>
  );
}

export default function Panel({ element: e, sources }: PanelProps) {
  const detail = useElementDetail(e.Z);
  return (
    <WhenLoaded files={[detail]}>
      {(d) => <Body key={e.Z} e={e} d={d} sources={sources} />}
    </WhenLoaded>
  );
}

/**
 * True once the element has been on screen. The sheet mounts the panels next to the current one in
 * advance; the orbitals are computed only when this panel is actually shown.
 */
function useSeen(ref: RefObject<HTMLElement | null>): boolean {
  const [seen, setSeen] = useState(typeof IntersectionObserver === "undefined");
  useEffect(() => {
    const el = ref.current;
    if (seen || !el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((x) => x.isIntersecting)) {
        setSeen(true);
        io.disconnect();
      }
    });
    io.observe(el);
    return () => io.disconnect();
  }, [ref, seen]);
  return seen;
}

function Body({ e, d, sources }: { e: ElementIndexEntry; d: Parameters<typeof subshells>[1]; sources: Sources }) {
  const root = useRef<HTMLDivElement>(null);
  const seen = useSeen(root);
  const list = useMemo(() => subshells(e, d), [e, d]);
  const initial = [...list].reverse().find((s) => s.valence) ?? list[list.length - 1];
  const [selected, setSelected] = useState(initial ? `${initial.n},${initial.l}` : "");
  const [chosen, setChosen] = useState(false);
  const sel = list.find((s) => `${s.n},${s.l}` === selected) ?? initial;
  const slater = list.some((s) => s.zeff.method === "slater");
  const radii = d.orbitals.radii;
  return (
    <div className={styles.panel} ref={root}>
      <Badge>
        Hydrogenic approximation with Clementi–Raimondi Z<sub>eff</sub>
        {slater ? " (Slater's rules where their table has no value)" : ""}. Angular shapes are exact for one electron;
        radial scale is approximate for many-electron atoms. Tier B (Hartree–Fock radial functions) planned.
      </Badge>
      {e.configuration.flag === "predicted" && (
        <p className={shared.muted}>
          The configuration {e.configuration.measured} is a prediction: no one has measured it.
        </p>
      )}
      <Section title="Orbital gallery" id="gallery">
        {seen ? (
          <Gallery
            element={e}
            list={list}
            selected={selected}
            onSelect={(key) => {
              setChosen(true);
              setSelected(key);
            }}
          />
        ) : (
          <p className={shared.muted}>The pictures are computed when this panel is shown.</p>
        )}
      </Section>
      {sel && seen && (
        <Section title={`${sel.label} in 3D`} id="viewer">
          <Viewer element={e} s={sel} chosen={chosen} />
        </Section>
      )}
      <Section title="Shell stack" id="stack">
        <ShellStack element={e} list={list} selected={sel} radii={{ covalent: radii.covalent, vdw: radii.vdw }} />
      </Section>
      <Section title="Nodes, occupancies and energies" id="nodes">
        <NodesTable element={e} list={list} sources={sources} />
      </Section>
      {sel && (
        <Section title="How the numbers are computed" id="checks">
          <Checks s={sel} />
        </Section>
      )}
      <SourcesFooter
        ids={collectSources(
          e.configuration,
          list.map((s) => ({ source: s.zeff.source })),
          list.filter((s) => s.energy).map((s) => ({ source: s.energy?.source })),
          [radii.covalent, radii.vdw].filter((q) => !isMissing(q)),
          { source: "nist_codata" },
        )}
        sources={sources}
      />
    </div>
  );
}
