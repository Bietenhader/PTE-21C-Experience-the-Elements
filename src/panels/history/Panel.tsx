// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// History & naming (SPEC §10.11): when, by whom and where the element was found, when it was first
// isolated, where its name and symbol come from, the place on a small world map, and the element's
// moment among all 118 discoveries. The facts are tools/curated/history.toml; the coordinates come
// from a gazetteer (Natural Earth or GeoNames, named per place in tools/curated/places.toml), and the
// outline is Natural Earth's 1:110 m land, simplified by tools/build_lifeandhistory.py.

import { useMemo } from "react";
import { isMissing } from "../../data/format";
import { useElementDetail, useJson } from "../../data/load";
import type { ElementDetailFile, ElementIndexEntry, Missing, SourcesFile, WorldMapFile } from "../../data/types";
import { ElementImages } from "../../ui/ElementImages";
import { MissingValue } from "../../ui/Quantity";
import { SourceChip } from "../../ui/SourceChip";
import { ChartFrame } from "../../viz/ChartFrame";
import viz from "../../viz/viz.module.css";
import { Section, SourcesFooter, WhenLoaded } from "../shared/Panel";
import shared from "../shared/panel.module.css";
import { collectSources } from "../shared/sources";
import type { PanelProps } from "../types";
import styles from "./history.module.css";

type Sources = SourcesFile["sources"];
type History = NonNullable<ElementDetailFile["history"]>;
type Located = { lat: number; lon: number; source: string };

function degrees(v: number, pos: string, neg: string): string {
  return `${Math.abs(v).toFixed(2)}° ${v >= 0 ? pos : neg}`;
}

function located(h: History): Located | null {
  const p = h.placeLocation;
  return p && !isMissing(p) ? (p as Located) : null;
}

function Facts({ e, h, sources }: { e: ElementIndexEntry; h: History; sources: Sources }) {
  const ancient = h.discovered === "antiquity";
  return (
    <dl className={shared.facts} data-testid="history-facts">
      <dt>Discovered</dt>
      <dd>
        {ancient ? "Known since antiquity" : (h.discoveredText ?? String(h.discovered))}{" "}
        <SourceChip id={h.source} sources={sources} />
        {h.doi && (
          <>
            {" "}
            <a href={`https://doi.org/${h.doi}`} className={styles.doi}>
              doi:{h.doi}
            </a>
          </>
        )}
      </dd>
      {h.discoverers && h.discoverers.length > 0 && (
        <>
          <dt>{h.discoverers.length > 1 ? "Discoverers" : "Discoverer"}</dt>
          <dd>{h.discoverers.join(", ")}</dd>
        </>
      )}
      <dt>Where</dt>
      <dd data-testid="history-place">
        {h.place ??
          (ancient ? (
            <span className={shared.muted}>No single place or discoverer; {e.name.toLowerCase()} was known in prehistory.</span>
          ) : (
            <span className={shared.muted}>Our history table names no single place for this discovery.</span>
          ))}
      </dd>
      {h.isolated !== undefined && (
        <>
          <dt>First isolated</dt>
          <dd>
            {h.isolated}
            {h.isolatedBy && h.isolatedBy.length > 0 ? `, by ${h.isolatedBy.join(", ")}` : ""}
          </dd>
        </>
      )}
    </dl>
  );
}

/** Plate carrée: longitude and latitude as straight x and y axes, scaled to the map's bounds. */
function projection(b: WorldMapFile["bounds"], w: number) {
  const hgt = Math.round((w * (b.latMax - b.latMin)) / (b.lonMax - b.lonMin));
  return {
    hgt,
    x: (lon: number) => ((lon - b.lonMin) / (b.lonMax - b.lonMin)) * w,
    y: (lat: number) => ((b.latMax - lat) / (b.latMax - b.latMin)) * hgt,
  };
}

/** The discovery place on Natural Earth's land outline. */
function PlaceMap({ h, at, map, sources }: { h: History; at: Located; map: WorldMapFile; sources: Sources }) {
  const place = h.place ?? "";
  const lat = degrees(at.lat, "N", "S");
  const lon = degrees(at.lon, "E", "W");
  return (
    <ChartFrame
      testId="place-map"
      caption={
        <>
          {place} ({lat}, {lon}).{" "}
          {at.source === map.source ? (
            <>
              Coordinates and land outline (1:110 m, simplified) from <SourceChip id={map.source} sources={sources} />
            </>
          ) : (
            <>
              Coordinates from <SourceChip id={at.source} sources={sources} />; land outline (1:110 m, simplified) from{" "}
              <SourceChip id={map.source} sources={sources} />
            </>
          )}
          . Longitude and latitude are drawn as straight axes, so lands far from the equator look stretched; the map
          stops at {Math.abs(map.bounds.latMin)}° S.
        </>
      }
      table={{
        columns: ["Place", "Latitude", "Longitude", "Gazetteer"],
        rows: [{ key: place, cells: [place, lat, lon, sources[at.source]?.title ?? at.source] }],
      }}
    >
      {({ width, captionId }) => <MapSvg map={map} w={Math.min(width, 720)} at={at} place={place} captionId={captionId} />}
    </ChartFrame>
  );
}

