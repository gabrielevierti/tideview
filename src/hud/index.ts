import { Canvas } from "../gfx/canvas";
import { palette } from "../gfx/theme";
import type { Conditions } from "../models";
import { HUD_HEIGHT, HUD_WIDTH } from "../config";
import { drawHeader, drawNotice } from "./chrome";
import { renderMain } from "./mainScreen";
import { renderWind } from "./windScreen";
import { renderSea } from "./seaScreen";
import { renderWx } from "./wxScreen";

export const SCREENS = ["main", "wind", "sea", "wx"] as const;
export type Screen = (typeof SCREENS)[number];

const TITLES: Record<Screen, string> = {
  main: "NAVIGATION",
  wind: "WIND",
  sea: "SEA STATE",
  wx: "WEATHER"
};

export function nextScreen(current: Screen): Screen {
  return SCREENS[(SCREENS.indexOf(current) + 1) % SCREENS.length] as Screen;
}

export function previousScreen(current: Screen): Screen {
  return SCREENS[(SCREENS.indexOf(current) + SCREENS.length - 1) % SCREENS.length] as Screen;
}

/**
 * Render one frame. Returns a fresh `Uint8Array` of `HUD_WIDTH * HUD_HEIGHT`
 * values in the range 0..15, row-major, top-left origin.
 */
export function renderHud(data: Conditions, screen: Screen, night = false): Uint8Array {
  const canvas = new Canvas(HUD_WIDTH, HUD_HEIGHT);
  const p = palette(night);

  drawHeader(canvas, p, TITLES[screen], {
    fixValid: data.fix.valid,
    temperatureC: data.weather.valid ? data.weather.temperatureC : null
  });

  // Without a position nothing else on any screen can be computed, so say so
  // plainly rather than showing four screens of dashes.
  if (data.locationPermission === "denied") {
    drawNotice(canvas, p, "LOCATION IS OFF", [
      "SEASTATE NEEDS YOUR POSITION",
      "TO FETCH THE LOCAL FORECAST.",
      "ENABLE IT IN THE EVEN APP."
    ]);
    return canvas.toGray4();
  }

  if (data.locationPermission === "unavailable") {
    drawNotice(canvas, p, "NO LOCATION SERVICE", ["THIS DEVICE CANNOT PROVIDE", "A POSITION FIX."]);
    return canvas.toGray4();
  }

  if (!data.fix.valid) {
    drawNotice(canvas, p, "ACQUIRING GPS", ["WAITING FOR A POSITION FIX."]);
    return canvas.toGray4();
  }

  switch (screen) {
    case "main":
      renderMain(canvas, p, data);
      break;
    case "wind":
      renderWind(canvas, p, data);
      break;
    case "sea":
      renderSea(canvas, p, data);
      break;
    case "wx":
      renderWx(canvas, p, data);
      break;
  }

  return canvas.toGray4();
}
