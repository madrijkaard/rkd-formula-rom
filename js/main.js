// Entry point: fixed-timestep simulation + requestAnimationFrame rendering.
import { FIXED_DT } from './config.js';
import { createDefaultInput } from './input/input.js';
import { Car } from './game/car.js';
import { Renderer } from './render/renderer.js';

const canvas = document.getElementById('screen');
const input = createDefaultInput(window);
const car = new Car();
const renderer = new Renderer(canvas);
canvas.focus();
try {
  await renderer.load();
} catch (err) {
  console.error('Failed to load the cockpit image', err);
}
canvas.addEventListener('pointerdown', () => canvas.focus());

const help = document.getElementById('help');
let helpHidden = false;

let last = performance.now();
let acc = 0;
let simTime = 0;

function frame(now) {
  const dt = Math.min(0.25, (now - last) / 1000);
  last = now;
  acc += dt;
  while (acc >= FIXED_DT) {
    const state = input.read();
    car.update(FIXED_DT, state);
    simTime += FIXED_DT;
    acc -= FIXED_DT;
    if (!helpHidden && (state.throttle || state.steer)) {
      helpHidden = true;
      setTimeout(() => help.classList.add('hidden'), 3000);
    }
  }
  renderer.render(car, simTime);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Debug handle for console / automated tests.
window.__rkd = { car, input, renderer };
