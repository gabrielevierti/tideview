import { DAY_END_HOUR, DAY_START_HOUR } from "./config";

/**
 * The handful of things a screen needs to know that are not conditions:
 * whether we are dimmed, whether the data is synthetic, whether the glasses are
 * actually on the other end. Screens read it; the shell writes it.
 */
export const session = {
  /** Explicit night setting, or null to follow the clock. */
  nightOverride: null as boolean | null,
  /** True when running against synthetic conditions. */
  demo: false,
  /** True when a G2 bridge is attached rather than a browser preview. */
  bridged: false
};

/** Outside daylight hours the display dims itself; a swipe overrides either way. */
export function isNight(at = new Date()): boolean {
  if (session.nightOverride !== null) return session.nightOverride;
  const hour = at.getHours();
  return hour < DAY_START_HOUR || hour >= DAY_END_HOUR;
}
