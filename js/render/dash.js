// Live steering-wheel display drawn over the (blanked) screen of the cockpit image:
// shift LEDs, gear digit and power bar, in the image's native pixel coordinates.
// The blanked areas are defined in tools/build_cockpit.py (DASH_BLANK).
import { CAR } from '../config.js';
import { clamp } from '../util.js';

// LED centres and colours sampled from the mockup.
const LEDS = [
  [573, '#60b42c'], [586, '#cb5513'], [601, '#cb0d0f'], [616, '#46b021'], [634, '#abcb1e'],
  [658, '#d7bd29'], [673, '#2a9fca'], [687, '#2da8cb'], [702, '#3ba52e'],
];
const LED_Y = 462;
const LED_OFF = '#1c1c1c';
const DIGIT = { x: 624, y: 486, px: 6, py: 5, color: '#e9e7e5' };
const BAR = { x: 556, y: 533, h: 18, n: 11, pitch: 15.3, w: 13, on: '#3ab423', off: '#10260d' };

export function drawDash(pen, car) {
  const rpmF = clamp((car.rpm - 7000) / (CAR.maxRpm - 7000), 0, 1);
  const lit = Math.round(rpmF * LEDS.length);
  const limiter = rpmF > 0.97;
  const blinkOff = limiter && Math.floor(car.time * 12) % 2 === 1;
  for (let i = 0; i < LEDS.length; i++) {
    const [x, col] = LEDS[i];
    const c = i < lit && !blinkOff ? col : LED_OFF;
    pen.rect(x - 3.5, LED_Y - 2.5, 7, 5, c);
    pen.rect(x - 2.5, LED_Y - 3.5, 5, 7, c);
  }
  const g = car.gear === 0 ? 'N' : String(car.gear);
  pen.text(g, DIGIT.x + 15, DIGIT.y, { px: DIGIT.px, py: DIGIT.py, color: DIGIT.color, align: 'center' });
  const level = Math.round(clamp(car.throttle * 0.7 + rpmF * 0.3, 0, 1) * BAR.n);
  for (let i = 0; i < BAR.n; i++) {
    pen.rect(BAR.x + i * BAR.pitch, BAR.y, BAR.w, BAR.h, i < level ? BAR.on : BAR.off);
  }
}
