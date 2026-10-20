<!-- SPDX-License-Identifier: CC-BY-NC-SA-4.0 -->
# Honesty rules

*A plausible number without a source is a worse failure than a visible gap* (SPEC §0). These are the
mechanisms that make that true; most are enforced by tests.

## Every number carries its source

Every value in `public/data/` is a `Quantity`: `value`, `unit` from the units table, `source` (a key of the
registry), and `unc` when the source gives an uncertainty (`unc: 0` means exact by definition). The tests
fail if a `source` is not in the registry or a unit is not in the table. On screen, hovering a value shows
it in full NIST notation with its source.

## Missing is shown, with a reason

A value that does not exist is a `Missing` with one of five reasons and a note in plain words. It is never
0 and never a bare dash.

| Reason | Meaning | Example on the tile |
|---|---|---|
| `not_measured` | No value in our sources — including, until M2, "not yet in the curated table" (the note says which) | `hfs n/m` (hydrogen) |
| `not_applicable` | Physics rules the quantity out | `no hfs (J = 0)` (helium), `no hfs (I = 0)` (cerium) |
| `no_stable_isotope` | The quantity needs a stable isotope and there is none | `hfs: no stable isotope` (technetium) |
| `predicted_only` | Only theoretical predictions exist | IE₁ of oganesson: `pred. only` |
| `source_unavailable_at_build` | The source could not be reached when the data was built | `src n/a` |

## Flags say how a value was obtained

`measured`, `calculated` (ab initio), `interpolated` (semi-empirical), `estimated`, `predicted`. NIST's own
markers are kept on the tile: ionization energies in `[ ]` are semi-empirical, in `( )` theoretical —
which is why hydrogen's IE₁ appears in parentheses: NIST lists a theoretical value for it.

## Measured over conventional

Configurations are NIST's measured ground states, not the Aufbau rule. The Madelung prediction is generated
next to it, and the 20 elements where they differ carry ◆ on the tile. A test asserts the set; if NIST
changes, the test reports it.

## Approximations are named

Predicted configurations carry †. From M3 the orbital pictures carry the badge "hydrogenic approximation,
Clementi–Raimondi Z_eff", and from M4 nucleosynthesis fractions carry "approximate".
