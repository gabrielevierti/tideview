import { OsEventTypeList, waitForEvenAppBridge } from "@evenrealities/even_hub_sdk";
import type { EvenAppBridge } from "@evenrealities/even_hub_sdk";

import {
  ABNORMAL_EXIT_EVENT, BRIDGE_TIMEOUT_MS, EXIT_MODE, FOREGROUND_ENTER_EVENT,
  FOREGROUND_EXIT_EVENT, SYSTEM_EXIT_EVENT
} from "./config";

export type HubInput = "tap" | "double-tap" | "scroll-up" | "scroll-down";

/**
 * Everything the app needs from the host that is not pixels.
 *
 * Glyph's `GlyphRuntime` owns the transport, and deliberately nothing else: its
 * input decoder folds every unrecognised system event into a tap, which means
 * the lifecycle codes (4–7) would read as taps and page the screen when the
 * wearer unlocks their phone. Those codes are the difference between passing
 * review and failing it, so SeaState decodes the event stream itself and lets
 * Glyph get on with pushing tiles.
 */
export interface Hub {
  /**
   * The SDK hands back a bridge object in a plain browser tab too — it only
   * discovers there is no Flutter host behind it when a call fails. So this
   * being non-null does **not** mean there are glasses on the other end; only
   * a successful `createStartUpPageContainer` means that. See `app.ts`.
   */
  readonly bridge: EvenAppBridge | null;
  onInput(listener: (input: HubInput) => void): () => void;
  /** Backgrounded: stop the GPS watch and the forecast poll. */
  onSuspend(listener: () => void): void;
  onResume(listener: () => void): void;
  /** Torn down by the system. */
  onExit(listener: () => void): void;
  /** Hand off to the system exit dialog, as a root page must. */
  exit(): void;
  dispose(): void;
}

async function acquire(): Promise<EvenAppBridge | null> {
  try {
    return await Promise.race([
      waitForEvenAppBridge(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), BRIDGE_TIMEOUT_MS))
    ]);
  } catch (error) {
    console.warn("[hub] bridge unavailable", error);
    return null;
  }
}

export async function connectHub(): Promise<Hub> {
  const bridge = await acquire();

  const inputs = new Set<(input: HubInput) => void>();
  const suspends = new Set<() => void>();
  const resumes = new Set<() => void>();
  const exits = new Set<() => void>();
  let suspended = false;
  let disposed = false;

  const fire = <T>(listeners: Set<(arg: T) => void>, arg: T): void => {
    for (const listener of [...listeners]) {
      try {
        listener(arg);
      } catch (error) {
        console.error("[hub] listener threw", error);
      }
    }
  };

  const exit = (): void => {
    void bridge?.shutDownPageContainer(EXIT_MODE);
  };

  let unsubscribe: (() => void) | undefined;

  if (bridge) {
    unsubscribe = bridge.onEvenHubEvent((event) => {
      const type = event.sysEvent?.eventType ?? event.textEvent?.eventType;
      if (type === undefined) return;

      switch (type) {
        case OsEventTypeList.CLICK_EVENT:
          fire(inputs, "tap");
          break;
        case OsEventTypeList.SCROLL_TOP_EVENT:
          fire(inputs, "scroll-up");
          break;
        case OsEventTypeList.SCROLL_BOTTOM_EVENT:
          fire(inputs, "scroll-down");
          break;
        case OsEventTypeList.DOUBLE_CLICK_EVENT:
          fire(inputs, "double-tap");
          break;

        // ── lifecycle ────────────────────────────────────────────────────
        case FOREGROUND_EXIT_EVENT:
          if (!suspended) {
            suspended = true;
            fire(suspends, undefined as void);
          }
          break;
        case FOREGROUND_ENTER_EVENT:
          if (suspended) {
            suspended = false;
            fire(resumes, undefined as void);
          }
          break;
        case ABNORMAL_EXIT_EVENT:
        case SYSTEM_EXIT_EVENT:
          fire(exits, undefined as void);
          break;

        default:
          break;
      }
    });
  } else {
    console.info("[hub] no Even Hub bridge at all — browser preview");
  }

  return {
    bridge,
    onInput(listener) {
      inputs.add(listener);
      return () => inputs.delete(listener);
    },
    onSuspend(listener) { suspends.add(listener); },
    onResume(listener) { resumes.add(listener); },
    onExit(listener) { exits.add(listener); },
    exit,
    dispose() {
      if (disposed) return;
      disposed = true;
      unsubscribe?.();
      inputs.clear();
      suspends.clear();
      resumes.clear();
      exits.clear();
    }
  };
}
