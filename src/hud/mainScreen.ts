import type { Canvas } from "../gfx/canvas";
import { drawText } from "../gfx/font";
import { drawSegments } from "../gfx/segments";
import type { Palette } from "../gfx/theme";
import type { Conditions } from "../models";
import { compassPoint } from "../navigation";
import { solveWind } from "../wind";
import { HUD_WIDTH } from "../config";
import { caption, CONTENT_TOP, fixed, hairline, MARGIN, pad3, unit } from "./chrome";
import { drawDial } from "./dial";

const COLUMN_SPLIT = 176;

export function renderMain(canvas: Canvas, p: Palette, data: Conditions): void {
  const { fix, weather } = data;

  // ---- speed over ground ---------------------------------------------------
  caption(canvas, p, "SPEED OVER GROUND", MARGIN, CONTENT_TOP);
  const sogWidth = drawSegments(canvas, fixed(fix.sogKnots, 1), MARGIN, CONTENT_TOP + 9, {
    height: 36,
    tone: p.bright,
    ghostTone: p.faint * 0.55
  });
  unit(canvas, p, "KT", MARGIN + sogWidth + 9, CONTENT_TOP + 31, 2);

  hairline(canvas, p, MARGIN, 68, COLUMN_SPLIT - 8, p.faint);

  // ---- course --------------------------------------------------------------
  caption(canvas, p, "COURSE OVER GROUND", MARGIN, 73);
  const cogText = fix.cogDeg === null ? "---" : pad3(fix.cogDeg);
  const cogWidth = drawSegments(canvas, cogText, MARGIN, 82, {
    height: 26,
    tone: p.normal,
    ghostTone: p.faint * 0.55
  });
  drawText(canvas, "\u00B0", MARGIN + cogWidth + 4, 84, { size: 1, tone: p.label });
  if (fix.cogDeg !== null) {
    drawText(canvas, compassPoint(fix.cogDeg), MARGIN + cogWidth + 14, 94, {
      size: 2,
      tone: p.label,
      tracking: 1
    });
  }

  // ---- rain outlook --------------------------------------------------------
  const rainText = !weather.valid
    ? "FORECAST PENDING"
    : weather.nextRainMinutes === null
      ? "NO RAIN EXPECTED"
      : weather.nextRainMinutes < 60
        ? `RAIN IN ${weather.nextRainMinutes} MIN`
        : `RAIN IN ${Math.round(weather.nextRainMinutes / 60)} H`;
  drawText(canvas, rainText, MARGIN, 128, { size: 1, tone: p.label, tracking: 1 });

  // ---- wind ----------------------------------------------------------------
  const solution = solveWind(weather.windDirection, weather.windSpeedKnots, fix.cogDeg, fix.sogKnots);

  drawDial(canvas, p, {
    cx: 232,
    cy: 54,
    r: 38,
    arrows: solution.valid
      ? [
          { angle: solution.awa, tone: p.bright },
          { angle: solution.twa, tone: p.label, hollow: true }
        ]
      : [],
    ...(solution.valid ? { sweepTo: solution.awa } : {}),
    caption: solution.valid ? `AWA ${signed(solution.awa)}` : "WIND",
    value: weather.valid ? fixed(solution.aws, 1) : "--.-",
    unit: solution.valid ? "KT APPARENT" : "KT TRUE"
  });

  const rows: Array<[string, string, string]> = [
    ["TWS", fixed(solution.tws, 1), "KT"],
    ["GUST", fixed(weather.windGustKnots, 1), "KT"]
  ];

  rows.forEach(([label, value, suffix], i) => {
    const top = 100 + i * 23;
    caption(canvas, p, label, COLUMN_SPLIT + 8, top + 5);
    drawSegments(canvas, weather.valid ? value : "--.-", HUD_WIDTH - MARGIN - 16, top, {
      height: 18,
      tone: p.normal,
      ghostTone: p.faint * 0.55,
      align: "right"
    });
    drawText(canvas, suffix, HUD_WIDTH - MARGIN - 13, top + 5, {
      size: 1,
      tone: p.label,
      tracking: 1
    });
  });
}

function signed(angle: number): string {
  return `${angle >= 0 ? "+" : "-"}${Math.abs(Math.round(angle))}\u00B0`;
}
