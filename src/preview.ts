import { HUD_HEIGHT, HUD_WIDTH } from "./config";
import { SCREENS, type Screen } from "./hud/index";
import type { Renderer } from "./g2";
import { dataBus } from "./dataBus";

/** Pixel scale of the on-screen preview. */
const ZOOM = 3;
/** Approximate colour of the G2's micro-LED green, for a realistic preview. */
const PHOSPHOR: readonly [number, number, number] = [90, 255, 190];

/**
 * Mounts a development preview of the HUD in the page. This never runs on the
 * glasses - it exists so the whole app can be built and debugged in a normal
 * browser tab, which is otherwise impossible with an image-only UI.
 */
export function mountPreview(renderer: Renderer): void {
  const root = document.getElementById("preview");
  if (!root) return;
  root.hidden = false;

  const canvas = document.querySelector<HTMLCanvasElement>("#hud-canvas");
  const tabs = document.querySelector<HTMLElement>("#screen-tabs");
  const nightButton = document.querySelector<HTMLButtonElement>("#night-toggle");
  const status = document.querySelector<HTMLElement>("#link-status");
  if (!canvas || !tabs || !nightButton || !status) return;

  canvas.width = HUD_WIDTH * ZOOM;
  canvas.height = HUD_HEIGHT * ZOOM;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.imageSmoothingEnabled = false;

  // Off-screen buffer at native resolution, blitted up with nearest-neighbour
  // so the preview shows real pixels rather than a smoothed approximation.
  const native = document.createElement("canvas");
  native.width = HUD_WIDTH;
  native.height = HUD_HEIGHT;
  const nativeCtx = native.getContext("2d");
  if (!nativeCtx) return;
  const imageData = nativeCtx.createImageData(HUD_WIDTH, HUD_HEIGHT);

  const buttons = SCREENS.map((screen) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = screen.toUpperCase();
    button.dataset["screen"] = screen;
    button.addEventListener("click", () => renderer.setScreen(screen));
    tabs.append(button);
    return button;
  });

  const syncTabs = (active: Screen) => {
    for (const button of buttons) {
      button.classList.toggle("is-active", button.dataset["screen"] === active);
    }
  };

  nightButton.addEventListener("click", () => renderer.toggleNight());

  // Keyboard shortcuts mirror the glasses gestures.
  window.addEventListener("keydown", (event) => {
    if (event.key === "ArrowRight") renderer.setScreen(nextOf(renderer.getScreen(), 1));
    else if (event.key === "ArrowLeft") renderer.setScreen(nextOf(renderer.getScreen(), -1));
    else if (event.key.toLowerCase() === "n") renderer.toggleNight();
  });

  renderer.onFrame((frame, screen, night) => {
    const pixels = imageData.data;
    for (let i = 0; i < frame.length; i++) {
      const level = (frame[i] as number) / 15;
      pixels[i * 4] = Math.round(PHOSPHOR[0] * level);
      pixels[i * 4 + 1] = Math.round(PHOSPHOR[1] * level);
      pixels[i * 4 + 2] = Math.round(PHOSPHOR[2] * level);
      pixels[i * 4 + 3] = 255;
    }
    nativeCtx.putImageData(imageData, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(native, 0, 0, canvas.width, canvas.height);

    syncTabs(screen);
    nightButton.classList.toggle("is-active", night);
  });

  dataBus.subscribe((data) => {
    const label =
      data.locationPermission === "denied"
        ? "Location denied"
        : data.fix.valid
          ? "GPS fix"
          : "Acquiring GPS";
    status.textContent = label;
    status.classList.toggle("is-live", data.fix.valid);
  });
}

function nextOf(current: Screen, delta: number): Screen {
  const index = (SCREENS.indexOf(current) + delta + SCREENS.length) % SCREENS.length;
  return SCREENS[index] as Screen;
}
