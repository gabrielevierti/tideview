import { dataBus } from "../dataBus";
import { msToKnots, norm360 } from "../navigation";
import type { Fix } from "../models";

/**
 * Position, speed and course from the phone's GPS via the WebView.
 *
 * The SDK has no location API; this uses the standard browser API, which the
 * host app grants once `location` is declared in app.json. Note that QR-sideloaded
 * builds are denied location - you need a real install to test this path.
 */
export class GeolocationSource {
  private watchId: number | null = null;
  /** Course is null when stationary, so the last known heading is held. */
  private lastCourse: number | null = null;

  start(): void {
    if (this.watchId !== null) return;

    if (!("geolocation" in navigator)) {
      dataBus.update({ locationPermission: "unavailable" });
      return;
    }

    this.watchId = navigator.geolocation.watchPosition(
      (position) => this.onPosition(position),
      (error) => this.onError(error),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 2000 }
    );
  }

  private onPosition(position: GeolocationPosition): void {
    const c = position.coords;

    // `heading` is null below the platform's speed threshold; holding the last
    // value stops the compass spinning wildly when drifting or moored.
    if (c.heading !== null && Number.isFinite(c.heading)) {
      this.lastCourse = norm360(c.heading);
    }

    const fix: Fix = {
      lat: c.latitude,
      lon: c.longitude,
      accuracyM: Number.isFinite(c.accuracy) ? c.accuracy : 0,
      sogKnots: c.speed !== null && Number.isFinite(c.speed) ? msToKnots(c.speed) : null,
      cogDeg: this.lastCourse,
      valid: true,
      at: position.timestamp
    };

    dataBus.update({ fix, locationPermission: "granted" });
  }

  private onError(error: GeolocationPositionError): void {
    if (error.code === error.PERMISSION_DENIED) {
      dataBus.update({ locationPermission: "denied" });
      return;
    }
    // TIMEOUT and POSITION_UNAVAILABLE are transient; keep watching and keep
    // showing the last fix rather than blanking the display.
    console.warn("[geolocation]", error.message);
  }

  stop(): void {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
  }
}
