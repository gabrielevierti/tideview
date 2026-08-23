import type { Canvas } from "../gfx/canvas";
import { drawText } from "../gfx/font";
import { drawSegments } from "../gfx/segments";
import type { Palette } from "../gfx/theme";
import { polar, toCanvasAngle } from "./chrome";

export interface DialArrow {
  /** Angle relative to the bow, -180..180. Negative is to port. */
  angle: number;
  tone: number;
  /** Hollow arrows read as secondary against a filled primary. */
  hollow?: boolean;
}

/**
 * A boat-relative dial: ring, tick marks, a bow reference and one or more
 * arrows sitting on the rim, with a value in the middle. Used for wind, waves
 * and swell, all of which are read the same way - as an angle off the bow.
 */
export function drawDial(
  canvas: Canvas,
  p: Palette,
  opts: {
    cx: number;
    cy: number;
    r: number;
    arrows: DialArrow[];
    /** Shade the sector between the bow and this angle. */
    sweepTo?: number;
    caption?: string;
    value?: string;
    unit?: string;
  }
): void {
  const { cx, cy, r } = opts;

  canvas.circle(cx, cy, r, { tone: p.muted, thickness: 1 });

  for (let b = 0; b < 360; b += 30) {
    const long = b % 90 === 0;
    const [x0, y0] = polar(cx, cy, r - (long ? 7 : 4), b);
    const [x1, y1] = polar(cx, cy, r - 1, b);
    canvas.line(x0, y0, x1, y1, { tone: long ? p.label : p.muted, thickness: long ? 1.6 : 1 });
  }

  // Sector from the bow to the primary angle, so the side it is on reads
  // instantly without parsing the sign of a number.
  if (opts.sweepTo !== undefined) {
    const angle = opts.sweepTo;
    const start = angle >= 0 ? toCanvasAngle(0) : toCanvasAngle(angle);
    canvas.arc(cx, cy, r - 3, start, Math.abs(angle), { tone: p.faint, thickness: 5 });
  }

  for (const arrow of opts.arrows) {
    const tip = polar(cx, cy, r - 9, arrow.angle);
    const left = polar(cx, cy, r + 1, arrow.angle - 6);
    const right = polar(cx, cy, r + 1, arrow.angle + 6);
    if (arrow.hollow) {
      canvas.polyline([tip, left, right], { tone: arrow.tone, thickness: 1.2, close: true });
    } else {
      canvas.polygon([tip, left, right], arrow.tone);
    }
  }

  // Bow reference mark.
  const [bx, by] = polar(cx, cy, r + 4, 0);
  canvas.polygon(
    [
      [bx, by + 5],
      [bx - 3, by],
      [bx + 3, by]
    ],
    p.normal
  );

  if (opts.caption) {
    drawText(canvas, opts.caption, cx, cy - 25, {
      size: 1,
      tone: p.label,
      align: "center",
      tracking: 1
    });
  }
  if (opts.value) {
    drawSegments(canvas, opts.value, cx, cy - 11, {
      height: 22,
      tone: p.bright,
      ghostTone: p.faint * 0.55,
      align: "center"
    });
  }
  if (opts.unit) {
    drawText(canvas, opts.unit, cx, cy + 15, {
      size: 1,
      tone: p.label,
      align: "center",
      tracking: 1
    });
  }
}
