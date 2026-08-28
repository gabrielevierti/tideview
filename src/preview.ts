import { screen as SCREEN } from "@gabrielevierti/glyph";
import type { GlyphApp } from "@gabrielevierti/glyph";

import { dataBus } from "./dataBus";
import { isNight, session } from "./session";
import type { SeaStateApp } from "./app";
import { applyBrightness } from "./app";

/**
 * Development preview.
 *
 * Not a simulator: it paints the same framebuffer the glasses get, at the same
 * 16 levels, then scales it with nearest-neighbour so you are looking at real
 * pixels rather than an interpolation of them. The green is cosmetic — the G2
 * panel is monochrome and so is everything upstream of this file.
 */

const ZOOM = 2;
/** Approximate colour of the G2's micro-LED green. */
const PHOSPHOR: readonly [number, number, number] = [90, 255, 190];

export interface Preview {
  /** Passed to `GlyphApp` as its paint hook. */
  paint(levels: Uint8Array, app: GlyphApp): void;
  /** Called once the app exists. Silently detaches when glasses are attached. */
  attach(seastate: SeaStateApp): void;
}

export function createPreview(): Preview | null {
  const root = document.querySelector<HTMLElement>("#preview");
  const canvas = document.querySelector<HTMLCanvasElement>("#screen");
  const tabs = document.querySelector<HTMLElement>("#screen-tabs");
  const nightButton = document.querySelector<HTMLButtonElement>("#night-toggle");
  const surfaceButton = document.querySelector<HTMLButtonElement>("#surface-toggle");
  const status = document.querySelector<HTMLElement>("#link-status");
  const stats = document.querySelector<HTMLElement>("#stats");
  if (!root || !canvas || !tabs || !nightButton || !surfaceButton || !status || !stats) return null;

  canvas.width = SCREEN.width * ZOOM;
  canvas.height = SCREEN.height * ZOOM;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = false;

  // Native-resolution buffer, blitted up. Drawing at 1x and scaling is what
  // keeps the preview honest about how much of the panel a hairline uses.
  const native = document.createElement("canvas");
  native.width = SCREEN.width;
  native.height = SCREEN.height;
  const nativeCtx = native.getContext("2d");
  if (!nativeCtx) return null;
  const image = nativeCtx.createImageData(SCREEN.width, SCREEN.height);

  let active = false;
  let buttons: HTMLButtonElement[] = [];

  return {
    paint(levels, app) {
      if (!active) return;
      const pixels = image.data;
      for (let i = 0; i < levels.length; i++) {
        const level = levels[i] / 15;
        const j = i * 4;
        pixels[j] = Math.round(PHOSPHOR[0] * level);
        pixels[j + 1] = Math.round(PHOSPHOR[1] * level);
        pixels[j + 2] = Math.round(PHOSPHOR[2] * level);
        pixels[j + 3] = 255;
      }
      nativeCtx.putImageData(image, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(native, 0, 0, canvas.width, canvas.height);

      buttons.forEach((button, i) => button.classList.toggle("is-active", i === app.screenIndex));
      nightButton.classList.toggle("is-active", isNight());
      stats.textContent =
        `${app.fps.toFixed(0)} fps · ${app.lastDirtyTiles}/4 tiles · ` +
        `${app.surface}${session.demo ? " · demo" : ""}`;
    },

    attach(seastate) {
      if (seastate.hub.bridged) return;   // real glasses: nobody is looking at the DOM
      active = true;
      root.hidden = false;

      const { app } = seastate;

      buttons = app.screens.map((screen, index) => {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = screen.name;
        button.addEventListener("click", () => app.goto(index));
        tabs.append(button);
        return button;
      });

      nightButton.addEventListener("click", () => {
        session.nightOverride = !isNight();
        applyBrightness(app);
      });

      surfaceButton.addEventListener("click", () => {
        app.surface = app.surface === "outline" ? "filled" : "outline";
        surfaceButton.textContent = app.surface === "outline" ? "Filled" : "Outline";
      });

      window.addEventListener("keydown", (event) => {
        const key = event.key.toLowerCase();
        if (event.key === "ArrowRight") app.next();
        else if (event.key === "ArrowLeft") app.previous();
        else if (key === "n") { session.nightOverride = !isNight(); applyBrightness(app); }
        else if (key === "s") app.surface = app.surface === "outline" ? "filled" : "outline";
        else if (key >= "1" && key <= String(app.screens.length)) app.goto(Number(key) - 1);
      });

      dataBus.subscribe((data) => {
        status.textContent =
          data.locationPermission === "denied" ? "Location denied"
            : data.fix.valid ? "GPS fix"
              : "Acquiring GPS";
        status.classList.toggle("is-live", data.fix.valid);
      });
    }
  };
}
