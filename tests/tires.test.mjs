import test from 'node:test';
import assert from 'node:assert/strict';
import { TireAnimator } from '../js/render/tires.js';
import { Car } from '../js/game/car.js';
import { COCKPIT, FIXED_DT, TIRES } from '../js/config.js';

// Deterministic rubber image, with no native Canvas or browser dependency.
function canvasFixture() {
  return { width: 1, height: 1, getContext: () => ({
    drawImage() {},
    getImageData() {
      const data = new Uint8ClampedArray(COCKPIT.w * COCKPIT.h * 4);
      for (let i = 0; i < data.length; i += 4) {
        data[i] = data[i + 1] = data[i + 2] = 50 + Math.floor(i / 4 / COCKPIT.w) % 30;
        data[i + 3] = 255;
      }
      return { data };
    },
    createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
    putImageData() {},
  }) };
}
const create = () => new TireAnimator({}, canvasFixture);
const snapshot = animator => animator.patches.map(p => Buffer.from(p.frame.data));
const pedal = { throttle: 1, steer: 0, brake: 0 };

test('tyre phase is independent of the number of rendered frames', () => {
  const many = create(), one = create();
  for (let i = 0; i <= 100; i++) many.update(i * 0.03, 3);
  one.update(3, 3);
  assert.deepEqual(snapshot(many), snapshot(one));
});

test('both tyres roll while coasting and freeze at the final braking position', () => {
  const car = new Car(), animation = create();
  for (let i = 0; i < 30; i++) car.update(FIXED_DT, pedal);
  animation.update(car.z, car.v);
  const accelerating = snapshot(animation), previousSpeed = car.v;
  for (let i = 0; i < 12; i++) car.update(FIXED_DT, { ...pedal, throttle: 0 });
  animation.update(car.z, car.v);
  assert(car.v < previousSpeed && car.v > 0);
  snapshot(animation).forEach((frame, i) => assert.notDeepEqual(frame, accelerating[i]));
  for (let i = 0; i < 120; i++) car.update(FIXED_DT, { ...pedal, throttle: 0, brake: 1 });
  assert.equal(car.v, 0);
  animation.update(car.z, car.v);
  const stopped = snapshot(animation), distance = car.z;
  for (let i = 0; i < 120; i++) {
    car.update(FIXED_DT, { ...pedal, throttle: 0 });
    animation.update(car.z, car.v);
  }
  assert.equal(car.z, distance);
  assert.deepEqual(snapshot(animation), stopped);
});

test('high-speed texture merges instead of strobing between rotation phases', () => {
  const animation = create();
  animation.update(0, 330 / 3.6);
  const first = snapshot(animation);
  animation.update(0.37, 330 / 3.6);
  assert.deepEqual(snapshot(animation), first);
  animation.update(0.37, 2);
  const slow = snapshot(animation);
  animation.update(0.48, 2);
  snapshot(animation).forEach((frame, i) => assert.notDeepEqual(frame, slow[i]));
});

test('the flag disables the overlay without modifying the car', () => {
  const animation = create(), car = new Car();
  const enabled = TIRES.animated;
  try {
    TIRES.animated = false;
    animation.draw({}, car, 0, 0, 1280, 720);
    assert.equal(animation.lastDistance, null);
    assert.equal(car.z, 0);
  } finally { TIRES.animated = enabled; }
});
