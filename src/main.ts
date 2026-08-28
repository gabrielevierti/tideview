import { FORECAST_INTERVAL_MS } from "./config";
import { createApp } from "./app";
import { dataBus } from "./dataBus";
import { createPreview } from "./preview";
import { ForecastSource } from "./sources/forecast";
import { GeolocationSource } from "./sources/geolocation";
import { startDemo } from "./sources/demo";

/**
 * Boot.
 *
 * Everything above this file is either a pure function of the conditions or a
 * source that produces them; this is the only place the two are wired together.
 */
async function start(): Promise<void> {
  const preview = createPreview();
  const seastate = await createApp(preview?.paint);
  preview?.attach(seastate);

  const { hub } = seastate;

  // A browser tab has no boat, so the preview can run on synthetic conditions.
  // The demo source is dev-only and unreachable in a packaged build.
  if (import.meta.env.VITE_DEMO === "1") {
    const stopDemo = startDemo();
    hub.onSuspend(stopDemo);
    hub.onExit(() => { stopDemo(); seastate.dispose(); });
    return;
  }

  const location = new GeolocationSource();
  const forecast = new ForecastSource();

  location.start();
  const poll = setInterval(() => void forecast.refresh(true), FORECAST_INTERVAL_MS);
  // Refresh opportunistically as the boat moves, too — the source itself
  // decides whether we have gone far enough for a new cell to matter.
  const unsubscribe = dataBus.subscribe(() => void forecast.refresh());

  const teardown = (): void => {
    clearInterval(poll);
    unsubscribe();
    location.stop();
    seastate.dispose();
  };

  // The reviewer tests with the phone locked for five minutes: stop the GPS
  // watch and the poll when backgrounded rather than draining the battery for
  // a display nobody is wearing.
  hub.onSuspend(() => location.stop());
  hub.onResume(() => {
    location.start();
    void forecast.refresh(true);
  });
  hub.onExit(teardown);
  window.addEventListener("pagehide", teardown);
}

start().catch((error) => {
  console.error("[seastate] failed to start", error);
});