function MapSvg({
  map,
  w,
  at,
  place,
  captionId,
}: {
  map: WorldMapFile;
  w: number;
  at: Located;
  place: string;
  captionId: string;
}) {
  const { hgt, x, y } = projection(map.bounds, w);
  const land = useMemo(() => {
    const p = projection(map.bounds, w);
    const ring = (r: WorldMapFile["rings"][number]) =>
      r.map(([lon, lat], i) => `${i ? "L" : "M"}${p.x(lon).toFixed(1)} ${p.y(lat).toFixed(1)}`).join("") + "Z";
    return map.rings.map(ring).join("");
  }, [map, w]);
  const px = x(at.lon);
  const py = y(at.lat);
  const right = px > w * 0.62;
  const name = place.split(",")[0] ?? place;
  const graticule = [];
  for (let lon = -150; lon <= 150; lon += 30) graticule.push(<line key={`m${lon}`} x1={x(lon)} x2={x(lon)} y1={0} y2={hgt} />);
  for (let lat = -30; lat <= 60; lat += 30) graticule.push(<line key={`p${lat}`} x1={0} x2={w} y1={y(lat)} y2={y(lat)} />);
  return (
    <svg width={w} height={hgt} role="img" aria-labelledby={captionId} className={styles.map}>
      <rect width={w} height={hgt} className={styles.sea} />
      <g className={styles.graticule}>{graticule}</g>
      <path d={land} className={styles.land} />
      <circle cx={px} cy={py} r={9} className={styles.ring} />
      <circle cx={px} cy={py} r={4} className={styles.dot} />
      <text
        x={right ? px - 13 : px + 13}
        y={py < 16 ? py + 14 : py - 6}
        textAnchor={right ? "end" : "start"}
        className={styles.placeLabel}
      >
        {name}
      </text>
    </svg>
  );
}

// --- the timeline of all discoveries ---

const FIRST_DECADE = 1700;
const LAST_DECADE = 2010;

type Bin = { key: string; label: string; members: ElementIndexEntry[] };

function binsOf(elements: ElementIndexEntry[]): Bin[] {
  const bins: Bin[] = [
    { key: "antiquity", label: "Antiquity", members: [] },
    { key: "early", label: `Before ${FIRST_DECADE}`, members: [] },
  ];
  for (let d = FIRST_DECADE; d <= LAST_DECADE; d += 10) bins.push({ key: String(d), label: `${d}s`, members: [] });
  const byKey = new Map(bins.map((b) => [b.key, b]));
  const sorted = [...elements].sort((a, b) => (a.discovery.year ?? -Infinity) - (b.discovery.year ?? -Infinity) || a.Z - b.Z);
  for (const el of sorted) {
    const yr = el.discovery.year;
    const key =
      yr === undefined ? "antiquity" : yr < FIRST_DECADE ? "early" : String(Math.min(LAST_DECADE, Math.floor(yr / 10) * 10));
    byKey.get(key)?.members.push(el);
  }
  return bins;
}

