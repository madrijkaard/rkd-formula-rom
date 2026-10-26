// Very simple arcade car model: longitudinal speed, lateral position, gears, rpm.
import { CAR, TRACK } from '../config.js';
import { clamp } from '../util.js';
import { sampleTrack, corners, LAP_LENGTH } from './track.js';

export class Car {
  constructor() {
    this.z = 0;          // distance travelled along the track (m)
    this.x = 0;          // lateral position (m), 0 = centre, + = right
    this.v = 0;          // speed (m/s)
    this.steer = 0;      // smoothed steering (-1..1), drives the lateral movement
    this.headingError = 0; // camera follows the road tangent automatically
    this.assistedCorner = null; // a correct arrow tap enables this corner's assist
    this.contactSide = 0;  // -1 left, +1 right, 0 clear
    this.shake = 0;
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
    const road = TRACK.layout === 'suzuka' ? sampleTrack(this.z) : null;
    let a;
    if (input.throttle > 0) {
      a = input.throttle * CAR.accel * Math.max(0, 1 - (v / CAR.vmax) ** 2);
    } else {
      a = -(CAR.coastBase + CAR.coastDrag * v * v); // gentle coast-down
    }
    a -= input.brake * CAR.brake;
    // Arcade hill resistance; keep the parked car still until the driver moves.
    if (road && (v > 0 || input.throttle > 0)) a -= 9.81 * road.grade;
    this.v = clamp(v + a * dt, 0, CAR.vmax);

    // A correct arrow tap enables automatic following for this named corner.
    // Each new corner needs its own input, including consecutive same-side turns.
    let corner = null;
    if (road && Math.abs(road.curve) > CAR.cornerCurveThreshold) {
      const distance = c => {
        const d = Math.abs(c.d - road.d);
        return Math.min(d, LAP_LENGTH - d);
      };
      corner = corners.reduce((a,b) => distance(a) < distance(b) ? a : b).number;
    }
    if (this.assistedCorner !== corner) this.assistedCorner = null;
    if (corner !== null && input.steer * Math.sign(road.curve) > 0.05) {
      this.assistedCorner = corner;
    }
    // Keep the forward-facing camera, but physically drift toward the outside
    // until assistance is engaged. The penalty starts only at the road edge.
    this.headingError = 0;
    const drift = corner !== null && this.assistedCorner !== corner && input.throttle > 0
      ? clamp(-road.curve * this.v * this.v * CAR.curveDrift, -18, 18) : 0;
    const across = (this.steer * CAR.lateral * clamp(this.v / 25, 0, 1) + drift) * dt;
    const nextX = this.x + across;
    const lim = TRACK.roadHalf - CAR.halfWidth;
    const side = nextX >= lim ? 1 : nextX <= -lim ? -1 : 0;
    const pushing = side && (side * across > 0 || side * input.steer > 0);
    if (pushing) {
      // The same gradual friction applies on straights and bends. It wins over
      // the accelerator, and only persistent contact brings the car to rest.
      this.v = Math.max(0, Math.min(v, this.v) - CAR.wallDrag * dt);
      this.contactSide = side;
    } else {
      this.contactSide = 0;
    }
    this.x = clamp(nextX, -lim, lim);
    // Use the collision-adjusted speed so a stopped car cannot creep along a wall.
    this.z += this.v * dt;
    this.shake = pushing && (v > 0 || input.throttle > 0) ? 0.35 : 0;

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
