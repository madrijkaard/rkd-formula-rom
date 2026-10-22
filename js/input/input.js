// Input abstraction: the game only ever sees { steer: -1..1, throttle: 0..1, brake: 0..1 }.
// Any number of sources (keyboard, accelerometer, touch, gamepad...) can be combined;
// each source just needs a read() method returning that same shape.
import { KeyboardSource } from './keyboard.js';
import { TiltSource } from './tilt.js';

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

export class InputManager {
  constructor(sources = []) {
    this.sources = sources;
    this.state = { steer: 0, throttle: 0, brake: 0 };
  }

  addSource(src) { this.sources.push(src); }

  read() {
    let steer = 0, throttle = 0, brake = 0;
    for (const s of this.sources) {
      const r = s.read();
      steer += r.steer || 0;
      throttle = Math.max(throttle, r.throttle || 0);
      brake = Math.max(brake, r.brake || 0);
    }
    this.state.steer = clamp(steer, -1, 1);
    this.state.throttle = clamp(throttle, 0, 1);
    this.state.brake = clamp(brake, 0, 1);
    return this.state;
  }
}

export function createDefaultInput(target = window) {
  const input = new InputManager([new KeyboardSource(target)]);
  if (new URLSearchParams(location.search).get('tilt') === '1') input.addSource(new TiltSource());
  return input;
}
