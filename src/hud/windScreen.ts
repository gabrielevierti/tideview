import type { Canvas } from "../gfx/canvas";
import { drawText } from "../gfx/font";
import { drawSegments } from "../gfx/segments";
import type { Palette } from "../gfx/theme";
import type { Conditions } from "../models";
import { compassPoint } from "../navigation";
import { pointOfSail, solveWind } from "../wind";
import { HUD_WIDTH } from "../config";
import { caption, CONTENT_TOP, fixed, hairline, MARGIN, pad3 } from "./chrome";
import { drawDial } from "./dial";

const STACK_LEFT = 148;
const VALUE_RIGHT = HUD_WIDTH - MARGIN - 22;

function row(
  canvas: Canvas,
  p: Palette,
  label: string,
  value: string,
  suffix: string,
  top: number,
  tone: number
): void {
  caption(canvas, p, label, STACK_LEFT, top + 5);
  drawSegments(canvas, value, VALUE_RIGHT, top, {
    height: 16,
    tone,
    ghostTone: p.faint * 0.55,
    align: "right"
  });
  drawText(canvas, suffix, VALUE_RIGHT + 7, top + 5, { size: 1, tone: p.label, tracking: 1 });
}

export function renderWind(canvas: Canvas, p: Palette, data: Conditions): void {
  const { fix, weather } = data;
  const solution = solveWind(weather.windDirection, weather.windSpeedKnots, fix.cogDeg, fix.sogKnots);

  if (!weather.valid) {
    drawText(canvas, "WAITING FOR FORECAST", HUD_WIDTH / 2, 70, {
      size: 1,
      tone: p.label,
      align: "center",
      tracking: 2
    });
    return;
  }

  // Solid arrow is apparent wind, hollow is true - the pair shows at a glance
  // how much of the breeze on deck is the boat's own making.
  drawDial(canvas, p, {
    cx: 74,
    cy: 76,
    r: 50,
    arrows: solution.valid
      ? [
          { angle: solution.awa, tone: p.bright },
          { angle: solution.twa, tone: p.label, hollow: true }
        ]
      : [],
    ...(solution.valid ? { sweepTo: solution.twa } : {}),
    caption: "APPARENT",
    value: fixed(solution.aws, 1),
    unit: "KNOTS"
  });

  drawText(canvas, solution.valid ? pointOfSail(solution.twa) : "NO COURSE", 74, 134, {
    size: 1,
    tone: solution.valid ? p.normal : p.muted,
    align: "center",
    tracking: 1
  });

  caption(canvas, p, "TRUE WIND", STACK_LEFT, CONTENT_TOP);
  const twsWidth = drawSegments(canvas, fixed(solution.tws, 1), STACK_LEFT, CONTENT_TOP + 9, {
    height: 30,
    tone: p.bright,
    ghostTone: p.faint * 0.55
  });
  drawText(canvas, "KT", STACK_LEFT + twsWidth + 8, CONTENT_TOP + 27, { size: 2, tone: p.label });

  hairline(canvas, p, STACK_LEFT, 64, HUD_WIDTH - MARGIN, p.faint);

  row(
    canvas,
    p,
    "FROM",
    pad3(weather.windDirection),
    compassPoint(weather.windDirection),
    70,
    p.normal
  );
  row(canvas, p, "GUST", fixed(weather.windGustKnots, 1), "KT", 92, p.normal);
  row(
    canvas,
    p,
    solution.valid ? "TWA" : "ANGLE",
    solution.valid ? String(Math.abs(Math.round(solution.twa))) : "--",
    solution.valid ? (solution.twa >= 0 ? "\u00B0S" : "\u00B0P") : "",
    114,
    p.bright
  );
}
