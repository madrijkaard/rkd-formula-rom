// Very simple arcade car model: longitudinal speed, lateral position, gears, rpm.
import { CAR, TRACK } from '../config.js';
import { clamp } from '../util.js';

export class Car {
  constructor() {
    this.z = 0;          // distance travelled along the track (m)
    this.x = 0;          // lateral position (m), 0 = centre, + = right
    this.v = 0;          // speed (m/s)
    this.steer = 0;      // smoothed steering (-1..1), drives the lateral movement
    this.throttle = 0;   // smoothed pedal values for the dash display
    this.brake = 0;
    this.gear = 0;       // 0 = neutral
    this.rpm = CAR.idleRpm;
    this.time = 0;
  }

  get kmh() { return this.v * 3.6; }

  update(dt, input) {
    this.time += dt;
    // Steering wheel follows the (possibly digital) input smoothly.
    const ds = input.steer - this.steer;
    const maxStep = CAR.steerRate * dt;
    this.steer += clamp(ds, -maxStep, maxStep);

    this.throttle += (input.throttle - this.throttle) * Math.min(1, dt * 10);
    this.brake += (input.brake - this.brake) * Math.min(1, dt * 12);

    // Longitudinal dynamics.
    const v = this.v;
    let a;
    if (input.throttle > 0) {
      a = input.throttle * CAR.accel * Math.max(0, 1 - (v / CAR.vmax) ** 2);
    } else {
      a = -(CAR.coastBase + CAR.coastDrag * v * v); // gentle coast-down
    }
    a -= input.brake * CAR.brake;
    this.v = clamp(v + a * dt, 0, CAR.vmax);
    this.z += this.v * dt;

    // Lateral movement: needs speed to turn, clamped to the track limits.
    const grip = clamp(this.v / 25, 0, 1);
    this.x += this.steer * CAR.lateral * grip * dt;
    const lim = TRACK.roadHalf - CAR.halfWidth;
    this.x = clamp(this.x, -lim, lim);

    // Automatic gearbox (display only).
    const kmh = this.kmh;
    if (kmh < 0.5 && input.throttle === 0) {
      this.gear = 0;
      this.rpm += (CAR.idleRpm - this.rpm) * Math.min(1, dt * 6);
    } else {
      let g = 0;
      while (g < CAR.gearTop.length - 1 && kmh >= CAR.gearTop[g]) g++;
      this.gear = g + 1;
      const lo = g === 0 ? 0 : CAR.gearTop[g - 1] * 0.92;
      const hi = CAR.gearTop[g];
      const f = clamp((kmh - lo) / (hi - lo), 0, 1);
      const target = (g === 0 ? CAR.idleRpm : 7600) + f * (CAR.maxRpm - (g === 0 ? CAR.idleRpm : 7600));
      this.rpm += (target - this.rpm) * Math.min(1, dt * 15);
    }
  }
}