function Timeline({ e, elements, sources }: { e: ElementIndexEntry; elements: ElementIndexEntry[]; sources: Sources }) {
  const bins = useMemo(() => binsOf(elements), [elements]);
  const tallest = Math.max(...bins.map((b) => b.members.length));
  const when = e.discovery.year === undefined ? "known since antiquity" : `discovered ${e.discovery.text}`;
  const ids = collectSources(elements.map((el) => el.discovery));
  return (
    <ChartFrame
      testId="discovery-timeline"
      caption={
        <>
          All {elements.length} elements by when they were discovered, one square per element, stacked by decade; the
          two found before {FIRST_DECADE} share a column. The outlined square is {e.name}, {when}. Years from{" "}
          {ids.map((id, i) => (
            <span key={id}>
              {i > 0 && " and "}
              <SourceChip id={id} sources={sources} />
            </span>
          ))}
          ; for disputed cases the year our history table settled on.
        </>
      }
      table={{
        columns: ["When", "Elements"],
        rows: bins
          .filter((b) => b.members.length > 0)
          .map((b) => ({
            key: b.key,
            cells: [
              b.label,
              b.members.map((m) => (m.discovery.year === undefined ? m.symbol : `${m.symbol} (${m.discovery.year})`)).join(", "),
            ],
          })),
      }}
    >
      {({ width, captionId }) => {
        const left = 4;
        const gap = 6; // between the two undated columns and the decades
        const top = 22;
        const cell = Math.max(5, Math.min(16, Math.floor((width - left - gap) / bins.length)));
        const colX = (col: number) => left + col * cell + (col >= 2 ? gap : 0);
        const w = colX(bins.length);
        const base = top + cell * tallest;
        const hgt = base + 32;
        const col = bins.findIndex((b) => b.members.some((m) => m.Z === e.Z));
        const row = col < 0 ? -1 : (bins[col]?.members.findIndex((m) => m.Z === e.Z) ?? -1);
        const mx = colX(col) + cell / 2;
        // The pointer starts above the column, so it does not cross the squares stacked over this one.
        const my = base - (bins[col]?.members.length ?? 0) * cell;
        return (
          <svg width={w} height={hgt} role="img" aria-labelledby={captionId} className={styles.timeline}>
            <line x1={left} x2={w} y1={base + 0.5} y2={base + 0.5} className={viz.grid} />
            {bins.flatMap((b, c) =>
              b.members.map((m, r) => (
                <rect
                  key={m.Z}
                  x={colX(c) + 0.5}
                  y={base - (r + 1) * cell + 0.5}
                  width={cell - 1}
                  height={cell - 1}
                  className={m.Z === e.Z ? styles.me : styles.other}
                />
              )),
            )}
            {row >= 0 && (
              <>
                <line x1={mx} x2={mx} y1={my - 2} y2={top - 6} className={styles.pointer} />
                <text x={mx} y={top - 9} textAnchor={mx < 30 ? "start" : mx > w - 30 ? "end" : "middle"} className={styles.meLabel}>
                  {e.symbol}
                </text>
              </>
            )}
            <g className={viz.axis}>
              {bins.map((b, c) =>
                Number(b.key) % 100 === 0 ? (
                  <text key={b.key} x={colX(c) + cell / 2} y={base + 13} textAnchor="middle">
                    {b.key}
                  </text>
                ) : null,
              )}
              <text x={left} y={base + 27}>
                {`first two columns: antiquity, then before ${FIRST_DECADE}`}
              </text>
            </g>
          </svg>
        );
      }}
    </ChartFrame>
  );
}

function hasHistoricalPhoto(e: ElementIndexEntry): boolean {
  return e.images.some((img) => img.kind === "historical");
}

function Body({
  e,
  d,
  map,
  elements,
  sources,
}: {
  e: ElementIndexEntry;
  d: ElementDetailFile;
  map: WorldMapFile;
  elements: ElementIndexEntry[];
  sources: Sources;
}) {
  const h = d.history;
  if (!h) {
    return (
      <p className={shared.muted} data-testid="history-missing">
        Our history table has no entry for {e.name.toLowerCase()} yet.
      </p>
    );
  }
  const at = located(h);
  return (
    <div className={styles.panel}>
      <Section title="Discovery" id="discovery">
        <Facts e={e} h={h} sources={sources} />
        {h.note && <p className={styles.note}>{h.note}</p>}
      </Section>

      {h.place && (
        <Section title="Where it was found" id="place">
          {at ? (
            <PlaceMap h={h} at={at} map={map} sources={sources} />
          ) : (
            <p data-testid="place-missing">
              {h.place}: no dot on the map, the location is{" "}
              <MissingValue m={h.placeLocation as Missing} />
            </p>
          )}
        </Section>
      )}

      <Section title="The name" id="name">
        <p data-testid="name-origin">{h.nameOrigin}</p>
        {h.symbolNote && <p className={shared.muted}>{h.symbolNote}</p>}
      </Section>

      <Section title="Among all discoveries" id="timeline">
        <Timeline e={e} elements={elements} sources={sources} />
      </Section>

      {hasHistoricalPhoto(e) && (
        <Section title="A historical photograph" id="photo">
          <ElementImages element={e} size="large" max={2} kind="historical" />
        </Section>
      )}

      <SourcesFooter
        ids={collectSources(h, at ? { source: map.source } : null, elements.map((el) => el.discovery))}
        sources={sources}
      />
    </div>
  );
}

export default function Panel({ element: e, elements, sources }: PanelProps) {
  const detail = useElementDetail(e.Z);
  const map = useJson<WorldMapFile>("worldmap.json");
  return (
    <WhenLoaded files={[detail, map]}>
      {(d, m) => <Body e={e} d={d} map={m} elements={elements} sources={sources} />}
    </WhenLoaded>
  );
}
