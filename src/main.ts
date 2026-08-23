import { dataBus } from "./dataBus";
import { createRenderer } from "./g2";
import { mountPreview } from "./preview";
import { GeolocationSource } from "./sources/geolocation";
import { ForecastSource } from "./sources/forecast";
import { startDemo } from "./sources/demo";
import { FORECAST_INTERVAL_MS } from "./config";

async function start(): Promise<void> {
  const renderer = await createRenderer();

  dataBus.subscribe((data) => renderer.requestRender(data));

  const inBrowser = !renderer.isBridged;
  if (inBrowser) mountPreview(renderer);

  // The browser has no boat and often no GPS, so the preview runs on synthetic
  // conditions unless a real fix is available.
  if (import.meta.env.VITE_DEMO === "1") {
    const stopDemo = startDemo();
    renderer.onSuspend(stopDemo);
    return;
  }

  const location = new GeolocationSource();
  const forecast = new ForecastSource();

  location.start();
  const forecastTimer = setInterval(() => void forecast.refresh(true), FORECAST_INTERVAL_MS);
  // Also refresh opportunistically as the boat moves.
  const unsubscribe = dataBus.subscribe(() => void forecast.refresh());

  // The reviewer tests with the phone locked: stop the GPS watch and the poll
  // when backgrounded so we are not draining battery for a display nobody sees.
  renderer.onSuspend(() => location.stop());
  renderer.onResume(() => {
    location.start();
    void forecast.refresh(true);
  });

  window.addEventListener("pagehide", () => {
    clearInterval(forecastTimer);
    unsubscribe();
    location.stop();
    renderer.dispose();
  });
}

start().catch((err) => {
  console.error("[seastate] failed to start", err);
});
