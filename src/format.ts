/** How numbers become strings. One place, so no two screens disagree. */

/** Fixed-decimal value, with a dashed placeholder when the data is missing. */
export function fixed(value: number | null | undefined, digits = 1): string {
  return value === null || value === undefined || !Number.isFinite(value)
    ? digits > 0 ? `--.${"-".repeat(digits)}` : "--"
    : value.toFixed(digits);
}

/** Zero-padded heading, the way an instrument would show it. */
export function pad3(deg: number | null): string {
  return deg === null || !Number.isFinite(deg)
    ? "---"
    : String(Math.round(deg) % 360).padStart(3, "0");
}

/** Signed angle off the bow, with the side spelled out rather than implied. */
export function relative(angle: number): string {
  const a = Math.abs(Math.round(angle));
  return a === 0 || a === 180 ? `${a}°` : `${a}°${angle > 0 ? "S" : "P"}`;
}

/** Clock in the wearer's local time. */
export function clock(at = new Date()): string {
  return at.toTimeString().slice(0, 5);
}

/** A duration in minutes, rendered at whatever precision is still useful. */
export function duration(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)} min`;
  if (minutes < 60 * 24) return `${Math.round(minutes / 60)} h`;
  return `${Math.round(minutes / (60 * 24))} d`;
}

/** How old a reading is. Under a minute is "now": nobody needs the seconds. */
export function age(at: number, now = Date.now()): string {
  const minutes = Math.floor((now - at) / 60000);
  if (!Number.isFinite(minutes) || at === 0) return "—";
  if (minutes < 1) return "now";
  return duration(minutes);
}

/**
 * Douglas sea state, the standard descriptive scale. Reported alongside the
 * height because "1.4 m" means much less than "moderate" to most people.
 */
const DOUGLAS = [
  { to: 0.1, name: "CALM", degree: 0 },
  { to: 0.5, name: "SMOOTH", degree: 1 },
  { to: 1.25, name: "SLIGHT", degree: 2 },
  { to: 2.5, name: "MODERATE", degree: 3 },
  { to: 4, name: "ROUGH", degree: 4 },
  { to: 6, name: "VERY ROUGH", degree: 5 },
  { to: 9, name: "HIGH", degree: 6 },
  { to: 14, name: "VERY HIGH", degree: 7 },
  { to: Infinity, name: "PHENOMENAL", degree: 8 }
] as const;

export function douglas(heightM: number): { name: string; degree: number } {
  const band = DOUGLAS.find((b) => heightM < b.to) ?? DOUGLAS[DOUGLAS.length - 1];
  return { name: band.name, degree: band.degree };
}

/** Beaufort force for a wind speed in knots. Used as a coarse gauge, not a value. */
export function beaufort(knots: number): number {
  const limits = [1, 3, 6, 10, 16, 21, 27, 33, 40, 47, 55, 63];
  const index = limits.findIndex((limit) => knots < limit);
  return index < 0 ? 12 : index;
}
