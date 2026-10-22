// EXPERIMENTAL / not enabled by default: steering from the device accelerometer
// (Android Chrome). Enable with ?tilt=1 in the URL. Hold the phone in landscape and
// tilt it like a steering wheel. Throttle / brake still come from other sources
// (e.g. on-screen pedals to be added later).
export class TiltSource {
  constructor({ maxTiltDeg = 30, deadZoneDeg = 3 } = {}) {
    this.maxTilt = maxTiltDeg;
    this.dead = deadZoneDeg;
    this.steer = 0;
    this.onOrientation = (e) => {
      if (e.beta == null || e.gamma == null) return;
      const angle = (screen.orientation && screen.orientation.angle) ?? window.orientation ?? 0;
      let tilt;
      if (angle === 90) tilt = e.beta;
      else if (angle === 270 || angle === -90) tilt = -e.beta;
      else tilt = e.gamma; // portrait fallback
      if (Math.abs(tilt) < this.dead) tilt = 0;
      this.steer = Math.max(-1, Math.min(1, tilt / this.maxTilt));
    };
    window.addEventListener('deviceorientation', this.onOrientation);
  }

  read() {
    return { steer: this.steer, throttle: 0, brake: 0 };
  }

  dispose() {
    window.removeEventListener('deviceorientation', this.onOrientation);
  }
}
