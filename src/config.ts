/** Tunables in one place, so nothing important hides inside a render function. */

/** Image container size on the G2. See README for why it is not the full 576x288. */
export const HUD_WIDTH = 288;
export const HUD_HEIGHT = 144;

/** Full display size; the transparent event-capture layer spans all of it. */
export const SCREEN_WIDTH = 576;
export const SCREEN_HEIGHT = 288;

/** Container IDs used with the Even Hub SDK. */
export const EVENT_CONTAINER_ID = 1;
export const IMAGE_CONTAINER_ID = 2;

/**
 * Minimum spacing between pushed frames, in ms. Image updates are serialised on
 * the SDK side; pushing faster than the link can drain just builds latency.
 */
export const MIN_FRAME_INTERVAL_MS = 250;

/** How long to wait for the Even Hub bridge before falling back to browser preview. */
export const BRIDGE_TIMEOUT_MS = 2500;

/** Forecast polling interval while the app is in the foreground. */
export const FORECAST_INTERVAL_MS = 15 * 60 * 1000;

/** Refetch the forecast early once the boat has moved this far. */
export const FORECAST_MOVE_THRESHOLD_M = 8000;

export const REQUEST_TIMEOUT_MS = 8000;

/**
 * Even Hub lifecycle event codes. These are documented numerically rather than
 * exposed as SDK constants, so they are pinned here.
 */
export const FOREGROUND_ENTER_EVENT = 4;
export const FOREGROUND_EXIT_EVENT = 5;
export const ABNORMAL_EXIT_EVENT = 6;
export const SYSTEM_EXIT_EVENT = 7;

/**
 * Wire format for `updateImageRawData`.
 *
 * "bytes"  - one byte per pixel, value 0..15
 * "packed" - two pixels per byte, high nibble first (a true 4bpp bitmap)
 *
 * The SDK docs are ambiguous here, so this is a switch rather than a
 * hard-coded choice. If the HUD renders as noise or as two side-by-side
 * half-images, flip it.
 */
export const IMAGE_ENCODING: "bytes" | "packed" = "bytes";

/** Local hours (inclusive start, exclusive end) treated as daylight. */
export const DAY_START_HOUR = 7;
export const DAY_END_HOUR = 20;
