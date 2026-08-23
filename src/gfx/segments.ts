/**
 * Seven-segment numerals for the primary readouts.
 *
 * Scaling the 5x7 bitmap font up to 40px tall looks like a spreadsheet; real
 * marine instruments use segmented digits, and they stay legible at a glance on
 * a monocular HUD. Segments are drawn as tapered hexagons so the corners read as
 * mitred rather than blocky.
 */

import type { Canvas, Point } from "./canvas";
import type { TextAlign } from "./font";

/** a=top, b=upper-right, c=lower-right, d=bottom, e=lower-left, f=upper-left, g=middle */
type Segment = "a" | "b" | "c" | "d" | "e" | "f" | "g";

const DIGITS: Record<string, readonly Segment[]> = {
  "0": ["a", "b", "c", "d", "e", "f"],
  "1": ["b", "c"],
  "2": ["a", "b", "g", "e", "d"],
  "3": ["a", "b", "g", "c", "d"],
  "4": ["f", "g", "b", "c"],
  "5": ["a", "f", "g", "c", "d"],
  "6": ["a", "f", "g", "e", "c", "d"],
  "7": ["a", "b", "c"],
  "8": ["a", "b", "c", "d", "e", "f", "g"],
  "9": ["a", "b", "c", "d", "f", "g"]
};

const ALL_SEGMENTS: readonly Segment[] = ["a", "b", "c", "d", "e", "f", "g"];

/** Digit cell width as a fraction of height. */
const WIDTH_RATIO = 0.58;
/** Segment thickness as a fraction of height. */
const STROKE_RATIO = 0.15;
/** Gap between adjacent segments, as a fraction of thickness. */
const GAP_RATIO = 0.3;
/** Space between cells, as a fraction of height. */
const ADVANCE_RATIO = 0.14;

export interface SegmentOptions {
  /** Cap height of the digits in output pixels. */
  height: number;
  tone?: number;
  /** Brightness of unlit segments. 0 hides them; ~0.1 gives the LCD look. */
  ghostTone?: number;
  align?: TextAlign;
}

function cellWidth(ch: string, h: number): number {
  if (ch === ".") return h * STROKE_RATIO * 1.7;
  if (ch === ":") return h * STROKE_RATIO * 1.7;
  if (ch === "-") return h * WIDTH_RATIO * 0.62;
  if (ch === " ") return h * WIDTH_RATIO * 0.5;
  return h * WIDTH_RATIO;
}

/** Total width in pixels that `text` occupies at the given height. */
export function measureSegments(text: string, height: number): number {
  const chars = [...text];
  let w = 0;
  chars.forEach((ch, i) => {
    w += cellWidth(ch, height);
    if (i < chars.length - 1) w += height * ADVANCE_RATIO;
  });
  return w;
}

function horizontal(left: number, y: number, len: number, t: number): Point[] {
  const h = t / 2;
  return [
    [left, y],
    [left + h, y - h],
    [left + len - h, y - h],
    [left + len, y],
    [left + len - h, y + h],
    [left + h, y + h]
  ];
}

function vertical(x: number, top: number, len: number, t: number): Point[] {
  const h = t / 2;
  return [
    [x, top],
    [x + h, top + h],
    [x + h, top + len - h],
    [x, top + len],
    [x - h, top + len - h],
    [x - h, top + h]
  ];
}

function segmentShape(seg: Segment, x: number, y: number, w: number, h: number, t: number): Point[] {
  const g = t * GAP_RATIO;
  const hLeft = x + t / 2 + g;
  const hLen = w - t - 2 * g;
  const vLen = h / 2 - t / 2 - 2 * g;

  switch (seg) {
    case "a":
      return horizontal(hLeft, y + t / 2, hLen, t);
    case "g":
      return horizontal(hLeft, y + h / 2, hLen, t);
    case "d":
      return horizontal(hLeft, y + h - t / 2, hLen, t);
    case "f":
      return vertical(x + t / 2, y + t / 2 + g, vLen, t);
    case "b":
      return vertical(x + w - t / 2, y + t / 2 + g, vLen, t);
    case "e":
      return vertical(x + t / 2, y + h / 2 + g, vLen, t);
    case "c":
      return vertical(x + w - t / 2, y + h / 2 + g, vLen, t);
  }
}

/**
 * Draw `text` (digits, `.`, `:`, `-`, spaces) with its top edge at `y`.
 * Returns the width drawn.
 */
export function drawSegments(
  canvas: Canvas,
  text: string,
  x: number,
  y: number,
  opts: SegmentOptions
): number {
  const h = opts.height;
  const tone = opts.tone ?? 1;
  const ghost = opts.ghostTone ?? 0;
  const t = h * STROKE_RATIO;
  const total = measureSegments(text, h);

  const align = opts.align ?? "left";
  let cx = align === "center" ? x - total / 2 : align === "right" ? x - total : x;
  const top = y;

  for (const ch of [...text]) {
    const w = cellWidth(ch, h);

    if (ch === ".") {
      canvas.fillRect(cx, top + h - t, t, t, tone);
    } else if (ch === ":") {
      canvas.fillRect(cx, top + h * 0.3 - t / 2, t, t, tone);
      canvas.fillRect(cx, top + h * 0.72 - t / 2, t, t, tone);
    } else if (ch === "-") {
      canvas.polygon(horizontal(cx, top + h / 2, w, t), tone);
    } else if (ch !== " ") {
      const lit = DIGITS[ch];
      if (lit) {
        if (ghost > 0) {
          for (const seg of ALL_SEGMENTS) {
            if (!lit.includes(seg)) canvas.polygon(segmentShape(seg, cx, top, w, h, t), ghost);
          }
        }
        for (const seg of lit) canvas.polygon(segmentShape(seg, cx, top, w, h, t), tone);
      }
    }

    cx += w + h * ADVANCE_RATIO;
  }

  return total;
}
