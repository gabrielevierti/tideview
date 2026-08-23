/**
 * Tone palette. The G2 panel has 16 levels, so the useful range of "greys" is
 * narrow — these five steps are spaced to stay distinguishable on glass.
 */
export interface Palette {
  /** Primary readouts. */
  bright: number;
  /** Secondary values and active graphics. */
  normal: number;
  /** Labels and units. */
  label: number;
  /** Rules, tick marks, chrome. */
  muted: number;
  /** Unlit segments, inactive scale backgrounds. */
  faint: number;
}

const DAY: Palette = { bright: 1, normal: 0.75, label: 0.5, muted: 0.32, faint: 0.13 };

/**
 * Night mode is not a uniform dim: the dark end is pulled up slightly so faint
 * chrome does not disappear entirely once the bright end comes down.
 */
const NIGHT: Palette = { bright: 0.55, normal: 0.42, label: 0.3, muted: 0.2, faint: 0.1 };

export const palette = (night: boolean): Palette => (night ? NIGHT : DAY);
