import { GlyphApp, TILE_QUADRANTS, loadFontSet } from "@gabrielevierti/glyph";
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
  /** Non-null only once the host has actually accepted a page of containers. */
  runtime: GlyphRuntime | null;
  /** True when frames are going to glasses rather than to the preview canvas. */
  bridged: boolean;
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
  const font = await loadFont();

  const app = new GlyphApp({
    screens,
    // Quadrants, and not by preference: an image container is capped at
    // 288x144, and four of those cover 576x288 exactly — so this is the only
    // shape that both fits the cap and covers the screen. Glyph's other
    // layouts are rejected by the host at page creation.
    tileLayout: TILE_QUADRANTS,
    fps: FPS,
    transitionMs: TRANSITION_MS,
    font,
    brightness: isNight() ? NIGHT_BRIGHTNESS : DAY_BRIGHTNESS,
    onPaint,
    onSlowFrame: ({ screen, ms }) => console.warn(`[app] ${screen} painted in ${ms.toFixed(1)}ms`)
  });

  // Whether we are on glasses is not answerable by asking: the SDK resolves a
  // bridge object in any browser tab, and only reports the truth when a call
  // reaches the host and fails. So we try to create the page, and a failure is
  // a normal, expected answer — it means "browser", not "broken".
  let runtime: GlyphRuntime | null = null;
  if (hub.bridge) {
    const candidate = new GlyphRuntime({ tileLayout: TILE_QUADRANTS });
    try {
      await candidate.start();
      app.attachRuntime(candidate);
      runtime = candidate;
    } catch (error) {
      console.info("[app] no Even Hub host — running the browser preview", error);
      await candidate.stop().catch(() => undefined);
    }
  }
  session.bridged = runtime !== null;

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
    bridged: runtime !== null,
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
