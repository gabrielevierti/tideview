/**
 * A 5x7 bitmap font, rendered proportionally.
 *
 * Glyphs are authored on a fixed 5-wide grid, then blank columns are trimmed at
 * module load so that `1`, `I` and `.` take the space they actually need instead
 * of a fixed cell. On a 288x144 panel that reclaims a surprising amount of room.
 */

import type { Canvas } from "./canvas";

export const GLYPH_HEIGHT = 7;

const RAW: Record<string, readonly string[]> = {
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
  "3": ["11111", "00010", "00100", "00010", "00001", "10001", "01110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],

  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  D: ["11100", "10010", "10001", "10001", "10001", "10010", "11100"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01110", "10001", "10000", "10111", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
  J: ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "11001", "10101", "10011", "10011", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "11011", "10001"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],

  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
  ",": ["00000", "00000", "00000", "00000", "01100", "01100", "01000"],
  ":": ["00000", "01100", "01100", "00000", "01100", "01100", "00000"],
  "-": ["00000", "00000", "00000", "11111", "00000", "00000", "00000"],
  "+": ["00000", "00100", "00100", "11111", "00100", "00100", "00000"],
  "/": ["00001", "00010", "00010", "00100", "01000", "01000", "10000"],
  "'": ["01100", "01100", "01000", "00000", "00000", "00000", "00000"],
  "!": ["00100", "00100", "00100", "00100", "00100", "00000", "00100"],
  "?": ["01110", "10001", "00001", "00110", "00100", "00000", "00100"],
  "(": ["00010", "00100", "01000", "01000", "01000", "00100", "00010"],
  ")": ["01000", "00100", "00010", "00010", "00010", "00100", "01000"],
  "<": ["00010", "00100", "01000", "10000", "01000", "00100", "00010"],
  ">": ["01000", "00100", "00010", "00001", "00010", "00100", "01000"],
  "=": ["00000", "00000", "11111", "00000", "11111", "00000", "00000"],
  "%": ["11001", "11010", "00010", "00100", "01000", "01011", "10011"],
  "#": ["01010", "01010", "11111", "01010", "11111", "01010", "01010"],
  "*": ["00000", "10101", "01110", "11111", "01110", "10101", "00000"],
  // Degree sign. Both the real character and a plain "^" map here.
  "\u00B0": ["01100", "10010", "10010", "01100", "00000", "00000", "00000"],
  "^": ["01100", "10010", "10010", "01100", "00000", "00000", "00000"],
  // Filled and hollow markers, handy for list bullets and status dots.
  "\u25A0": ["00000", "01110", "11111", "11111", "11111", "01110", "00000"],
  "\u25A1": ["00000", "01110", "11011", "10001", "11011", "01110", "00000"],
  "\u2191": ["00100", "01110", "10101", "00100", "00100", "00100", "00100"],
  "\u2193": ["00100", "00100", "00100", "00100", "10101", "01110", "00100"]
};

interface Glyph {
  /** Row strings trimmed to the glyph's true ink width. */
  rows: readonly string[];
  width: number;
}

function buildGlyph(rows: readonly string[]): Glyph {
  let left = Infinity;
  let right = -Infinity;
  for (const row of rows) {
    for (let x = 0; x < row.length; x++) {
      if (row[x] === "1") {
        if (x < left) left = x;
        if (x > right) right = x;
      }
    }
  }
  if (left === Infinity) return { rows: rows.map(() => ""), width: 0 };
  return { rows: rows.map((r) => r.slice(left, right + 1)), width: right - left + 1 };
}

const GLYPHS: Record<string, Glyph> = {};
for (const [ch, rows] of Object.entries(RAW)) GLYPHS[ch] = buildGlyph(rows);

/** Width of a blank, in font units. */
const SPACE_WIDTH = 3;
/** Gap between glyphs, in font units. */
const DEFAULT_TRACKING = 1;

export type TextAlign = "left" | "center" | "right";

export interface TextOptions {
  /** Integer pixel size of one font unit. `1` gives a 7px-tall glyph. */
  size?: number;
  tone?: number;
  align?: TextAlign;
  /** Extra gap between glyphs, in font units. */
  tracking?: number;
}

function glyphFor(ch: string): Glyph | null {
  return GLYPHS[ch] ?? null;
}

/** Width in output pixels that `text` would occupy. */
export function measureText(text: string, opts: TextOptions = {}): number {
  const size = opts.size ?? 1;
  const tracking = opts.tracking ?? DEFAULT_TRACKING;
  const chars = [...text.toUpperCase()];
  let units = 0;
  chars.forEach((ch, i) => {
    units += ch === " " ? SPACE_WIDTH : (glyphFor(ch)?.width ?? SPACE_WIDTH);
    if (i < chars.length - 1) units += tracking;
  });
  return units * size;
}

/**
 * Draw `text` with its top-left (or top-centre / top-right) at `x, y`.
 * Returns the advance width so callers can chain runs.
 */
export function drawText(
  canvas: Canvas,
  text: string,
  x: number,
  y: number,
  opts: TextOptions = {}
): number {
  const size = opts.size ?? 1;
  const tone = opts.tone ?? 1;
  const tracking = opts.tracking ?? DEFAULT_TRACKING;
  const total = measureText(text, opts);

  const align = opts.align ?? "left";
  let cx = align === "center" ? x - total / 2 : align === "right" ? x - total : x;
  cx = Math.round(cx);
  const top = Math.round(y);

  for (const ch of text.toUpperCase()) {
    if (ch === " ") {
      cx += (SPACE_WIDTH + tracking) * size;
      continue;
    }
    const glyph = glyphFor(ch);
    if (!glyph) {
      cx += (SPACE_WIDTH + tracking) * size;
      continue;
    }
    glyph.rows.forEach((row, ry) => {
      let runStart = -1;
      for (let rx = 0; rx <= row.length; rx++) {
        const on = row[rx] === "1";
        if (on && runStart < 0) runStart = rx;
        if (!on && runStart >= 0) {
          // Emit each horizontal run as one rect: fewer, larger fills.
          canvas.fillRect(
            cx + runStart * size,
            top + ry * size,
            (rx - runStart) * size,
            size,
            tone
          );
          runStart = -1;
        }
      }
    });
    cx += (glyph.width + tracking) * size;
  }

  return total;
}
