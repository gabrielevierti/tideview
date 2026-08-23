/** Where the phone thinks we are, and how fast we are moving. */
export interface Fix {
  lat: number;
  lon: number;
  /** Horizontal accuracy in metres. */
  accuracyM: number;
  /** Speed over ground in knots, or null when the platform cannot supply it. */
  sogKnots: number | null;
  /** Course over ground in degrees true, or null when stationary. */
  cogDeg: number | null;
  valid: boolean;
  /** Wall-clock ms of the fix. */
  at: number;
}

export interface Weather {
  temperatureC: number;
  windSpeedKnots: number;
  windGustKnots: number;
  /** Direction the wind blows *from*, degrees true. */
  windDirection: number;
  precipitation: number;
  /** Hourly probability of precipitation, next 12 hours. */
  hourlyProbability: number[];
  /** Minutes until measurable rain, or null if none in the forecast window. */
  nextRainMinutes: number | null;
  valid: boolean;
}

export interface Sea {
  waveHeightM: number;
  wavePeriodS: number;
  /** Direction the waves travel *towards*, degrees true. */
  waveDirection: number;
  swellHeightM: number;
  swellPeriodS: number;
  swellDirection: number;
  seaTemperatureC: number | null;
  valid: boolean;
}

export type LocationPermission = "unknown" | "granted" | "denied" | "unavailable";

export interface Conditions {
  fix: Fix;
  weather: Weather;
  sea: Sea;
  locationPermission: LocationPermission;
  /** True once a forecast has been fetched successfully at least once. */
  forecastLoaded: boolean;
  timestamp: number;
}

export const DEFAULT_CONDITIONS: Conditions = {
  fix: { lat: 0, lon: 0, accuracyM: 0, sogKnots: null, cogDeg: null, valid: false, at: 0 },
  weather: {
    temperatureC: 0,
    windSpeedKnots: 0,
    windGustKnots: 0,
    windDirection: 0,
    precipitation: 0,
    hourlyProbability: [],
    nextRainMinutes: null,
    valid: false
  },
  sea: {
    waveHeightM: 0,
    wavePeriodS: 0,
    waveDirection: 0,
    swellHeightM: 0,
    swellPeriodS: 0,
    swellDirection: 0,
    seaTemperatureC: null,
    valid: false
  },
  locationPermission: "unknown",
  forecastLoaded: false,
  timestamp: 0
};
