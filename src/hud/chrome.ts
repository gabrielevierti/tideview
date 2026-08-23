import type { Canvas, Point } from "../gfx/canvas";
import { drawText, measureText } from "../gfx/font";
import type { Palette } from "../gfx/theme";
import { HUD_WIDTH } from "../config";

export const MARGIN = 6;
export const HEADER_HEIGHT = 13;
export const CONTENT_TOP = HEADER_HEIGHT + 5;

/**
 * Compass-space to screen-space. `bearing` is degrees clockwise from up, which
 * is how every marine graphic on these screens is specified.
 */
export function polar(cx: number, cy: number, r: number, bearing: number): Point {
  const a = (bearing * Math.PI) / 180;
  return [cx + r * Math.sin(a), cy - r * Math.cos(a)];
}

/** Canvas arc angles measure from 3 o'clock; compass angles measure from 12. */
export const toCanvasAngle = (bearing: number): number => bearing - 90;

/** Zero-padded heading, the way an instrument would show it. */
export const pad3 = (deg: number): string => String(Math.round(deg) % 360).padStart(3, "0");

/** Fixed-decimal value, with an em-dash placeholder when data is missing. */
export function fixed(value: number | null | undefined, digits = 1): string {
  return value === null || value === undefined || !Number.isFinite(value)
    ? "--" + (digits > 0 ? "." + "-".repeat(digits) : "")
    : value.toFixed(digits);
}

/** Small uppercase caption used above every readout. */
export function caption(
  canvas: Canvas,
  palette: Palette,
  text: string,
  x: number,
  y: number,
  align: "left" | "center" | "right" = "left"
): void {
  drawText(canvas, text, x, y, { size: 1, tone: palette.label, align, tracking: 2 });
}

/** Unit suffix, drawn a shade dimmer than the number it follows. */
export function unit(
  canvas: Canvas,
  palette: Palette,
  text: string,
  x: number,
  y: number,
  size = 2
): void {
  drawText(canvas, text, x, y, { size, tone: palette.label });
}

export function hairline(
  canvas: Canvas,
  palette: Palette,
  x0: number,
  y: number,
  x1: number,
  tone?: number
): void {
  canvas.fillRect(x0, y, x1 - x0, 1, tone ?? palette.muted);
}

/** Rounded pill with a label inside, used for state badges. */
export function badge(
  canvas: Canvas,
  text: string,
  x: number,
  y: number,
  opts: { tone: number; textTone: number; filled?: boolean }
): number {
  const padX = 4;
  const w = measureText(text, { size: 1, tracking: 2 }) + padX * 2;
  const h = 11;
  canvas.roundRect(x, y, w, h, 3, {
    tone: opts.tone,
    fill: opts.filled ?? false,
    thickness: 1
  });
  drawText(canvas, text, x + padX, y + 2, { size: 1, tone: opts.textTone, tracking: 2 });
  return w;
}

/**
 * The status bar every screen shares: screen name on the left, link state,
 * outside temperature and clock on the right.
 */
export function drawHeader(
  canvas: Canvas,
  palette: Palette,
  title: string,
  opts: { fixValid: boolean; temperatureC?: number | null }
): void {
  drawText(canvas, title, MARGIN, 3, { size: 1, tone: palette.normal, tracking: 3 });

  let right = HUD_WIDTH - MARGIN;

  const clock = new Date().toTimeString().slice(0, 5);
  drawText(canvas, clock, right, 3, { size: 1, tone: palette.label, align: "right" });
  right -= measureText(clock, { size: 1 }) + 8;

  if (opts.temperatureC !== null && opts.temperatureC !== undefined) {
    const temp = `${Math.round(opts.temperatureC)}\u00B0`;
    drawText(canvas, temp, right, 3, { size: 1, tone: palette.label, align: "right" });
    right -= measureText(temp, { size: 1 }) + 8;
  }

  // GPS indicator: solid once we have a fix, hollow while acquiring.
  canvas.circle(right - 3, 6, 3, {
    fill: opts.fixValid,
    tone: opts.fixValid ? palette.normal : palette.muted,
    thickness: 1
  });

  hairline(canvas, palette, MARGIN, HEADER_HEIGHT, HUD_WIDTH - MARGIN);
}

/** Full-screen message, used for permission and acquisition states. */
export function drawNotice(
  canvas: Canvas,
  palette: Palette,
  title: string,
  lines: readonly string[]
): void {
  const cx = HUD_WIDTH / 2;
  drawText(canvas, title, cx, 56, { size: 2, tone: palette.bright, align: "center", tracking: 2 });
  lines.forEach((line, i) => {
    drawText(canvas, line, cx, 84 + i * 12, {
      size: 1,
      tone: palette.label,
      align: "center",
      tracking: 1
    });
  });
}
