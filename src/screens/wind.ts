import {
  bottom, centerX, centerY, column, gray as G, grow, keyValue, right, row,
  section, segmentedBar, space as S
} from "@gabrielevierti/glyph";
import type { Rect, RenderContext, Screen } from "@gabrielevierti/glyph";

import { dataBus } from "../dataBus";
import { beaufort, fixed, pad3, relative } from "../format";
import { compassPoint } from "../navigation";
import { pointOfSail, solveWind } from "../wind";
import { windTrend } from "../trend";
import { chrome, footer, notice, requireFix } from "../ui/chrome";
import { boatDial, dialLegend, trendLine } from "../ui/instruments";
import { hero } from "./navigation";

/**
 * Wind, boat-relative.
 *
 * The dial carries two arrows: filled for apparent, hollow for true. The gap
 * between them is the breeze your own boat is making — the one thing a masthead
 * unit shows you and a forecast does not — so it is the point of the screen and
 * it gets the whole left tile.
 */

/** Close-hauled is roughly 30° off the true wind; inside that you are in irons. */
const NO_GO = 32;

export const windScreen: Screen = {
  name: "Wind",

  render(ctx: RenderContext) {
    const { g } = ctx;
    const data = dataBus.get();
    const { body, footer: footerRect } = chrome(ctx, "WIND", data);
    if (!requireFix(g, body, data)) {
      // Even a gated screen keeps its footer: the page dots are how you know
      // the app is still running and which of four screens you are looking at.
      footer(ctx, footerRect, data);
      return;
    }

    const { fix, weather } = data;

    if (!weather.valid) {
      notice(g, body, "wind", "Waiting for forecast",
        "True wind comes from the marine forecast for your position.");
      footer(ctx, footerRect, data);
      return;
    }

    const wind = solveWind(weather.windDirection, weather.windSpeedKnots, fix.cogDeg, fix.sogKnots);

    // The dial sits entirely left of the x=288 seam, so it never dirties the
    // panels on the right when the wind shifts.
    const [dialCol, panels] = row(body, [{ size: 170 }, { size: grow(1) }], { gap: S.md });
    const [dialBox, legendBox] = column(dialCol, [{ size: grow(1) }, { size: 14 }], { gap: S.xs });

    boatDial(g, centerX(dialBox), centerY(dialBox), 76, {
      arrows: wind.valid
        ? [
            { angle: wind.awa, gray: G.max },
            { angle: wind.twa, gray: G.secondary, hollow: true }
          ]
        : [],
      sweepTo: wind.valid ? wind.twa : undefined,
      noGo: NO_GO,
      caption: wind.valid ? "TWA" : "TRUE WIND FROM",
      value: wind.valid ? relative(wind.twa) : `${pad3(weather.windDirection)}°`,
      unit: wind.valid ? pointOfSail(wind.twa) : "NO COURSE"
    });
    dialLegend(g, legendBox, [{ label: "APPARENT" }, { label: "TRUE", hollow: true }]);

    // ── True and apparent, side by side. The gap between the two panels lands
    // on the x=384 tile seam, so they update independently.
    const [truePanel, apparentPanel] = row(panels, [{ size: grow(1) }, { size: grow(1) }], { gap: S.md });

    const trueBox = section(g, truePanel, "True wind", { accessory: `BF ${beaufort(wind.tws)}` });
    const [trueValue, trueScale, trueRows] = column(
      trueBox, [{ size: 48 }, { size: 7 }, { size: grow(1) }], { gap: S.sm }
    );
    hero(g, trueValue, fixed(wind.tws, 1), "kn", 38);
    rule(g, trueValue);
    segmentedBar(g, trueScale, 12, beaufort(wind.tws), { fill: G.strong });
    const [fromRow, gustRow] = column(trueRows, [{ size: grow(1) }, { size: grow(1) }]);
    keyValue(g, fromRow, "From", `${pad3(weather.windDirection)}° ${compassPoint(weather.windDirection)}`);
    keyValue(g, gustRow, "Gust", `${fixed(weather.windGustKnots, 1)} kn`);

    const apparentBox = section(g, apparentPanel, "Apparent", {
      accessory: wind.valid ? "SOLVED" : "NO COURSE"
    });
    const [apparentValue, apparentTrend, apparentRows] = column(
      apparentBox, [{ size: 48 }, { size: 20 }, { size: grow(1) }], { gap: S.sm }
    );
    hero(g, apparentValue, wind.valid ? fixed(wind.aws, 1) : "—", "kn", 38);
    rule(g, apparentValue);
    trendLine(g, apparentTrend, windTrend.series, { gray: G.strong });
    const [awaRow, vmgRow] = column(apparentRows, [{ size: grow(1) }, { size: grow(1) }]);
    keyValue(g, awaRow, "AWA", wind.valid ? relative(wind.awa) : "—", { gray: G.max });
    // Velocity made good to windward: how much of your speed is going where the
    // wind is coming from. Negative means you are sailing away from it.
    keyValue(g, vmgRow, "VMG", wind.valid && fix.sogKnots !== null
      ? `${fixed(fix.sogKnots * Math.cos((wind.twa * Math.PI) / 180), 1)} kn`
      : "—");

    footer(ctx, footerRect, data,
      wind.valid ? undefined : "APPARENT WIND NEEDS A COURSE OVER GROUND");
  }
};

/** Hairline under a hero readout, so the panel reads as two zones not one. */
function rule(g: RenderContext["g"], box: Rect): void {
  g.hline(box.x, right(box), bottom(box) + 3, G.hairline);
}
