import { TREND_SAMPLES } from "./config";
import { dataBus } from "./dataBus";
import { solveWind } from "./wind";

/**
 * A few minutes of history, kept in memory.
 *
 * The old build showed instantaneous values only, which is fine for speed and
 * useless for wind: what a helm actually wants to know is whether the breeze is
 * building or dying, and one number cannot say. Two ring buffers cost a few
 * hundred bytes and turn two readouts into two trends.
 */
class Trend {
  private readonly values: number[] = [];

  constructor(private readonly limit = TREND_SAMPLES) {}

  push(value: number): void {
    if (!Number.isFinite(value)) return;
    this.values.push(value);
    if (this.values.length > this.limit) this.values.shift();
  }

  /** Enough samples to be a line rather than a rumour. */
  get ready(): boolean {
    return this.values.length >= 4;
  }

  get series(): number[] {
    return this.values;
  }

  get last(): number | null {
    return this.values.length ? this.values[this.values.length - 1] : null;
  }

  /** Change over the window, in the value's own units. */
  get delta(): number {
    if (this.values.length < 2) return 0;
    return this.values[this.values.length - 1] - this.values[0];
  }

  clear(): void {
    this.values.length = 0;
  }
}

export const speedTrend = new Trend();
export const windTrend = new Trend();

let last = 0;

/**
 * Sample on data changes, not on a timer: the GPS decides the rate, and a timer
 * would keep the app awake on a moored boat to record the same number sixty
 * times a minute.
 */
export function recordTrends(): void {
  const data = dataBus.get();
  if (!data.fix.valid || data.timestamp === last) return;
  last = data.timestamp;

  if (data.fix.sogKnots !== null) speedTrend.push(data.fix.sogKnots);
  if (data.weather.valid) {
    const solution = solveWind(
      data.weather.windDirection,
      data.weather.windSpeedKnots,
      data.fix.cogDeg,
      data.fix.sogKnots
    );
    windTrend.push(solution.valid ? solution.aws : solution.tws);
  }
}

export function clearTrends(): void {
  speedTrend.clear();
  windTrend.clear();
}
