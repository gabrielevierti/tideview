import type { Canvas } from "../gfx/canvas";
import { drawText } from "../gfx/font";
import { drawSegments } from "../gfx/segments";
import type { Palette } from "../gfx/theme";
import type { Conditions } from "../models";
import { signedAngle } from "../navigation";
import { HUD_WIDTH } from "../config";
import { caption, CONTENT_TOP, fixed, hairline, MARGIN } from "./chrome";
import { drawDial } from "./dial";

/**
 * Douglas sea state, the standard descriptive scale. Reported alongside the
 * numeric height because "1.4 m" means much less than "moderate" to most people.
 */
function douglas(heightM: number): string {
  if (heightM < 0.1) return "CALM";
  if (heightM < 0.5) return "SMOOTH";
  if (heightM < 1.25) return "SLIGHT";
  if (heightM < 2.5) return "MODERATE";
  if (heightM < 4) return "ROUGH";
  if (heightM < 6) return "VERY ROUGH";
  if (heightM < 9) return "HIGH";
  return "VERY HIGH";
}

export function renderSea(canvas: Canvas, p: Palette, data: Conditions): void {
  const { sea, fix } = data;

  if (!sea.valid) {
    drawText(canvas, "NO SEA STATE HERE", HUD_WIDTH / 2, 64, {
      size: 1,
      tone: p.label,
      align: "center",
      tracking: 2
    });
    drawText(canvas, "THE WAVE MODEL DOES NOT COVER", HUD_WIDTH / 2, 80, {
      size: 1,
      tone: p.muted,
      align: "center",
      tracking: 1
    });
    drawText(canvas, "INLAND AND SHELTERED WATERS", HUD_WIDTH / 2, 90, {
      size: 1,
      tone: p.muted,
      align: "center",
      tracking: 1
    });
    return;
  }

  // Wave directions are "travelling towards", so relative to the bow they show
  // which side the sea is coming at you from.
  const course = fix.cogDeg ?? 0;
  const relativeWave = signedAngle(sea.waveDirection + 180 - course);
  const relativeSwell = signedAngle(sea.swellDirection + 180 - course);

  caption(canvas, p, "SIGNIFICANT WAVE", MARGIN, CONTENT_TOP);
  const height = drawSegments(canvas, fixed(sea.waveHeightM, 1), MARGIN, CONTENT_TOP + 9, {
    height: 36,
    tone: p.bright,
    ghostTone: p.faint * 0.55
  });
  drawText(canvas, "M", MARGIN + height + 9, CONTENT_TOP + 31, { size: 2, tone: p.label });

  drawText(canvas, douglas(sea.waveHeightM), MARGIN, 66, {
    size: 1,
    tone: p.normal,
    tracking: 2
  });

  hairline(canvas, p, MARGIN, 78, 176, p.faint);

  const rows: Array<[string, string, string]> = [
    ["PERIOD", fixed(sea.wavePeriodS, 1), "S"],
    ["SWELL", `${fixed(sea.swellHeightM, 1)}`, "M"],
    [
      "SEA TEMP",
      sea.seaTemperatureC === null ? "--" : String(Math.round(sea.seaTemperatureC)),
      "\u00B0C"
    ]
  ];

  rows.forEach(([label, value, suffix], i) => {
    const top = 84 + i * 20;
    caption(canvas, p, label, MARGIN, top + 4);
    drawSegments(canvas, value, 152, top, {
      height: 14,
      tone: p.normal,
      ghostTone: p.faint * 0.55,
      align: "right"
    });
    drawText(canvas, suffix, 158, top + 4, { size: 1, tone: p.label });
  });

  drawDial(canvas, p, {
    cx: 232,
    cy: 76,
    r: 44,
    arrows: [
      { angle: relativeWave, tone: p.bright },
      { angle: relativeSwell, tone: p.label, hollow: true }
    ],
    caption: "SEA FROM",
    value: String(Math.abs(Math.round(relativeWave))),
    unit: relativeWave >= 0 ? "STARBOARD" : "PORT"
  });
}
