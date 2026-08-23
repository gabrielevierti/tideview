import { norm360, signedAngle } from "./navigation";

/**
 * Apparent wind derived from forecast true wind and GPS motion.
 *
 * A masthead unit measures apparent wind directly; without one we can still
 * compute it, because apparent wind is just the vector sum of the true wind and
 * the boat's own motion through the air. The result is only as good as the
 * forecast and assumes no current, but for trimming decisions and point-of-sail
 * it is far more useful than showing true wind alone.
 */
export interface WindSolution {
  /** True wind speed, knots. */
  tws: number;
  /** True wind angle relative to the bow, -180..180. Negative is to port. */
  twa: number;
  /** Apparent wind speed, knots. */
  aws: number;
  /** Apparent wind angle relative to the bow, -180..180. */
  awa: number;
  valid: boolean;
}

/**
 * @param twdFrom Direction the true wind blows *from*, degrees true.
 * @param tws     True wind speed, knots.
 * @param course  Boat course over ground, degrees true.
 * @param speed   Boat speed over ground, knots.
 */
export function solveWind(
  twdFrom: number,
  tws: number,
  course: number | null,
  speed: number | null
): WindSolution {
  // Without a course there is no bow to measure angles from.
  if (course === null) {
    return { tws, twa: 0, aws: tws, awa: 0, valid: false };
  }

  const twa = signedAngle(twdFrom - course);
  const boatSpeed = speed ?? 0;

  // Work in a boat-fixed frame: x forward, y to starboard. The true wind
  // arrives from bearing `twa`, so its velocity vector points the opposite way.
  const a = (twa * Math.PI) / 180;
  const windX = -tws * Math.cos(a);
  const windY = -tws * Math.sin(a);

  // The boat's motion adds an equal and opposite headwind.
  const apparentX = windX - boatSpeed;
  const apparentY = windY;

  const aws = Math.hypot(apparentX, apparentY);
  // Convert back to a "blowing from" angle relative to the bow.
  const awa = norm360((Math.atan2(-apparentY, -apparentX) * 180) / Math.PI);

  return { tws, twa, aws, awa: signedAngle(awa), valid: true };
}

/** Point of sail for a true wind angle. Useful to sail and power alike. */
export function pointOfSail(twa: number): string {
  const a = Math.abs(twa);
  if (a < 32) return "IN IRONS";
  if (a < 60) return "CLOSE HAULED";
  if (a < 80) return "CLOSE REACH";
  if (a < 100) return "BEAM REACH";
  if (a < 150) return "BROAD REACH";
  return "RUNNING";
}
