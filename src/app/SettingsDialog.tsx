// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Settings (SPEC §9.3): palette, units, motion, theme and keyboard shortcuts. Layout and group 3
// are set above the table. Changes apply at once and are remembered in this browser only.

import { useEffect, useId, useRef } from "react";
import { type Settings, useSettings, useView } from "./store";
import styles from "./SettingsDialog.module.css";

type Choice<K extends keyof Settings> = { key: K; legend: string; options: Array<[Settings[K], string]> };

const CHOICES = [
  { key: "theme", legend: "Theme", options: [["dark", "Dark"], ["light", "Light"]] },
  { key: "palette", legend: "Category colours", options: [["campion", "Campion (close to the reference table)"], ["colour-safe", "Colour-safe (Okabe–Ito)"]] },
  { key: "energyUnit", legend: "Energies", options: [["kJ/mol", "kJ/mol"], ["eV", "eV"]] },
  { key: "temperatureUnit", legend: "Temperatures", options: [["K", "kelvin (K)"], ["°C", "degrees Celsius (°C)"]] },
  { key: "motion", legend: "Motion", options: [["system", "Follow my system setting"], ["reduce", "Reduce motion"], ["full", "Full motion"]] },
] as const satisfies ReadonlyArray<Choice<"theme"> | Choice<"palette"> | Choice<"energyUnit"> | Choice<"temperatureUnit"> | Choice<"motion">>;

export function SettingsDialog() {
  const open = useView((s) => s.settingsOpen);
  const settings = useSettings();
  const dialog = useRef<HTMLDialogElement>(null);
  const ids = useId();

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={dialog}
      className={styles.dialog}
      aria-labelledby={`${ids}-title`}
      onClose={() => useView.setState({ settingsOpen: false })}
      {...{ closedby: "any" }}
    >
      <form method="dialog" className={styles.form}>
        <h2 id={`${ids}-title`} className={styles.title}>
          Settings
        </h2>
        {CHOICES.map((c) => (
          <fieldset key={c.key} className={styles.fieldset}>
            <legend>{c.legend}</legend>
            {c.options.map(([value, label]) => (
              <label key={value} className={styles.option}>
                <input
                  type="radio"
                  name={`${ids}-${c.key}`}
                  value={value}
                  checked={settings[c.key] === value}
                  onChange={() => settings.set(c.key, value as never)}
                />
                {label}
              </label>
            ))}
          </fieldset>
        ))}
        <fieldset className={styles.fieldset}>
          <legend>Keyboard</legend>
          <label className={styles.option}>
            <input type="checkbox" checked={settings.shortcuts} onChange={(e) => settings.set("shortcuts", e.target.checked)} />
            Single-key shortcuts: <kbd>/</kbd> search, <kbd>L</kbd> next layout, <kbd>T</kbd> trends
          </label>
        </fieldset>
        <p className={styles.note}>
          Layout and group 3 are chosen above the table. Settings are kept in this browser only (local storage);
          nothing is sent anywhere.
        </p>
        <div className={styles.actions}>
          <button type="button" onClick={() => settings.reset()}>
            Reset to defaults
          </button>
          <button type="submit" className={styles.primary}>
            Done
          </button>
        </div>
      </form>
    </dialog>
  );
}
