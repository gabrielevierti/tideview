/** Tunables in one place, so nothing important hides inside a render function. */

/**
 * Paint rate. Glyph only repaints when something is invalidated, so this is a
 * ceiling rather than a duty cycle: on a moored boat the app paints when a fix
 * arrives and not once in between.
 */
export const FPS = 15;

/** Slide between screens, in ms. 0 switches instantly. */
export const TRANSITION_MS = 200;

/** How long to wait for the Even Hub bridge before falling back to the browser preview. */
export const BRIDGE_TIMEOUT_MS = 2500;

/** Forecast polling interval while the app is in the foreground. */
export const FORECAST_INTERVAL_MS = 15 * 60 * 1000;

/** Refetch the forecast early once the boat has moved this far. */
export const FORECAST_MOVE_THRESHOLD_M = 8000;

export const REQUEST_TIMEOUT_MS = 8000;

/** A forecast older than this is shown as stale rather than as fact. */
export const FORECAST_STALE_MS = 60 * 60 * 1000;

/**
 * Even Hub lifecycle event codes. The SDK reports them as bare numbers, so they
 * are pinned here rather than guessed at each call site.
 */
export const FOREGROUND_ENTER_EVENT = 4;
export const FOREGROUND_EXIT_EVENT = 5;
export const ABNORMAL_EXIT_EVENT = 6;
export const SYSTEM_EXIT_EVENT = 7;

/**
 * Exit mode for `shutDownPageContainer`. Root-page double tap must hand off to
 * the system exit dialog; a custom in-app exit is auto-rejected in review.
 */
export const EXIT_MODE = 1;

/** Local hours (inclusive start, exclusive end) treated as daylight. */
export const DAY_START_HOUR = 7;
export const DAY_END_HOUR = 20;

/**
 * Night mode is one scalar on the raster rather than a second palette. The
 * whole design dims together at resolve time and no component knows about it.
 */
export const DAY_BRIGHTNESS = 1;
export const NIGHT_BRIGHTNESS = 0.55;

/** Samples kept for the speed and wind trend lines. One per fix, roughly 1/s. */
export const TREND_SAMPLES = 64;
