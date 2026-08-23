/** Compass and great-circle helpers. All bearings are degrees true. */

export function norm360(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

/** Wrap to -180..180, where negative means "to port". */
export function signedAngle(deg: number): number {
  return norm360(deg + 180) - 180;
}

const R_EARTH_M = 6371000;
const rad = (d: number) => (d * Math.PI) / 180;

export function distanceMeters(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const p1 = rad(aLat);
  const p2 = rad(bLat);
  const h =
    Math.sin(rad(bLat - aLat) / 2) ** 2 +
    Math.cos(p1) * Math.cos(p2) * Math.sin(rad(bLon - aLon) / 2) ** 2;
  return 2 * R_EARTH_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Compass point label for a bearing, e.g. 127 -> "SE". */
export function compassPoint(deg: number): string {
  const points = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return points[Math.round(norm360(deg) / 45) % 8] as string;
}

export const msToKnots = (ms: number): number => ms * 1.94384;
export const kmhToKnots = (kmh: number): number => kmh / 1.852;
