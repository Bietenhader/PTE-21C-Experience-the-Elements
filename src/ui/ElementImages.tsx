// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Element photographs (SPEC §9.1, §9.2, §12): vendored, lazy, with explicit dimensions and the
// credit on hover. Until the curated images land (milestone M2) an honest placeholder says so.

import type { ElementIndexEntry, ImageRef } from "../data/types";
import styles from "./ElementImages.module.css";

interface Props {
  element: ElementIndexEntry;
  size: "thumb" | "large";
  max: number;
}

export function credit(img: ImageRef): string {
  return `${img.title} — ${img.author}, ${img.licence}`;
}

export function ElementImages({ element: e, size, max }: Props) {
  const images = e.images.slice(0, max);
  if (!images.length) {
    return (
      <div className={styles.strip} data-size={size}>
        <div
          className={styles.placeholder}
          role="img"
          aria-label={`No photograph of ${e.name} yet`}
          data-image-kind="placeholder"
        >
          <span className={styles.placeholderSymbol} aria-hidden="true">
            {e.symbol}
          </span>
          <span className={styles.placeholderText}>No photograph yet — curated, credited images arrive in M2.</span>
        </div>
      </div>
    );
  }
  return (
    <div className={styles.strip} data-size={size}>
      {images.map((img) => (
        <img
          key={img.file}
          className={styles.image}
          src={`${import.meta.env.BASE_URL}img/${size === "thumb" ? img.thumb : img.file}`}
          width={img.width}
          height={img.height}
          alt={img.title}
          title={credit(img)}
          loading="lazy"
          decoding="async"
          data-image-kind={img.kind}
        />
      ))}
    </div>
  );
}
