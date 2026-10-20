// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// What a tile shows while a heatmap or categorical map is active (SPEC §8.2, §8.3).

export interface Face {
  kind: "heat" | "map";
  /** CSS colour of the tile. */
  fill: string;
  /** CSS colour of the text, chosen for at least 4.5:1 against the fill. */
  ink: string;
  /** Short text printed on the tile: the value, or the class's short label. */
  text: string;
  /** No value: the tile is hatched and `text` names the reason. */
  missing: boolean;
  /** Full sentence added to the tile's accessible description. */
  description: string;
}

export type Faces = ReadonlyMap<number, Face>;
