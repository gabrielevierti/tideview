import {
  bearingToAngle, bottom, centerX, centerY, clamp, fitStyle, gray as G, polar,
  right, sparkline, type as T
} from "@gabrielevierti/glyph";
import type { GlyphRaster, Gray, Point, Rect } from "@gabrielevierti/glyph";

/**
 * The instruments SeaState needs and Glyph does not ship.
 *
 * Glyph's `compassRose` is a heading instrument: the card turns, the boat stays
 * still. Everything else on this app is read the other way round — an angle off
 * the bow, where the bow is up and the side it is on matters more than the
 * number. That is one component, used four times, so it lives here rather than
 * being open-coded on each screen.
 */

export interface DialArrow {
  /** Angle relative to the bow, -180..180. Negative is to port. */
  angle: number;
  gray?: Gray;
  /** Hollow arrows read as secondary against a filled primary. */
  hollow?: boolean;
  label?: string;
}

export interface BoatDialOptions {
  arrows?: DialArrow[];
  /** Shade the arc from the bow round to this angle, so the side reads first. */
  sweepTo?: number;
  /** Dashed no-go zone, half-angle either side of the bow. */
  noGo?: number;
  /** Port/starboard marks on the rim. Off for small dials. */
  labels?: boolean;
  /** Hull silhouette in the middle. Defaults to on only when nothing else is there. */
  hull?: boolean;
  caption?: string;
  value?: string;
  unit?: string;
}

/** Compass-relative angles, but relative to the bow rather than to north. */
const toAngle = (relativeDeg: number): number => bearingToAngle(relativeDeg);

/**
 * A boat-relative dial: rim, ticks, bow mark, and one or more arrows sitting on
 * the rim pointing inwards — the direction a thing is coming *from*, which is
 * how wind and sea are read.
 */
export function boatDial(
  g: GlyphRaster, cx: number, cy: number, r: number, opts: BoatDialOptions = {}
): void {
  // ── Sector from the bow to the primary angle. Level 1 is almost no ink, and
  // it answers "which side" before the eye has found the arrow.
  if (opts.sweepTo !== undefined && Math.abs(opts.sweepTo) > 1) {
    const a = toAngle(0);
    const b = toAngle(opts.sweepTo);
    const [from, to] = opts.sweepTo >= 0 ? [a, b] : [b, a];
    g.ring(cx, cy, r - 3, r - 12, from, to, { fill: G.sunken });
  }

  g.circle(cx, cy, r, { stroke: G.border, width: 1 });

  // Minor ticks are noise below about 50px of radius: at that size ten degrees
  // is a pixel and a half and the ring just looks dirty.
  const step = r >= 50 ? 10 : 30;
  for (let deg = 0; deg < 360; deg += step) {
    const major = deg % 30 === 0;
    const a = toAngle(deg);
    const from = polar(cx, cy, r - (major ? 8 : 4), a);
    const to = polar(cx, cy, r - 1, a);
    g.line(from.x, from.y, to.x, to.y, {
      stroke: major ? G.border : G.hairline, width: major ? 1.4 : 1, cap: "butt"
    });
  }

  if (opts.labels !== false && r >= 52) {
    const marks: Array<[string, number]> = [["P", -90], ["S", 90], ["180", 180]];
    for (const [text, deg] of marks) {
      const p = polar(cx, cy, r - 17, toAngle(deg));
      g.text(text, p.x, p.y, T.micro, G.tertiary, "center", "middle");
    }
  }

  // ── No-go zone: the angles you cannot sail, drawn once so the wind arrow
  // landing inside it needs no explanation.
  if (opts.noGo !== undefined) {
    g.arc(cx, cy, r - 6, toAngle(-opts.noGo), toAngle(opts.noGo), {
      stroke: G.disabled, width: 1, dash: [2, 4], cap: "butt"
    });
  }

  // The hull is what says "up is the bow, not north" — but only when the middle
  // is otherwise empty. Behind a readout it is texture, and texture behind a
  // number on a see-through display is how a number stops being readable.
  if (opts.hull ?? !opts.value) hull(g, cx, cy, r * 0.34, r * 0.62, G.hairline);

  for (const arrow of opts.arrows ?? []) {
    rimArrow(g, cx, cy, r, arrow);
  }

  // ── Bow mark. The boat is what stays still; everything else turns.
  const nose = polar(cx, cy, r + 3, toAngle(0));
  g.polygon(
    [nose, { x: nose.x - 5, y: nose.y - 8 }, { x: nose.x + 5, y: nose.y - 8 }],
    { fill: G.max }
  );

  if (opts.caption) {
    g.text(opts.caption, cx, cy - r * 0.46, T.micro, G.tertiary, "center", "middle");
  }
  if (opts.value) {
    // The readout is the one thing that must never touch the rim, and its
    // length is not something the design gets to choose: "6" and "147\u00B0P" want
    // the same slot. The type scale yields to the box.
    const style = fitStyle(
      g.measure, opts.value, r >= 60 ? T.numeralXl : T.numeralLg, r * 1.15, r * 0.7
    );
    g.text(opts.value, cx, cy, style, G.max, "center", "middle");
  }
  if (opts.unit) {
    g.text(opts.unit, cx, cy + r * 0.46, T.micro, G.secondary, "center", "middle");
  }
}

