import {
  bottom, centerX, column, compassRose, gray as G, grow, keyValue, right, row,
  section, space as S, type as T
} from "@gabrielevierti/glyph";
import type { Rect, RenderContext, Screen } from "@gabrielevierti/glyph";

import { dataBus } from "../dataBus";
import { douglas, fixed, pad3, relative } from "../format";
import { compassPoint } from "../navigation";
import { pointOfSail, solveWind } from "../wind";
import { speedTrend } from "../trend";
import { chrome, footer, requireFix } from "../ui/chrome";
import { boatDial, trendLine } from "../ui/instruments";

/**
 * The screen you sail on: how fast, which way, what the breeze is doing, and
 * what the sea under it is doing.
 *
 * Three columns of 170 / 192 / 170. The tile seams sit at x=288 and y=144, so
 * the two side panels each live in their own column of quadrants and only the
 * compass — dead centre, and therefore across all four — costs a full repaint
 * when it turns. It turns when the course changes, which on a boat is about
 * once a second at worst, not twenty times.
 */

function rainNote(nextRainMinutes: number | null, valid: boolean): string {
  if (!valid) return "FORECAST PENDING";
  if (nextRainMinutes === null) return "NO RAIN IN THE WINDOW";
  if (nextRainMinutes < 60) return `RAIN IN ${Math.round(nextRainMinutes)} MIN`;
  return `RAIN IN ${Math.round(nextRainMinutes / 60)} H`;
}

export const navigationScreen: Screen = {
  name: "Navigation",

  render(ctx: RenderContext) {
    const { g } = ctx;
    const data = dataBus.get();
    const { body, footer: footerRect } = chrome(ctx, "NAVIGATION", data);
    if (!requireFix(g, body, data)) {
      // Even a gated screen keeps its footer: the page dots are how you know
      // the app is still running and which of four screens you are looking at.
      footer(ctx, footerRect, data);
      return;
    }

    const { fix, weather, sea } = data;
    const wind = solveWind(weather.windDirection, weather.windSpeedKnots, fix.cogDeg, fix.sogKnots);

    const [left, centre, rail] = row(
      body, [{ size: 170 }, { size: grow(1) }, { size: 170 }], { gap: S.sm }
    );

    // ── Speed over ground ────────────────────────────────────────────────
    const [speedBox, seaBox] = column(left, [{ size: grow(1.25) }, { size: grow(1) }], { gap: S.sm });

    const speed = section(g, speedBox, "Speed", { accessory: "SOG" });
    const [speedValue, speedTrendBox] = column(speed, [{ size: grow(1) }, { size: 20 }], { gap: S.xs });
    hero(g, speedValue, fixed(fix.sogKnots, 1), "kn", 44);
    trendLine(g, speedTrendBox, speedTrend.series, { gray: G.strong });

    // ── Sea, in one line. Not the sea screen — just enough of it that you
    // know whether to go and look at the sea screen.
    const seaPanel = section(g, seaBox, "Sea", {
      accessory: sea.valid ? douglas(sea.waveHeightM).name : ""
    });
    if (sea.valid) {
      g.text(fixed(sea.waveHeightM, 1), seaPanel.x, bottom(seaPanel) - 16,
        T.numeralLg, G.max, "left", "bottom");
      g.text("m", seaPanel.x + g.measure(fixed(sea.waveHeightM, 1), T.numeralLg) + 4,
        bottom(seaPanel) - 17, T.caption, G.tertiary, "left", "bottom");
      g.text(`${fixed(sea.wavePeriodS, 0)} S`, right(seaPanel), bottom(seaPanel) - 17,
        T.numeral, G.secondary, "right", "bottom");
      g.text("PERIOD", right(seaPanel), bottom(seaPanel), T.micro, G.tertiary, "right", "bottom");
      g.text("SIGNIFICANT", seaPanel.x, bottom(seaPanel), T.micro, G.tertiary, "left", "bottom");
    } else {
      g.text("NO WAVE MODEL", seaPanel.x, bottom(seaPanel) - 6, T.body, G.disabled, "left", "bottom");
      g.text("INLAND OR SHELTERED", seaPanel.x, bottom(seaPanel) + 8, T.micro, G.disabled, "left", "bottom");
    }

    // ── Compass ──────────────────────────────────────────────────────────
    // No pointer label: at this radius Glyph puts it where a cardinal letter
    // already is, and the wind direction is spelled out underneath anyway.
    compassRose(g, centerX(centre), centre.y + 92, 84, fix.cogDeg ?? 0, {
      pointer: weather.valid ? weather.windDirection : undefined,
      showValue: fix.cogDeg !== null
    });
    if (fix.cogDeg === null) {
      g.text("NO COURSE", centerX(centre), centre.y + 92, T.title, G.disabled, "center", "middle");
    }
    g.text(
      fix.cogDeg === null ? "STOPPED" : `COG ${compassPoint(fix.cogDeg)}`,
      centerX(centre), centre.y + 186, T.label, G.secondary, "center", "middle"
    );
    g.text(
      weather.valid ? `WIND FROM ${pad3(weather.windDirection)}° ${compassPoint(weather.windDirection)}` : "",
      centerX(centre), centre.y + 202, T.micro, G.tertiary, "center", "middle"
    );

    // ── Wind ─────────────────────────────────────────────────────────────
    const [dialBox, rowsBox] = column(rail, [{ size: grow(1.4) }, { size: grow(1) }], { gap: S.sm });

    const windPanel = section(g, dialBox, "Wind", { accessory: wind.valid ? "AWS KN" : "TWS KN" });
    boatDial(g, centerX(windPanel), windPanel.y + 36, 33, {
      arrows: wind.valid
        ? [{ angle: wind.awa, gray: G.max }, { angle: wind.twa, gray: G.secondary, hollow: true }]
        : [],
      sweepTo: wind.valid ? wind.awa : undefined,
      labels: false,
      value: weather.valid ? fixed(wind.valid ? wind.aws : wind.tws, 0) : "--"
    });
    g.text(
      wind.valid ? pointOfSail(wind.twa) : "NO COURSE",
      centerX(windPanel), bottom(windPanel), T.micro,
      wind.valid ? G.tertiary : G.disabled, "center", "bottom"
    );

    const rows = section(g, rowsBox, "True wind");
    const [twsRow, gustRow, angleRow] = column(rows, [{ size: grow(1) }, { size: grow(1) }, { size: grow(1) }]);
    keyValue(g, twsRow, "TWS", weather.valid ? `${fixed(weather.windSpeedKnots, 1)} kn` : "—");
    keyValue(g, gustRow, "Gust", weather.valid ? `${fixed(weather.windGustKnots, 0)} kn` : "—");
    keyValue(g, angleRow, "TWA", wind.valid ? relative(wind.twa) : "—", { gray: G.max });

    footer(ctx, footerRect, data, rainNote(weather.nextRainMinutes, weather.valid));
  }
};

/** A value with its unit riding the same baseline, and a rule under both. */
export function hero(
  g: RenderContext["g"], box: Rect, value: string, unit: string, size: number
): void {
  const style = { ...T.numeralXl, size };
  const baseline = bottom(box);
  g.text(value, box.x, baseline, style, G.max, "left", "bottom");
  g.text(unit, box.x + g.measure(value, style) + 5, baseline - 4, T.body, G.tertiary, "left", "bottom");
}
