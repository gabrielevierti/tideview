A marine conditions HUD for [Even Realities G2](https://www.evenrealities.com) smart
glasses. Speed, course, wind, sea state and weather — on the lens, hands free,
with **no instruments, no gateway and no boat wiring**. Everything comes from the
phone's GPS and a public marine forecast, so it works the moment it is installed.

![The four screens](docs/screens.png)

## Screens

| Screen | Shows |
| --- | --- |
| **Navigation** | Speed over ground, course with compass point, apparent wind dial, true wind and gusts, next rain |
| **Wind** | Apparent and true wind on one boat-relative dial, true wind speed and bearing, gusts, true wind angle, point of sail |
| **Sea state** | Significant wave height with the Douglas scale, period, swell, sea temperature, and which side the sea is running from |
| **Weather** | Air temperature, wind, time to next rain, 12-hour rain probability |

**Tap** advances a screen, **swipe up** goes back, **swipe down** toggles night
mode, **double tap** exits. Night mode also engages automatically outside
daylight hours.

## Apparent wind without a masthead unit

The forecast gives true wind. Your GPS gives course and speed. Apparent wind is
just the vector sum of the two — so `src/wind.ts` solves it, and the dial shows
both: a filled arrow for apparent, hollow for true. The gap between them is the
breeze your own boat is making.

That also yields true wind angle and point of sail (close hauled, beam reach,
running) without a single sensor on the mast. It assumes no current and is only
as good as the forecast, so treat it as situational awareness rather than
instrumentation — but for deciding whether to bear away it beats a bare wind
direction in degrees.

## Quick start

```bash
npm install
npm run dev
```

Open <http://localhost:5173>. With no Even Hub bridge present the app mounts a
built-in preview that renders the exact same frames to a canvas, with arrow keys
for switching screens and `N` for night mode.

A browser tab has no boat, so copy `.env.example` to `.env` to run the preview on
synthetic conditions:

```
VITE_DEMO=1
```

The demo source is dev-only and unreachable in a packaged build.

To preview inside the Even simulator instead:

```bash
npm run sim
```

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

![Degraded states](docs/states.png)

Every state above is a designed screen, not a crash — moored with no course,
inland with no wave model, and location denied.

### Submission checklist

- Root-page double tap calls `shutDownPageContainer(1)`, which is required; using
  `0` or a custom in-app exit is auto-rejected.
- Lifecycle events are handled in `src/g2.ts`: pause on `FOREGROUND_EXIT` (5),
  resume on `FOREGROUND_ENTER` (4), tear down on `ABNORMAL_EXIT` (6) and
  `SYSTEM_EXIT` (7). Suspending stops the GPS watch and the forecast poll, so a
  backgrounded app is not draining battery.
- Reviewers open the app, lock the phone for five minutes, and unlock. It should
  come back where you left it.
- Reviewers also deny the location permission and see what happens. That path is
  the "Location is off" screen.
- No emergency-routing or safety-critical framing anywhere. SeaState reports
  conditions; it is not a navigation or collision-avoidance aid, and the app
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
  config.ts          tunables: sizes, timings, lifecycle codes, wire format
  models.ts          Fix, Weather, Sea -> Conditions
  dataBus.ts         tiny observable store
  navigation.ts      bearings, distances, unit conversions
  wind.ts            apparent-wind solver and point of sail
  sources/
    geolocation.ts   navigator.geolocation -> Fix
    forecast.ts      Open-Meteo weather + marine
    demo.ts          synthetic conditions, dev only
  g2.ts              Even Hub containers, input, lifecycle, frame loop
  preview.ts         browser-only canvas preview
  gfx/               canvas, font, seven-segment digits, palette, encoders
  hud/               one module per screen, plus shared chrome and dial
```

## Rendering

`src/gfx/canvas.ts` draws into a buffer three times larger than the output in
each axis and box-filters it down in `toGray4()`. That gives anti-aliasing on
every primitive for free — arcs, dial ticks and segment corners come out smooth
across the panel's 16 grey levels — while axis-aligned rectangles and bitmap
glyphs land on exact multiples of the supersampling factor and stay crisp.

Text is a proportional 5×7 bitmap font with blank columns trimmed per glyph.
Primary readouts use seven-segment numerals with faint unlit segments, because
scaling a bitmap font to 36 px looks like a spreadsheet and segmented digits read
faster at a glance.

`src/g2.ts` runs a fixed-rate loop rather than a promise chain. Updates set a
dirty flag; the loop renders at most one frame per `MIN_FRAME_INTERVAL_MS` and
compares it byte-for-byte against the last frame sent, so an identical frame is
never pushed and a stalled link drops frames instead of queueing them.

## Known unknowns

The exact wire format `updateImageRawData` expects is not pinned down by the SDK
docs. `IMAGE_ENCODING` in `src/config.ts` switches between one byte per pixel and
true 4bpp packing. If the HUD renders as noise or as two side-by-side
half-images, flip it.

`createStartUpPageContainer` and `updateImageRawData` have been seen returning
both numeric and string success values across SDK builds, so `isOk()` accepts
either rather than asserting one.

## Licence

MIT. See [LICENSE](LICENSE).
