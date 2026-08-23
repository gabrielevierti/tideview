import {
  waitForEvenAppBridge,
  TextContainerProperty,
  ImageContainerProperty,
  CreateStartUpPageContainer,
  OsEventTypeList
} from "@evenrealities/even_hub_sdk";

import type { Conditions } from "./models";
import { nextScreen, previousScreen, renderHud, type Screen } from "./hud/index";
import { encodeFrame } from "./gfx/encode";
import {
  ABNORMAL_EXIT_EVENT,
  BRIDGE_TIMEOUT_MS,
  DAY_END_HOUR,
  DAY_START_HOUR,
  EVENT_CONTAINER_ID,
  FOREGROUND_ENTER_EVENT,
  FOREGROUND_EXIT_EVENT,
  HUD_HEIGHT,
  HUD_WIDTH,
  IMAGE_CONTAINER_ID,
  MIN_FRAME_INTERVAL_MS,
  SCREEN_HEIGHT,
  SCREEN_WIDTH,
  SYSTEM_EXIT_EVENT
} from "./config";

export interface Renderer {
  /** True when running inside the Even Hub host rather than a plain browser. */
  readonly isBridged: boolean;
  /** Mark the HUD dirty; the loop coalesces and pushes at most one frame per tick. */
  requestRender(data: Conditions): void;
  getScreen(): Screen;
  setScreen(screen: Screen): void;
  isNight(): boolean;
  toggleNight(): void;
  /** Fires when the app is backgrounded or torn down: stop sensors and polling. */
  onSuspend(listener: () => void): void;
  /** Fires when the app returns to the foreground. */
  onResume(listener: () => void): void;
  onFrame(listener: (frame: Uint8Array, screen: Screen, night: boolean) => void): () => void;
  dispose(): void;
}

/** Some SDK builds resolve numbers, others strings. Accept both spellings of success. */
function isOk(result: unknown): boolean {
  return result === 0 || result === "success" || result === true || result === undefined;
}

function autoNight(): boolean {
  const hour = new Date().getHours();
  return hour < DAY_START_HOUR || hour >= DAY_END_HOUR;
}

/** Resolve the Even Hub bridge, or null if we are not running inside the host. */
async function acquireBridge(): Promise<Awaited<ReturnType<typeof waitForEvenAppBridge>> | null> {
  try {
    return await Promise.race([
      waitForEvenAppBridge(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), BRIDGE_TIMEOUT_MS))
    ]);
  } catch (err) {
    console.warn("[g2] bridge unavailable", err);
    return null;
  }
}

/**
 * Build the renderer. Returns a working renderer even when there is no bridge:
 * frames are still produced (and emitted to `onFrame`) so the browser preview
 * works, they are simply never pushed to the glasses.
 */
