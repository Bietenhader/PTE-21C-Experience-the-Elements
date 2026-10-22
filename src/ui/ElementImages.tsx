// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Element photographs (SPEC §9.1, §9.2, §12): vendored WebP, lazy, with explicit dimensions. In the
// sheet every photo carries its credit — title, author, licence linked to its text, and a link to
// the source page (SPEC §15.4); in the hover card, which is not interactive, the credit is the
// tooltip. Elements without a free photograph show an honest placeholder card whose sentence and
// numbers come from the data (SPEC §12.5).

import type { ElementIndexEntry, ImagePlaceholder, ImageRef } from "../data/types";
import styles from "./ElementImages.module.css";

interface Props {
  element: ElementIndexEntry;
  size: "thumb" | "large";
  max: number;
  /** Only photographs of this kind (the history panel shows the historical ones). */
  kind?: ImageRef["kind"];
}

type Image = ImageRef | ImagePlaceholder;

export function isPhoto(img: Image): img is ImageRef {
  return img.kind !== "placeholder";
}

export function credit(img: ImageRef): string {
  return `${img.title} — ${img.author}, ${img.licence}`;
}

function sourceLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "source";
  }
}

function Placeholder({ img, element: e, size }: { img: ImagePlaceholder; element: ElementIndexEntry; size: Props["size"] }) {
  return (
    <div className={styles.placeholder} role="img" aria-label={img.text} data-image-kind="placeholder" data-reason={img.reason}>
      <span className={styles.placeholderSymbol} aria-hidden="true">
        {e.symbol}
      </span>
      <span className={styles.placeholderText} aria-hidden="true">
        {size === "thumb" ? img.text.split(":")[0] + "." : img.text}
      </span>
    </div>
  );
}

export function ElementImages({ element: e, size, max, kind }: Props) {
  const images = (e.images as Image[]).filter((img) => !kind || (isPhoto(img) && img.kind === kind)).slice(0, max);
  const base = import.meta.env.BASE_URL;
  return (
    <div className={styles.strip} data-size={size}>
      {images.map((img, i) =>
        isPhoto(img) ? (
          size === "large" ? (
            <figure key={img.file} className={styles.figure}>
              <img
                className={styles.image}
                src={`${base}${img.file}`}
                width={img.width}
                height={img.height}
                alt={img.title}
                loading="lazy"
                decoding="async"
                data-image-kind={img.kind}
              />
              <figcaption className={styles.credit}>
                {img.title} — {img.author},{" "}
                <a href={img.licenceUrl} rel="license noreferrer" target="_blank">
                  {img.licence}
                </a>
                ,{" "}
                <a href={img.sourceUrl} rel="noreferrer" target="_blank">
                  {sourceLabel(img.sourceUrl)}
                </a>
              </figcaption>
            </figure>
          ) : (
            <img
              key={img.file}
              className={styles.image}
              src={`${base}${img.thumb}`}
              width={img.width}
              height={img.height}
              alt={img.title}
              title={credit(img)}
              loading="lazy"
              decoding="async"
              data-image-kind={img.kind}
            />
          )
        ) : (
          <Placeholder key={`placeholder-${i}`} img={img} element={e} size={size} />
        ),
      )}
    </div>
  );
}
