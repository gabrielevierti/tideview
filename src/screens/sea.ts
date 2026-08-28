import {
  bottom, centerX, centerY, column, gray as G, grow, keyValue, right, row,
  section, segmentedBar, space as S, type as T
} from "@gabrielevierti/glyph";
import type { RenderContext, Screen } from "@gabrielevierti/glyph";

import { dataBus } from "../dataBus";
import { douglas, fixed } from "../format";
import { signedAngle } from "../navigation";
import { chrome, footer, notice, requireFix } from "../ui/chrome";
import { boatDial, dialLegend, waveProfile } from "../ui/instruments";

/**
 * Sea state.
 *
 * Height alone is a poor description of a sea: 1.5 m at six seconds is a short
 * steep chop and 1.5 m at twelve is a long swell you barely notice. So the
 * height gets the Douglas name beside it, the profile draws both at their real
 * steepness, and the dial says which side it is running from.
 */

export const seaScreen: Screen = {
  name: "Sea state",

  render(ctx: RenderContext) {
    const { g } = ctx;
    const data = dataBus.get();
    const { body, footer: footerRect } = chrome(ctx, "SEA STATE", data);
    if (!requireFix(g, body, data)) {
      // Even a gated screen keeps its footer: the page dots are how you know
      // the app is still running and which of four screens you are looking at.
      footer(ctx, footerRect, data);
      return;
    }

    const { sea, fix } = data;

    if (!sea.valid) {
      notice(g, body, "waves", "No sea state here",
        "The wave model does not cover inland and sheltered waters.");
      footer(ctx, footerRect, data);
      return;
    }

    // Wave directions are "travelling towards", so +180 gives the side it is
    // running from, and subtracting the course puts it relative to the bow.
    const course = fix.cogDeg ?? 0;
    const waveFrom = signedAngle(sea.waveDirection + 180 - course);
    const swellFrom = signedAngle(sea.swellDirection + 180 - course);
    const scale = douglas(sea.waveHeightM);

    const [left, centre, rail] = row(
      body, [{ size: 170 }, { size: grow(1) }, { size: 170 }], { gap: S.sm }
    );

    // ── Significant wave height ──────────────────────────────────────────
    const [heightBox, profileBox] = column(left, [{ size: grow(1) }, { size: grow(1) }], { gap: S.sm });

    const height = section(g, heightBox, "Wave", { accessory: "SIGNIFICANT" });
    const [value, name, degree] = column(
      height, [{ size: grow(1) }, { size: 14 }, { size: 8 }], { gap: S.xs }
    );
    const style = { ...T.numeralXl, size: 42 };
    g.text(fixed(sea.waveHeightM, 1), value.x, bottom(value), style, G.max, "left", "bottom");
    g.text("m", value.x + g.measure(fixed(sea.waveHeightM, 1), style) + 5, bottom(value) - 3,
      T.body, G.tertiary, "left", "bottom");
    g.text(scale.name, name.x, centerY(name), T.label, G.secondary, "left", "middle");
    g.text(`DOUGLAS ${scale.degree}`, right(name), centerY(name), T.micro, G.tertiary, "right", "middle");
    segmentedBar(g, degree, 9, scale.degree + 1, { fill: G.strong });

    // ── The sea in profile, at its real steepness ────────────────────────
    const profile = section(g, profileBox, "Profile", {
      accessory: `λ ${Math.round(1.56 * sea.wavePeriodS ** 2)}m`
    });
    waveProfile(g, profile,
      { height: sea.waveHeightM, period: sea.wavePeriodS },
      sea.swellHeightM > 0 ? { height: sea.swellHeightM, period: sea.swellPeriodS } : undefined);

    // ── Which side it is running from ────────────────────────────────────
    boatDial(g, centerX(centre), centre.y + 96, 80, {
      arrows: [
        { angle: waveFrom, gray: G.max },
        { angle: swellFrom, gray: G.secondary, hollow: true }
      ],
      sweepTo: waveFrom,
      caption: "SEA FROM",
      value: `${Math.abs(Math.round(waveFrom))}°`,
      unit: waveFrom >= 0 ? "STARBOARD" : "PORT"
    });
    dialLegend(g, { x: centre.x + 26, y: bottom(centre) - 30, width: centre.width - 52, height: 14 },
      [{ label: "SEA" }, { label: "SWELL", hollow: true }]);
    g.text(
      fix.cogDeg === null ? "RELATIVE TO NORTH — NO COURSE" : "RELATIVE TO THE BOW",
      centerX(centre), bottom(centre) - 2, T.micro,
      fix.cogDeg === null ? G.disabled : G.tertiary, "center", "bottom"
    );

    // ── The rest of it ───────────────────────────────────────────────────
    const detail = section(g, rail, "Detail");
    const rows = column(detail, [
      { size: grow(1) }, { size: grow(1) }, { size: grow(1) }, { size: grow(1) }, { size: grow(1) }
    ]);
    keyValue(g, rows[0], "Period", `${fixed(sea.wavePeriodS, 1)} s`);
    keyValue(g, rows[1], "Swell", `${fixed(sea.swellHeightM, 1)} m`);
    keyValue(g, rows[2], "Swell per.", `${fixed(sea.swellPeriodS, 1)} s`);
    keyValue(g, rows[3], "Sea temp",
      sea.seaTemperatureC === null ? "—" : `${Math.round(sea.seaTemperatureC)}°C`);
    keyValue(g, rows[4], "Steepness", steepness(sea.waveHeightM, sea.wavePeriodS), { gray: G.max });

    footer(ctx, footerRect, data);
  }
};

/**
 * Height over wavelength, named. Anything past about 1:14 is where a sea stops
 * being uncomfortable and starts being work.
 */
function steepness(heightM: number, periodS: number): string {
  if (!(periodS > 0)) return "—";
  const wavelength = 1.56 * periodS * periodS;
  const ratio = wavelength / heightM;
  if (!Number.isFinite(ratio)) return "—";
  return ratio < 14 ? `1:${Math.round(ratio)} STEEP` : `1:${Math.round(ratio)}`;
}
