# SeaState

A marine conditions HUD for [Even Realities G2](https://www.evenrealities.com) smart
glasses. Speed, course, wind, sea state and weather — on the lens, hands free,
with **no instruments, no gateway and no boat wiring**. Everything comes from the
phone's GPS and a public marine forecast, so it works the moment it is installed.

Drawn with [Glyph](https://github.com/gabrielevierti/glyph).

![The four screens](docs/screens.png)

## What changed in v2

The first version hand-rolled its own rasterizer — a supersampled canvas, a 5×7
bitmap font, seven-segment numerals, a palette — and drew into **one 288×144
image container centred on the display**. A quarter of the panel, because
managing four containers by hand was more than the app was worth.

Glyph makes the whole surface cheap. v2 draws a full 576×288 framebuffer, four
tiles, and only ships the tiles that changed. That deleted about 900 lines of
graphics code (`src/gfx/`, `hud/chrome.ts`, `hud/dial.ts`) and bought four times
the area to design in.

What survived untouched is the part that was never about pixels: `models.ts`,
`dataBus.ts`, `navigation.ts`, `wind.ts` and `sources/`. The apparent-wind
solver is the same solver.

| | v1 | v2 |
| --- | --- | --- |
| Surface | 288×144, one container | 576×288, four tiles |
| Graphics | ~900 lines, in this repo | `@gabrielevierti/glyph` |
| Transport | one full frame per change | changed tiles only |
| Night mode | second palette | one brightness scalar at resolve |
| Ink (outline) | not measured | 3.1–4.1% per screen |

## Screens

| Screen | Shows |
| --- | --- |
| **Navigation** | Speed over ground with its trend, compass rose with the wind on it, a compact apparent-wind dial, true wind and gusts, and enough of the sea to know whether to go and look at the sea screen |
| **Wind** | Apparent and true on one boat-relative dial, with the no-go zone marked; true wind speed and Beaufort force, direction, gusts, apparent wind angle and VMG to windward |
| **Sea state** | Significant wave height with the Douglas scale, the sea drawn in profile at its real steepness, period, swell, sea temperature, and which side it is running from |
| **Weather** | Air temperature, wind with Beaufort, time to the next rain, and twelve hours of rain probability as a chart |

**Tap** advances a screen, **swipe up** goes back, **swipe down** toggles night
mode, **double tap** exits. Night mode also engages automatically outside
daylight hours.

Every failure mode is a designed screen, not a row of dashes: location denied,
no fix yet, no wave model here, no forecast yet. They keep their status bar and
their page dots, so the app never looks like it has crashed.

## Apparent wind without a masthead unit

The forecast gives true wind. Your GPS gives course and speed. Apparent wind is
the vector sum of the two — so `src/wind.ts` solves it, and the dial shows both:
a filled arrow for apparent, hollow for true. The gap between them is the breeze
your own boat is making.

That also yields true wind angle, point of sail and VMG without a single sensor
on the mast. It assumes no current and is only as good as the forecast, so treat
it as situational awareness rather than instrumentation — but for deciding
whether to bear away it beats a bare wind direction in degrees.

## Design notes

**The columns are 170 / 192 / 170.** Not taste: with 8px gaps that puts the
middle column exactly on the middle tile of Glyph's `TILE_CHROME` layout
(576×32 strip + three 192×256 panels). The compass rose is the only thing on the
navigation screen that turns continuously, so it turns inside one image
container and the panels either side are never resent because of it. Glyph's own
`npm run tiles` measurement had this shape cheapest for this design; lining the
seams up with the layout is what makes that true rather than lucky.

**Outline, not filled.** Every lit pixel is a pixel of the sea you cannot see
through. Panels are a hairline and their contents; nothing is a filled card.
`npm test` asserts it: 3–4% ink per screen against Glyph's 18% budget. The
`filled` style still exists — it is what the screenshots above are *not* drawn
in, deliberately.

**Night mode is `app.brightness`.** One scalar applied once at resolve, so the
whole design dims together and no component knows about it. It is only written
when it actually changes, because the setter forces a full four-tile repaint.

**Nothing is `animated`.** The paint loop idles until a fix, a forecast or the
minute hand asks for a frame. A moored boat with a fresh forecast costs one tile
every thirty seconds — the clock.

**Trends, not just instants.** `src/trend.ts` keeps a few minutes of speed and
apparent wind in two ring buffers. One number cannot tell you whether the breeze
is building; a sparkline can, for a few hundred bytes.

**The sea profile is drawn from the numbers.** Wavelength comes from the period
(deep water, λ = 1.56 T²), so the steepness on the lens is the steepness on the
water. A 1.5 m six-second chop and a 1.5 m twelve-second swell are the same
number and a completely different day.

## Quick start

```bash
npm install
npm run dev
```

Open <http://localhost:5173>. With no Even Hub bridge present the app mounts a
preview that paints the same framebuffer the glasses get, at the same 16 levels,
scaled with nearest-neighbour so you are looking at real pixels. `←` `→` page,
`1`–`4` jump, `N` toggles night, `S` switches surface style.

A browser tab has no boat, so copy `.env.example` to `.env` to run on synthetic
conditions:

```
VITE_DEMO=1
```

The demo source is dev-only and unreachable in a packaged build.

```bash
npm run sim        # preview inside the Even simulator instead
npm test           # ink, contrast, safe area, and nothing throwing
npm run snapshot   # re-render docs/screens/*.png
npm run font       # build the bitmap font atlas
```

### The font atlas

`public/fonts/` is empty in the repo. Without an atlas Glyph measures and
rasterizes text with whatever fonts the host has, which is fine in a browser and
unpinned on device. `npm run font` renders every screen in every state with a
style observer attached, collects the exact set of faces the app asks for —
including the one-off sizes `fitStyle` lands on — and packs them into
`public/fonts/inter.json`. Commit the result and the text is identical
everywhere.

Note that the tool prints which family the browser *says* it resolved, and a
computed `font-family` is the specified list rather than the used font — so a
silent substitution on a machine without Inter installed will not be reported.
Check the atlas visually the first time you build it.

## Input and lifecycle

SeaState decodes the Even Hub event stream itself, in `src/hub.ts`, rather than
using `GlyphRuntime.onInput`. Two reasons, both about review:

- The runtime folds every unrecognised system event into a tap, and the
  lifecycle codes (4–7) are unrecognised — so a foreground-enter would page the
  screen forward when the wearer unlocks their phone.
- A root page must call `shutDownPageContainer(1)` on double tap. The runtime
  keeps its bridge private, so an app that only talks to Glyph cannot exit
  correctly.

Glyph still owns the transport. It is a rendering framework, and this is the
part that is not rendering.

## Packaging and shipping

```bash
npm run pack          # builds, then produces dist/seastate.ehpk
npm run pack:check    # validates the manifest and package_id availability
```

Then upload the `.ehpk` through the [dev portal](https://hub.evenrealities.com),
push it to your self-test group, and install it from **Me → Beta tester** in the
Even Realities App.

### Test location on a real install, not via QR

QR sideloading does **not** grant location to the WebView — `watchPosition` fails
with `PERMISSION_DENIED` and you will see the "Location is off" screen no matter
what you do. Only a Hub-installed build (private, beta or released) gets a
position fix. Budget for this: the entire app is downstream of the GPS.

### Submission checklist

- Root-page double tap calls `shutDownPageContainer(1)`. Using `0` or a custom
  in-app exit is auto-rejected.
- Lifecycle is handled in `src/hub.ts`: pause on `FOREGROUND_EXIT` (5), resume
  on `FOREGROUND_ENTER` (4), tear down on `ABNORMAL_EXIT` (6) and `SYSTEM_EXIT`
  (7). Suspending stops the GPS watch and the forecast poll, so a backgrounded
  app is not draining battery.
- Reviewers open the app, lock the phone for five minutes, and unlock. It should
  come back where you left it.
- Reviewers also deny location and see what happens. That path is the "Location
  is off" screen.
- No emergency-routing or safety-critical framing anywhere. SeaState reports
  conditions; it is not a navigation or collision-avoidance aid, and it
  deliberately has no depth alarm.

## Networking

Two independent gates sit in front of every request: the `app.json` whitelist,
and ordinary CORS. The whitelist takes **full origins only — no wildcards, no
bare hostnames**:

```json
"whitelist": ["https://api.open-meteo.com", "https://marine-api.open-meteo.com"]
```

This is why the app cannot talk to your own boat's NMEA gateway or Signal K
server. Those live on a LAN address that differs for every user and cannot be
whitelisted ahead of time, and plain `http://` is not usable in production. If
you ever want instrument support, the only workable routes are shipping a fixed
list of well-known default gateway origins, or relaying through one server you
control.

Open-Meteo needs no API key and sets permissive CORS.

## Project layout

```
src/
  config.ts          tunables: rates, timings, lifecycle codes, brightness
  models.ts          Fix, Weather, Sea -> Conditions
  dataBus.ts         tiny observable store
  navigation.ts      bearings, distances, unit conversions
  wind.ts            apparent-wind solver and point of sail
  format.ts          how numbers become strings, once
  trend.ts           ring buffers behind the sparklines
  session.ts         night, demo, bridged
  sources/
    geolocation.ts   navigator.geolocation -> Fix
    forecast.ts      Open-Meteo weather + marine
    demo.ts          synthetic conditions, dev only
  hub.ts             Even Hub bridge: input, lifecycle, exit
  app.ts             Glyph app + runtime, input routing, night mode
  ui/
    chrome.ts        status bar, footer, the gated states
    instruments.ts   boat-relative dial, hull, wave profile, trend line
  screens/           one module per screen
  preview.ts         browser-only preview
tools/
  check.mjs          ink, contrast, safe area
  snapshot.mjs       reference screens
  build-font.mjs     bitmap atlas
```

## Licence

MIT. See [LICENSE](LICENSE).
