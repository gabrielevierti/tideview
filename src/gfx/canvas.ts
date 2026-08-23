/**
 * A tiny immediate-mode raster canvas built for the G2's 4-bit greyscale display.
 *
 * Everything is drawn into a buffer that is `SS` times larger than the output in
 * each axis, then box-filtered down on `toGray4()`. That single trick gives us
 * anti-aliasing on every primitive for free: diagonals, circles and arcs come out
 * smooth, while axis-aligned rectangles and bitmap glyphs land on exact multiples
 * of `SS` and therefore stay perfectly crisp.
 */

/** Supersampling factor. 3 => 9 coverage samples per output pixel. */
export const SS = 3;

/** Number of distinct greys the panel can show (0..15). */
export const GRAY_LEVELS = 16;

export type Point = readonly [number, number];

export interface StrokeOptions {
  /** Ink level, 0 (transparent/black) to 1 (full brightness). */
  tone?: number;
  /** Stroke width in output pixels. */
  thickness?: number;
}

export interface ShapeOptions extends StrokeOptions {
  /** Fill the shape instead of stroking its outline. */
  fill?: boolean;
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const toInk = (tone: number) => Math.round(clamp01(tone) * 255);

export class Canvas {
  readonly width: number;
  readonly height: number;

  private readonly sw: number;
  private readonly sh: number;
  private readonly buf: Uint8Array;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.sw = width * SS;
    this.sh = height * SS;
    this.buf = new Uint8Array(this.sw * this.sh);
  }

  clear(tone = 0): void {
    this.buf.fill(toInk(tone));
  }

  /**
   * Core rasteriser. Walks the supersampled pixels inside the device-space
   * bounding box and asks `inside` whether each sample centre is covered.
   */
  private paint(
    minX: number,
    minY: number,
    maxX: number,
    maxY: number,
    inside: (x: number, y: number) => boolean,
    tone: number
  ): void {
    const ink = toInk(tone);
    const sx0 = Math.max(0, Math.floor(minX * SS));
    const sy0 = Math.max(0, Math.floor(minY * SS));
    const sx1 = Math.min(this.sw - 1, Math.ceil(maxX * SS));
    const sy1 = Math.min(this.sh - 1, Math.ceil(maxY * SS));
    if (sx1 < sx0 || sy1 < sy0) return;

    for (let sy = sy0; sy <= sy1; sy++) {
      const py = (sy + 0.5) / SS;
      const row = sy * this.sw;
      for (let sx = sx0; sx <= sx1; sx++) {
        const px = (sx + 0.5) / SS;
        if (inside(px, py)) this.buf[row + sx] = ink;
      }
    }
  }

  // ---------------------------------------------------------------- shapes

  fillRect(x: number, y: number, w: number, h: number, tone = 1): void {
    if (w <= 0 || h <= 0) return;
    const x1 = x + w;
    const y1 = y + h;
    this.paint(x, y, x1, y1, (px, py) => px >= x && px < x1 && py >= y && py < y1, tone);
  }

  strokeRect(x: number, y: number, w: number, h: number, opts: StrokeOptions = {}): void {
    const t = opts.thickness ?? 1;
    const tone = opts.tone ?? 1;
    this.fillRect(x, y, w, t, tone);
    this.fillRect(x, y + h - t, w, t, tone);
    this.fillRect(x, y + t, t, h - 2 * t, tone);
    this.fillRect(x + w - t, y + t, t, h - 2 * t, tone);
  }

  roundRect(x: number, y: number, w: number, h: number, r: number, opts: ShapeOptions = {}): void {
    const tone = opts.tone ?? 1;
    const t = opts.thickness ?? 1;
    const rad = Math.max(0, Math.min(r, w / 2, h / 2));

    // Signed distance to the rounded rectangle, negative inside.
    const sdf = (px: number, py: number) => {
      const dx = Math.abs(px - (x + w / 2)) - (w / 2 - rad);
      const dy = Math.abs(py - (y + h / 2)) - (h / 2 - rad);
      const ax = Math.max(dx, 0);
      const ay = Math.max(dy, 0);
      return Math.hypot(ax, ay) + Math.min(Math.max(dx, dy), 0) - rad;
    };

    const inside = opts.fill
      ? (px: number, py: number) => sdf(px, py) <= 0
      : (px: number, py: number) => {
          const d = sdf(px, py);
          return d <= 0 && d >= -t;
        };

    this.paint(x, y, x + w, y + h, inside, tone);
  }