export async function createRenderer(): Promise<Renderer> {
  const bridge = await acquireBridge();
  let bridged = false;

  if (bridge) {
    // A full-screen transparent text layer sits under the image and captures
    // touch events; image containers do not receive them.
    const eventLayer = new TextContainerProperty({
      xPosition: 0,
      yPosition: 0,
      width: SCREEN_WIDTH,
      height: SCREEN_HEIGHT,
      borderWidth: 0,
      borderColor: 0,
      paddingLength: 0,
      containerID: EVENT_CONTAINER_ID,
      containerName: "events",
      content: " ",
      isEventCapture: 1,
      zOrderIndex: 1
    });

    const image = new ImageContainerProperty({
      xPosition: (SCREEN_WIDTH - HUD_WIDTH) / 2,
      yPosition: (SCREEN_HEIGHT - HUD_HEIGHT) / 2,
      width: HUD_WIDTH,
      height: HUD_HEIGHT,
      containerID: IMAGE_CONTAINER_ID,
      containerName: "hud",
      zOrderIndex: 2
    });

    const result = await bridge.createStartUpPageContainer(
      new CreateStartUpPageContainer({
        containerTotalNum: 2,
        textObject: [eventLayer],
        imageObject: [image]
      })
    );

    if (!isOk(result)) throw new Error(`createStartUpPageContainer failed: ${String(result)}`);
    bridged = true;
  } else {
    console.info("[g2] no Even Hub bridge; running in browser preview mode");
  }

  let screen: Screen = "main";
  let nightOverride: boolean | null = null;
  let latest: Conditions | null = null;
  let dirty = false;
  let sending = false;
  let suspended = false;
  let disposed = false;
  let lastFrame: Uint8Array | null = null;

  const frameListeners = new Set<(f: Uint8Array, s: Screen, n: boolean) => void>();
  const suspendListeners = new Set<() => void>();
  const resumeListeners = new Set<() => void>();
  const night = () => nightOverride ?? autoNight();

  const framesEqual = (a: Uint8Array | null, b: Uint8Array): boolean => {
    if (a === null || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  };

  async function tick(): Promise<void> {
    if (suspended || disposed || !dirty || sending || latest === null) return;
    dirty = false;
    sending = true;
    try {
      const frame = renderHud(latest, screen, night());

      // Never push a frame identical to the one already on the panel.
      if (framesEqual(lastFrame, frame)) return;
      lastFrame = frame;

      for (const listener of frameListeners) listener(frame, screen, night());

      if (bridged && bridge) {
        const result = await bridge.updateImageRawData({
          containerID: IMAGE_CONTAINER_ID,
          containerName: "hud",
          imageData: encodeFrame(frame, HUD_WIDTH)
        });
        if (!isOk(result)) console.warn("[g2] updateImageRawData:", result);
      }
    } catch (err) {
      console.error("[g2] frame failed", err);
    } finally {
      sending = false;
    }
  }

  // A fixed-rate loop instead of a promise chain: if the link stalls, frames are
  // dropped rather than queued, so the HUD never shows stale data catching up.
  const timer = setInterval(() => void tick(), MIN_FRAME_INTERVAL_MS);

  const invalidate = () => {
    dirty = true;
  };

  const suspend = () => {
    if (suspended) return;
    suspended = true;
    for (const listener of suspendListeners) listener();
  };

  const resume = () => {
    if (!suspended) return;
    suspended = false;
    // The panel may have been cleared while we were away; force a repaint.
    lastFrame = null;
    invalidate();
    for (const listener of resumeListeners) listener();
  };

  let unsubscribeEvents: (() => void) | undefined;
  if (bridged && bridge) {
    unsubscribeEvents = bridge.onEvenHubEvent((event: unknown) => {
      const e = event as { textEvent?: { eventType?: number }; sysEvent?: { eventType?: number } };
      const type = e.textEvent?.eventType ?? e.sysEvent?.eventType;
      if (type === undefined) return;

      switch (type) {
        case OsEventTypeList.CLICK_EVENT:
          screen = nextScreen(screen);
          invalidate();
          break;
        case OsEventTypeList.SCROLL_TOP_EVENT:
          screen = previousScreen(screen);
          invalidate();
          break;
        case OsEventTypeList.SCROLL_BOTTOM_EVENT:
          nightOverride = !night();
          invalidate();
          break;
        case OsEventTypeList.DOUBLE_CLICK_EVENT:
          // Root-page double tap must hand off to the system exit dialog.
          void bridge.shutDownPageContainer(EVENT_CONTAINER_ID);
          break;

        // ---- lifecycle -----------------------------------------------------
        case FOREGROUND_EXIT_EVENT:
          suspend();
          break;
        case FOREGROUND_ENTER_EVENT:
          resume();
          break;
        case ABNORMAL_EXIT_EVENT:
        case SYSTEM_EXIT_EVENT:
          dispose();
          break;

        default:
          break;
      }
    });
  }

  function dispose(): void {
    if (disposed) return;
    disposed = true;
    clearInterval(timer);
    suspend();
    frameListeners.clear();
    suspendListeners.clear();
    resumeListeners.clear();
    unsubscribeEvents?.();
  }

  return {
    isBridged: bridged,
    requestRender(data) {
      latest = data;
      invalidate();
    },
    getScreen: () => screen,
    setScreen(next) {
      screen = next;
      invalidate();
    },
    isNight: night,
    toggleNight() {
      nightOverride = !night();
      invalidate();
    },
    onSuspend(listener) {
      suspendListeners.add(listener);
    },
    onResume(listener) {
      resumeListeners.add(listener);
    },
    onFrame(listener) {
      frameListeners.add(listener);
      return () => {
        frameListeners.delete(listener);
      };
    },
    dispose
  };
}
