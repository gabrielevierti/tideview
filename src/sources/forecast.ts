import { dataBus } from "../dataBus";
import { distanceMeters, kmhToKnots } from "../navigation";
import type { Sea, Weather } from "../models";
import { FORECAST_MOVE_THRESHOLD_M, REQUEST_TIMEOUT_MS } from "../config";

const WEATHER_URL = "https://api.open-meteo.com/v1/forecast";
const MARINE_URL = "https://marine-api.open-meteo.com/v1/marine";

/** Hourly rain below this total is not worth warning about. */
const RAIN_THRESHOLD_MM = 0.1;

interface Hourly {
  time?: string[];
  [key: string]: unknown;
}

interface ApiResponse {
  current?: Record<string, number | undefined>;
  hourly?: Hourly;
}

async function getJson(url: string): Promise<ApiResponse | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return (await response.json()) as ApiResponse;
  } catch (err) {
    console.warn("[forecast]", url, err);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function parseWeather(json: ApiResponse): Weather | null {
  const current = json.current;
  if (!current) return null;

  const times = (json.hourly?.["time"] as string[] | undefined) ?? [];
  const rain = (json.hourly?.["precipitation"] as number[] | undefined) ?? [];
  const probability = (json.hourly?.["precipitation_probability"] as number[] | undefined) ?? [];
  const now = Date.now();

  let nextRainMinutes: number | null = null;
  for (let i = 0; i < times.length; i++) {
    const at = Date.parse(times[i] as string);
    if (!Number.isFinite(at) || at <= now) continue;
    if ((rain[i] ?? 0) >= RAIN_THRESHOLD_MM) {
      nextRainMinutes = Math.round((at - now) / 60000);
      break;
    }
  }

  const firstFuture = times.findIndex((t) => Date.parse(t) > now);
  const start = firstFuture < 0 ? 0 : firstFuture;

  return {
    temperatureC: current["temperature_2m"] ?? 0,
    windSpeedKnots: kmhToKnots(current["wind_speed_10m"] ?? 0),
    windGustKnots: kmhToKnots(current["wind_gusts_10m"] ?? 0),
    windDirection: current["wind_direction_10m"] ?? 0,
    precipitation: current["precipitation"] ?? 0,
    hourlyProbability: probability.slice(start, start + 12).map((p) => p ?? 0),
    nextRainMinutes,
    valid: true
  };
}

function parseSea(json: ApiResponse): Sea | null {
  const current = json.current;
  if (!current) return null;
  const waveHeight = current["wave_height"];
  // Inland and some coastal cells have no wave model at all.
  if (waveHeight === undefined || !Number.isFinite(waveHeight)) return null;

  const seaTemp = current["sea_surface_temperature"];
  return {
    waveHeightM: waveHeight,
    wavePeriodS: current["wave_period"] ?? 0,
    waveDirection: current["wave_direction"] ?? 0,
    swellHeightM: current["swell_wave_height"] ?? 0,
    swellPeriodS: current["swell_wave_period"] ?? 0,
    swellDirection: current["swell_wave_direction"] ?? 0,
    seaTemperatureC: seaTemp !== undefined && Number.isFinite(seaTemp) ? seaTemp : null,
    valid: true
  };
}

/**
 * Fetches weather and sea state for the current fix. Refetches only when the
 * boat has moved far enough to matter, so a long passage does not hammer the
 * API and a moored boat costs almost nothing.
 */
export class ForecastSource {
  private lastLat: number | null = null;
  private lastLon: number | null = null;
  private inFlight = false;

  async refresh(force = false): Promise<void> {
    const { fix } = dataBus.get();
    if (!fix.valid || this.inFlight) return;

    if (!force && this.lastLat !== null && this.lastLon !== null) {
      const moved = distanceMeters(this.lastLat, this.lastLon, fix.lat, fix.lon);
      if (moved < FORECAST_MOVE_THRESHOLD_M) return;
    }

    this.inFlight = true;
    try {
      const coords = `latitude=${fix.lat.toFixed(3)}&longitude=${fix.lon.toFixed(3)}`;

      const [weatherJson, marineJson] = await Promise.all([
        getJson(
          `${WEATHER_URL}?${coords}` +
            "&current=temperature_2m,precipitation,wind_speed_10m,wind_direction_10m,wind_gusts_10m" +
            "&hourly=precipitation,precipitation_probability&forecast_days=2&timezone=auto"
        ),
        getJson(
          `${MARINE_URL}?${coords}` +
            "&current=wave_height,wave_period,wave_direction," +
            "swell_wave_height,swell_wave_period,swell_wave_direction,sea_surface_temperature" +
            "&timezone=auto"
        )
      ]);

      const weather = weatherJson ? parseWeather(weatherJson) : null;
      const sea = marineJson ? parseSea(marineJson) : null;

      if (weather || sea) {
        this.lastLat = fix.lat;
        this.lastLon = fix.lon;
        dataBus.update({
          ...(weather ? { weather } : {}),
          ...(sea ? { sea } : {}),
          forecastLoaded: true
        });
      }
    } finally {
      this.inFlight = false;
    }
  }
}
