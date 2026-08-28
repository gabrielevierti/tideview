import { GlyphApp, TILE_CHROME, loadFontSet } from "@gabrielevierti/glyph";
import { GlyphRuntime } from "@gabrielevierti/glyph/runtime";
import type { GlyphFontSet } from "@gabrielevierti/glyph";

import { DAY_BRIGHTNESS, FPS, NIGHT_BRIGHTNESS, TRANSITION_MS } from "./config";
import { dataBus } from "./dataBus";
import { connectHub, type Hub } from "./hub";
import { screens } from "./screens/index";
import { isNight, session } from "./session";
import { recordTrends } from "./trend";

/** How often the clock in the status bar and the day/night decision are revisited. */
const TICK_MS = 30_000;

export interface SeaStateApp {
  app: GlyphApp;
  hub: Hub;
  runtime: GlyphRuntime | null;
  dispose(): void;
}

/**
 * The font atlas is optional. With it, text is identical on every machine and
 * on the glasses; without it Glyph falls back to the host font stack, which is
 * fine in a browser and merely unpinned on device.
 */
async function loadFont(): Promise<GlyphFontSet | null> {
  try {
    return await loadFontSet(`${import.meta.env.BASE_URL}fonts/inter.json`);
  } catch {
    console.info("[app] no font atlas — falling back to the host fonts. Run `npm run font`.");
    return null;
  }
}

/**
 * @param onPaint The browser preview's paint hook. `GlyphApp` takes it at
 * construction, which is why it is threaded in from `main` rather than
 * attached afterwards.
 */
export async function createApp(
  onPaint?: (levels: Uint8Array, app: GlyphApp) => void
): Promise<SeaStateApp> {
  session.demo = import.meta.env.VITE_DEMO === "1";

  const hub = await connectHub();
  session.bridged = hub.bridged;

  const font = await loadFont();

  const app = new GlyphApp({
    screens,
    // Measured, not chosen by taste: of the five shapes Glyph ships, the chrome
    // split is the cheapest for this design — a status strip that changes once
    // a minute has no business sharing a tile with a compass rose.
    tileLayout: TILE_CHROME,
    fps: FPS,
    transitionMs: TRANSITION_MS,
    font,
    brightness: isNight() ? NIGHT_BRIGHTNESS : DAY_BRIGHTNESS,
    onPaint,
    onSlowFrame: ({ screen, ms }) => console.warn(`[app] ${screen} painted in ${ms.toFixed(1)}ms`)
  });

  let runtime: GlyphRuntime | null = null;
  if (hub.bridged) {
    runtime = new GlyphRuntime({ tileLayout: TILE_CHROME });
    try {
      await runtime.start();
      app.attachRuntime(runtime);
    } catch (error) {
      console.error("[app] runtime failed to start", error);
      runtime = null;
    }
  }

  // ── Input ────────────────────────────────────────────────────────────────
  // Tap pages forward, swipe up goes back, swipe down dims. Double tap is not
  // ours to interpret: a root page must hand off to the system exit dialog.
  hub.onInput((input) => {
    switch (input) {
      case "tap":
        app.next();
        break;
      case "scroll-up":
        app.previous();
        break;
      case "scroll-down":
        session.nightOverride = !isNight();
        applyBrightness(app);
        break;
      case "double-tap":
        hub.exit();
        break;
    }
  });

  // ── Repaint triggers ─────────────────────────────────────────────────────
  // Nothing here is `animated`, so the paint loop idles until something asks
  // for a frame. A moored boat with a stale forecast costs nothing.
  const unsubscribe = dataBus.subscribe(() => {
    recordTrends();
    app.invalidate();
  });

  const tick = setInterval(() => {
    applyBrightness(app);
    app.invalidate();
  }, TICK_MS);

  app.start();

  return {
    app,
    hub,
    runtime,
    dispose() {
      clearInterval(tick);
      unsubscribe();
      app.dispose();
      void runtime?.stop();
      hub.dispose();
    }
  };
}

/**
 * Night mode is one scalar applied at resolve, so the whole design dims
 * together. Only written when it actually changes — the setter forces a full
 * repaint of every tile, which is the right behaviour and the wrong thing to
 * do twice a minute for no reason.
 */
export function applyBrightness(app: GlyphApp): void {
  const wanted = isNight() ? NIGHT_BRIGHTNESS : DAY_BRIGHTNESS;
  if (Math.abs(app.brightness - wanted) > 0.001) app.brightness = wanted;
}
