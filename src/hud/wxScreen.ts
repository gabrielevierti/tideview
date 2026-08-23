import type { Canvas } from "../gfx/canvas";
import { drawText } from "../gfx/font";
import { drawSegments } from "../gfx/segments";
import type { Palette } from "../gfx/theme";
import type { Conditions } from "../models";
import { HUD_WIDTH } from "../config";
import { caption, CONTENT_TOP, fixed, hairline, MARGIN } from "./chrome";

const STRIP_TOP = 100;
const STRIP_HEIGHT = 26;

/** Twelve-hour rain probability, as a small column chart. */
function rainStrip(canvas: Canvas, p: Palette, probabilities: number[]): void {
  const x = MARGIN;
  const width = HUD_WIDTH - MARGIN * 2;
  caption(canvas, p, "RAIN PROBABILITY - NEXT 12H", x, STRIP_TOP - 10);

  const slots = 12;
  const gap = 3;
  const barWidth = (width - gap * (slots - 1)) / slots;
  const startHour = new Date().getHours();

  for (let i = 0; i < slots; i++) {
    const value = Math.max(0, Math.min(100, probabilities[i] ?? 0));
    const bx = x + i * (barWidth + gap);
    const height = Math.max(1.5, (value / 100) * STRIP_HEIGHT);

    canvas.roundRect(bx, STRIP_TOP, barWidth, STRIP_HEIGHT, 1.5, { tone: p.faint, fill: true });
    canvas.roundRect(bx, STRIP_TOP + STRIP_HEIGHT - height, barWidth, height, 1.5, {
      tone: value >= 60 ? p.bright : value >= 30 ? p.normal : p.label,
      fill: true
    });

    if (i % 3 === 0) {
      drawText(canvas, String((startHour + i + 1) % 24).padStart(2, "0"), bx + barWidth / 2, STRIP_TOP + STRIP_HEIGHT + 4, {
        size: 1,
        tone: p.muted,
        align: "center",
        tracking: 1
      });
    }
  }
}

export function renderWx(canvas: Canvas, p: Palette, data: Conditions): void {
  const wx = data.weather;

  if (!wx.valid) {
    drawText(canvas, "WAITING FOR FORECAST", HUD_WIDTH / 2, 66, {
      size: 1,
      tone: p.label,
      align: "center",
      tracking: 2
    });
    return;
  }

  caption(canvas, p, "AIR", MARGIN, CONTENT_TOP);
  const tempWidth = drawSegments(canvas, String(Math.round(wx.temperatureC)), MARGIN, CONTENT_TOP + 9, {
    height: 32,
    tone: p.bright,
    ghostTone: p.faint * 0.55
  });
  drawText(canvas, "\u00B0C", MARGIN + tempWidth + 10, CONTENT_TOP + 11, { size: 2, tone: p.label });

  const windX = 116;
  caption(canvas, p, "WIND", windX, CONTENT_TOP);
  const windWidth = drawSegments(canvas, fixed(wx.windSpeedKnots, 0), windX, CONTENT_TOP + 9, {
    height: 32,
    tone: p.normal,
    ghostTone: p.faint * 0.55
  });
  drawText(canvas, "KT", windX + windWidth + 10, CONTENT_TOP + 11, { size: 2, tone: p.label });
  drawText(canvas, `GUST ${Math.round(wx.windGustKnots)}`, windX, CONTENT_TOP + 44, {
    size: 1,
    tone: p.label,
    tracking: 1
  });

  const rainX = HUD_WIDTH - MARGIN;
  caption(canvas, p, "NEXT RAIN", rainX, CONTENT_TOP, "right");
  if (wx.nextRainMinutes === null) {
    drawText(canvas, "NONE", rainX, CONTENT_TOP + 16, {
      size: 2,
      tone: p.normal,
      align: "right",
      tracking: 1
    });
    drawText(canvas, "IN 48H", rainX, CONTENT_TOP + 34, {
      size: 1,
      tone: p.muted,
      align: "right",
      tracking: 1
    });
  } else {
    const hours = Math.floor(wx.nextRainMinutes / 60);
    drawSegments(canvas, hours >= 1 ? String(hours) : String(wx.nextRainMinutes), rainX, CONTENT_TOP + 9, {
      height: 32,
      tone: p.bright,
      ghostTone: p.faint * 0.55,
      align: "right"
    });
    drawText(canvas, hours >= 1 ? "HOURS" : "MINUTES", rainX, CONTENT_TOP + 43, {
      size: 1,
      tone: p.label,
      align: "right",
      tracking: 1
    });
  }

  hairline(canvas, p, MARGIN, 88, HUD_WIDTH - MARGIN, p.faint);
  rainStrip(canvas, p, wx.hourlyProbability);
}
