import {
  barChart, bottom, centerY, column, gray as G, grow, row, section, segmentedBar,
  space as S, type as T
} from "@gabrielevierti/glyph";
import type { GlyphIconName, RenderContext, Screen } from "@gabrielevierti/glyph";

import { dataBus } from "../dataBus";
import { beaufort, duration, fixed } from "../format";
import { isNight } from "../session";
import { chrome, footer, notice, requireFix } from "../ui/chrome";
import type { Weather } from "../models";

/**
 * Weather.
 *
 * Three readouts and one chart. The chart is the reason the screen exists: a
 * single "next rain" number tells you when, and the twelve bars tell you
 * whether it is a shower to sit out or the afternoon closing in.
 */

const GUTTER = 26;
const BAR_GAP = 4;

function conditionIcon(weather: Weather): GlyphIconName {
  if (weather.precipitation > 0.1) return "cloud-rain";
  if ((weather.hourlyProbability[0] ?? 0) >= 60) return "cloud";
  return isNight() ? "moon" : "sun";
}

export const weatherScreen: Screen = {
  name: "Weather",

  render(ctx: RenderContext) {
    const { g } = ctx;
    const data = dataBus.get();
    const { body, footer: footerRect } = chrome(ctx, "WEATHER", data);
    if (!requireFix(g, body, data)) {
      // Even a gated screen keeps its footer: the page dots are how you know
      // the app is still running and which of four screens you are looking at.
      footer(ctx, footerRect, data);
      return;
    }

    const weather = data.weather;
    if (!weather.valid) {
      notice(g, body, "cloud", "Waiting for forecast", "Fetching conditions for your position.");
      footer(ctx, footerRect, data);
      return;
    }

    const [top, chart] = column(body, [{ size: 96 }, { size: grow(1) }], { gap: S.sm });
    const [airBox, windBox, rainBox] = row(
      top, [{ size: grow(1) }, { size: grow(1) }, { size: grow(1) }], { gap: S.sm }
    );

    // ── Air ──────────────────────────────────────────────────────────────
    const air = section(g, airBox, "Air", { icon: conditionIcon(weather) });
    reading(ctx, air, String(Math.round(weather.temperatureC)), "°C");

    // ── Wind ─────────────────────────────────────────────────────────────
    const wind = section(g, windBox, "Wind", { accessory: `BF ${beaufort(weather.windSpeedKnots)}` });
    const [windValue, windScale] = column(wind, [{ size: grow(1) }, { size: 7 }], { gap: S.xs });
    reading(ctx, windValue, fixed(weather.windSpeedKnots, 0), "kn",
      `GUST ${Math.round(weather.windGustKnots)}`);
    segmentedBar(g, windScale, 12, beaufort(weather.windSpeedKnots), { fill: G.strong });

    // ── Next rain ────────────────────────────────────────────────────────
    const rain = section(g, rainBox, "Next rain", { icon: "umbrella" });
    if (weather.nextRainMinutes === null) {
      g.text("NONE", rain.x, centerY(rain) - 2, { ...T.displaySm, size: 30 }, G.max, "left", "middle");
      g.text("IN THE FORECAST WINDOW", rain.x, bottom(rain), T.micro, G.tertiary, "left", "bottom");
    } else {
      const [amount, unit] = duration(weather.nextRainMinutes).split(" ");
      reading(ctx, rain, amount, unit === "min" ? "min" : "h",
        `PEAK ${Math.max(0, ...weather.hourlyProbability)}%`);
    }

    // ── Twelve hours of rain probability ─────────────────────────────────
    const strip = section(g, chart, "Rain probability", { accessory: "NEXT 12 H" });
    const [plot, labels] = column(strip, [{ size: grow(1) }, { size: 11 }], { gap: S.xs });

    const values = Array.from({ length: 12 }, (_, i) => weather.hourlyProbability[i] ?? 0);
    const peak = values.indexOf(Math.max(...values));

    barChart(g, plot, values, {
      min: 0,
      max: 100,
      gridLines: 3,
      gutter: GUTTER,
      gap: BAR_GAP,
      format: (v) => `${Math.round(v)}%`,
      baseline: true,
      highlight: peak,
      highlightGray: G.max
    });

    // Hour labels, placed on the bars rather than spread across the axis:
    // twelve evenly-spaced ticks and twelve bar centres are not the same
    // positions, and the eye notices the drift long before it works out why.
    const plotX = plot.x + GUTTER;
    const barWidth = (plot.width - GUTTER - BAR_GAP * (values.length - 1)) / values.length;
    const startHour = new Date().getHours();
    values.forEach((_, i) => {
      if (i % 2 !== 0) return;
      const cx = plotX + i * (barWidth + BAR_GAP) + barWidth / 2;
      const hour = String((startHour + i + 1) % 24).padStart(2, "0");
      g.text(hour, cx, centerY(labels), T.micro, i === peak ? G.secondary : G.disabled, "center", "middle");
    });

    footer(ctx, footerRect, data);
  }
};

/** One number, its unit, and an optional line of small print under it. */
function reading(
  ctx: RenderContext,
  box: { x: number; y: number; width: number; height: number },
  value: string, unit: string, note?: string
): void {
  const { g } = ctx;
  const style = { ...T.numeralXl, size: 34 };
  const baseline = note ? bottom(box) - 13 : centerY(box) + 12;
  g.text(value, box.x, baseline, style, G.max, "left", "bottom");
  g.text(unit, box.x + g.measure(value, style) + 4, baseline - 2, T.body, G.tertiary, "left", "bottom");
  if (note) g.text(note, box.x, bottom(box), T.micro, G.tertiary, "left", "bottom");
}