/** One arrow on the rim, pointing inwards from the direction it names. */
function rimArrow(g: GlyphRaster, cx: number, cy: number, r: number, arrow: DialArrow): void {
  const a = toAngle(arrow.angle);
  const size = clamp(r * 0.14, 5, 11);
  const tip = polar(cx, cy, r - size * 1.6, a);
  const left = polar(cx, cy, r + 1, a - size / r);
  const rightSide = polar(cx, cy, r + 1, a + size / r);
  const gray = arrow.gray ?? G.max;

  if (arrow.hollow) {
    g.polygon([tip, left, rightSide], { stroke: gray, width: 1.2, join: "round" });
  } else {
    g.polygon([tip, left, rightSide], { fill: gray });
  }

  if (arrow.label) {
    const at = polar(cx, cy, r + 11, a);
    g.text(arrow.label, at.x, at.y, T.micro, G.tertiary, "center", "middle");
  }
}

/**
 * A hull seen from above. Purely decorative, and worth the twenty pixels: it is
 * what tells you at a glance that up is the bow and not north.
 */
export function hull(
  g: GlyphRaster, cx: number, cy: number, halfWidth: number, halfLength: number, gray: Gray = G.border
): void {
  const w = halfWidth;
  const l = halfLength;
  const points: Point[] = [
    { x: cx, y: cy - l },
    { x: cx + w * 0.78, y: cy - l * 0.35 },
    { x: cx + w, y: cy + l * 0.25 },
    { x: cx + w * 0.82, y: cy + l },
    { x: cx - w * 0.82, y: cy + l },
    { x: cx - w, y: cy + l * 0.25 },
    { x: cx - w * 0.78, y: cy - l * 0.35 }
  ];
  g.polygon(points, { stroke: gray, width: 1, join: "round" });
}

/**
 * The sea in profile, drawn from the numbers rather than as an illustration.
 *
 * Wavelength comes from the period (deep water: 1.56 T²), so the steepness on
 * screen is the steepness on the water, scaled. A short, steep 1.5 m sea and a
 * long 1.5 m swell are the same number and a completely different day, and this
 * is the only element on any screen that shows the difference.
 */
export function waveProfile(
  g: GlyphRaster, box: Rect,
  wave: { height: number; period: number },
  swell?: { height: number; period: number }
): void {
  const mean = centerY(box);
  const reference = Math.max(1.2, wave.height, swell?.height ?? 0);
  const amplitude = (height: number) => (height / reference) * (box.height / 2 - 4);

  g.line(box.x, mean, right(box), mean, {
    stroke: G.hairline, width: 1, dash: [3, 4], cap: "butt"
  });

  const draw = (height: number, period: number, gray: Gray, width: number) => {
    if (!(height > 0) || !(period > 0)) return;
    const wavelength = 1.56 * period * period;                 // metres, deep water
    const cycles = clamp(box.width / (wavelength * 2.6), 0.8, 5);
    const amp = amplitude(height);
    const points: Point[] = [];
    for (let i = 0; i <= 48; i++) {
      const t = i / 48;
      points.push({
        x: box.x + t * box.width,
        y: mean - Math.sin(t * cycles * Math.PI * 2) * amp
      });
    }
    g.spline(points, { stroke: gray, width });
  };

  if (swell) draw(swell.height, swell.period, G.disabled, 1);
  draw(wave.height, wave.period, G.max, 1.5);
}

/**
 * A trend line with an honest empty state. A sparkline drawn from two samples
 * is a decoration pretending to be data.
 */
export function trendLine(
  g: GlyphRaster, box: Rect, values: number[], opts: { gray?: Gray; label?: string } = {}
): void {
  if (values.length < 4) {
    g.line(box.x, centerY(box), right(box), centerY(box), {
      stroke: G.hairline, width: 1, dash: [2, 4], cap: "butt"
    });
    g.text("COLLECTING", centerX(box), centerY(box) - 7, T.micro, G.disabled, "center", "middle");
    return;
  }
  sparkline(g, box, values, { gray: opts.gray ?? G.strong, smooth: true });
  if (opts.label) {
    g.text(opts.label, box.x, bottom(box), T.micro, G.tertiary, "left", "bottom");
  }
}

/**
 * The key for a two-arrow dial. Filled is primary, hollow is secondary — which
 * is obvious once you have been told once and invisible until then.
 */
export function dialLegend(
  g: GlyphRaster, box: Rect, entries: Array<{ label: string; hollow?: boolean }>
): void {
  const cy = centerY(box);
  const width = box.width / entries.length;
  entries.forEach((entry, i) => {
    const x = box.x + i * width;
    const points: Point[] = [
      { x: x + 4, y: cy - 4 }, { x: x + 9, y: cy + 4 }, { x: x, y: cy + 4 }
    ];
    if (entry.hollow) g.polygon(points, { stroke: G.secondary, width: 1, join: "round" });
    else g.polygon(points, { fill: G.max });
    g.text(entry.label, x + 13, cy, T.micro, G.tertiary, "left", "middle");
  });
}
