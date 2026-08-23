import { dataBus } from "../dataBus";
import { norm360 } from "../navigation";

/**
 * Synthetic conditions for browser development. This is a dev-only convenience;
 * it is never reachable in a packaged build, where `VITE_DEMO` is unset.
 */
export function startDemo(): () => void {
  let t = 0;

  const tick = () => {
    t += 1;
    const course = norm360(127 + Math.sin(t / 30) * 25);

    dataBus.update({
      locationPermission: "granted",
      forecastLoaded: true,
      fix: {
        lat: 44.4 + Math.sin(t / 200) * 0.01,
        lon: 9.0 + Math.cos(t / 200) * 0.01,
        accuracyM: 6,
        sogKnots: 6.4 + Math.sin(t / 17) * 1.2,
        cogDeg: course,
        valid: true,
        at: Date.now()
      },
      weather: {
        temperatureC: 23,
        windSpeedKnots: 14.2 + Math.sin(t / 23) * 3,
        windGustKnots: 19.5,
        windDirection: norm360(95 + Math.sin(t / 40) * 15),
        precipitation: 0,
        hourlyProbability: [10, 15, 25, 40, 65, 80, 70, 45, 30, 20, 15, 5],
        nextRainMinutes: 195,
        valid: true
      },
      sea: {
        waveHeightM: 1.4 + Math.sin(t / 19) * 0.3,
        wavePeriodS: 6.2,
        waveDirection: 250,
        swellHeightM: 0.9,
        swellPeriodS: 9.1,
        swellDirection: 265,
        seaTemperatureC: 21,
        valid: true
      }
    });
  };

  tick();
  const timer = setInterval(tick, 1000);
  return () => clearInterval(timer);
}