  line(x0: number, y0: number, x1: number, y1: number, opts: StrokeOptions = {}): void {
    const t = opts.thickness ?? 1;
    const tone = opts.tone ?? 1;
    const hr = t / 2;
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len2 = dx * dx + dy * dy;

    // Distance from the sample to the segment, i.e. a capsule test.
    const inside = (px: number, py: number) => {
      let u = len2 === 0 ? 0 : ((px - x0) * dx + (py - y0) * dy) / len2;
      u = u < 0 ? 0 : u > 1 ? 1 : u;
      const ex = x0 + u * dx - px;
      const ey = y0 + u * dy - py;
      return ex * ex + ey * ey <= hr * hr;
    };

    this.paint(
      Math.min(x0, x1) - hr,
      Math.min(y0, y1) - hr,
      Math.max(x0, x1) + hr,
      Math.max(y0, y1) + hr,
      inside,
      tone
    );
  }

  circle(cx: number, cy: number, r: number, opts: ShapeOptions = {}): void {
    if (r <= 0) return;
    const tone = opts.tone ?? 1;
    const t = opts.thickness ?? 1;
    const outer = opts.fill ? r : r + t / 2;
    const innerSq = opts.fill ? -1 : (r - t / 2) ** 2;
    const outerSq = outer * outer;

    this.paint(
      cx - outer,
      cy - outer,
      cx + outer,
      cy + outer,
      (px, py) => {
        const d = (px - cx) ** 2 + (py - cy) ** 2;
        return d <= outerSq && d >= innerSq;
      },
      tone
    );
  }

  /** Arc from `startDeg` sweeping `sweepDeg`; 0deg points right, angles increase clockwise. */
  arc(
    cx: number,
    cy: number,
    r: number,
    startDeg: number,
    sweepDeg: number,
    opts: StrokeOptions = {}
  ): void {
    const tone = opts.tone ?? 1;
    const t = opts.thickness ?? 1;
    const outer = r + t / 2;
    const innerSq = (r - t / 2) ** 2;
    const outerSq = outer * outer;
    const start = ((startDeg % 360) + 360) % 360;
    const sweep = Math.max(0, Math.min(360, sweepDeg));

    this.paint(
      cx - outer,
      cy - outer,
      cx + outer,
      cy + outer,
      (px, py) => {
        const ex = px - cx;
        const ey = py - cy;
        const d = ex * ex + ey * ey;
        if (d > outerSq || d < innerSq) return false;
        const a = ((Math.atan2(ey, ex) * 180) / Math.PI + 360) % 360;
        return ((a - start + 360) % 360) <= sweep;
      },
      tone
    );
  }

  /** Filled polygon, even-odd rule. */
  polygon(points: readonly Point[], tone = 1): void {
    if (points.length < 3) return;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const [x, y] of points) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }

    const n = points.length;
    const inside = (px: number, py: number) => {
      let hit = false;
      for (let i = 0, j = n - 1; i < n; j = i++) {
        const [xi, yi] = points[i] as Point;
        const [xj, yj] = points[j] as Point;
        if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) hit = !hit;
      }
      return hit;
    };

    this.paint(minX, minY, maxX, maxY, inside, tone);
  }

  /** Outlined polygon (closed). */
  polyline(points: readonly Point[], opts: StrokeOptions & { close?: boolean } = {}): void {
    const n = points.length;
    if (n < 2) return;
    const last = opts.close ? n : n - 1;
    for (let i = 0; i < last; i++) {
      const a = points[i] as Point;
      const b = points[(i + 1) % n] as Point;
      this.line(a[0], a[1], b[0], b[1], opts);
    }
  }

  // ---------------------------------------------------------------- output

  /** Collapse the supersampled buffer into one 0..15 value per output pixel. */
  toGray4(): Uint8Array {
    const out = new Uint8Array(this.width * this.height);
    const samples = SS * SS;
    const scale = 1 / (255 * samples);
    const gamma = 2.0;

    for (let y = 0; y < this.height; y++) {
      const base = y * SS;
      for (let x = 0; x < this.width; x++) {
        let sum = 0;
        for (let j = 0; j < SS; j++) {
          const row = (base + j) * this.sw + x * SS;
          for (let i = 0; i < SS; i++) {
            sum += this.buf[row + i] as number;
          }
        }

        const normalized = sum * scale;
        const corrected = Math.pow(normalized, gamma);

        out[y * this.width + x] = Math.round(
          corrected * (GRAY_LEVELS - 1)
        );
      }
    }

    return out;
  }
}
