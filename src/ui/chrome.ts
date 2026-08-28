import {
  bottom, centerX, centerY, column, emptyState, gray as G, grow, icon, pageDots,
  right, signalBars, space as S, tag, type as T
} from "@gabrielevierti/glyph";
import type { GlyphIconName, GlyphRaster, Rect, RenderContext } from "@gabrielevierti/glyph";

import { FORECAST_STALE_MS } from "../config";
import { age, clock } from "../format";
import { isNight, session } from "../session";
import type { Conditions } from "../models";

/**
 * The frame every screen shares.
 *
 * It is drawn by the screen rather than by the shell on purpose: with a
 * `TILE_CHROME` tiling the status strip is its own image container, so a screen
 * that repaints its body does not resend the bar — but only if the bar is drawn
 * inside the same paint. Splitting it out would buy nothing and cost a layer.
 */

/** GPS quality as four bars. Accuracy in metres is the only signal we get. */
function fixBars(data: Conditions): number {
  if (!data.fix.valid) return 0;
  const a = data.fix.accuracyM;
  if (!Number.isFinite(a) || a <= 0) return 3;
  if (a <= 8) return 4;
  if (a <= 15) return 3;
  if (a <= 30) return 2;
  return 1;
}

export interface ChromeParts {
  /** Everything between the status bar and the footer. */
  body: Rect;
  footer: Rect;
}

/** Status bar and footer rules. Returns the space left for the screen itself. */
export function chrome(ctx: RenderContext, title: string, data: Conditions): ChromeParts {
  const { g, safe } = ctx;
  const [bar, body, footer] = column(
    safe, [{ size: 15 }, { size: grow(1) }, { size: 20 }], { gap: S.sm }
  );

  // ── Status bar ──────────────────────────────────────────────────────────
  const cy = centerY(bar);
  let x = bar.x;
  g.text(title, x, cy, T.label, G.secondary, "left", "middle");
  x += g.measure(title, T.label) + S.md;

  if (session.demo) x += tag(g, x, cy, "DEMO", { gray: G.disabled }) + S.xs;
  if (isNight()) x += tag(g, x, cy, "NIGHT", { gray: G.disabled }) + S.xs;
  if (data.forecastLoaded && Date.now() - data.timestamp > FORECAST_STALE_MS) {
    tag(g, x, cy, "STALE", { gray: G.strong });
  }

  let rightEdge = right(bar);
  const time = clock();
  g.text(time, rightEdge, cy, T.numeral, G.primary, "right", "middle");
  rightEdge -= g.measure(time, T.numeral) + S.md;

  if (data.weather.valid) {
    const temp = `${Math.round(data.weather.temperatureC)}°`;
    g.text(temp, rightEdge, cy, T.caption, G.tertiary, "right", "middle");
    rightEdge -= g.measure(temp, T.caption) + S.md;
  }

  signalBars(g, rightEdge - 14, cy, fixBars(data));

  g.hline(bar.x, right(bar), bottom(bar) + 3, G.hairline);

  return { body, footer };
}

/** The footer: where we are, which screen this is, and how fresh it all is. */
export function footer(ctx: RenderContext, rect: Rect, data: Conditions, note?: string): void {
  const { g, app } = ctx;
  const cy = centerY(rect) + 1;
  g.hline(rect.x, right(rect), rect.y, G.hairline);

  if (note) {
    g.text(note, rect.x, cy, T.micro, G.tertiary, "left", "middle");
  } else if (data.fix.valid) {
    const position = `${data.fix.lat.toFixed(2)}° ${data.fix.lon.toFixed(2)}°`;
    icon(g, "map-pin", rect.x + 5, cy, 11, G.disabled);
    g.text(position, rect.x + 14, cy, T.micro, G.tertiary, "left", "middle");
  }

  pageDots(g, centerX(rect), cy, app.screens.length, app.screenIndex);

  const stamp = data.forecastLoaded ? `FORECAST ${age(data.timestamp)}` : "NO FORECAST";
  g.text(stamp, right(rect), cy, T.micro, G.tertiary, "right", "middle");
}

/**
 * Full-screen message. Every state the app can be in is a designed screen, not
 * a row of dashes: location denied, no fix yet, no wave model here.
 */
export function notice(
  g: GlyphRaster, body: Rect, name: GlyphIconName, title: string, subtitle?: string
): void {
  emptyState(g, body, name, title, subtitle);
}

/**
 * Nothing on any screen can be computed without a position, so the gate is
 * shared. Returns false when the screen should stop drawing.
 */
export function requireFix(g: GlyphRaster, body: Rect, data: Conditions): boolean {
  if (data.locationPermission === "denied") {
    notice(g, body, "lock", "Location is off",
      "SeaState needs your position to fetch the local forecast. Enable it for the Even app.");
    return false;
  }
  if (data.locationPermission === "unavailable") {
    notice(g, body, "alert-triangle", "No location service",
      "This device cannot provide a position fix.");
    return false;
  }
  if (!data.fix.valid) {
    notice(g, body, "navigation", "Acquiring GPS", "Waiting for a position fix.");
    return false;
  }
  return true;
}
