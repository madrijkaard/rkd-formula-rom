// Moving rubber texture, clipped to the existing tyres in cockpit art coordinates.
// Distance drives phase, so coasting, braking and standing still all work.
import { COCKPIT, TIRES } from '../config.js';
import { clamp } from '../util.js';
import { TireSteering } from './tire-steering.js';

const TAU = Math.PI * 2;
const STEP = 2; // match the artwork's pixel texture, without filtering at runtime
const SHAPES = [
  { x: 108, y: 330, w: 268, h: 124, side: -1, cx: 316, cy: 418,
    outline: [[110,450],[114,420],[128,386],[147,363],[177,342],[196,334],
      [265,334],[296,340],[322,351],[346,366],[363,384],[371,395],[110,450]] },
  { x: 904, y: 328, w: 264, h: 126, side: 1, cx: 955, cy: 416,
    outline: [[910,392],[917,369],[934,349],[953,336],[976,332],[1058,332],
      [1085,342],[1113,362],[1138,394],[1154,428],[1162,450],[910,392]] },
];

function inside(x, y, points) {
  let hit = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [ax, ay] = points[i], [bx, by] = points[j];
    if ((ay > y) !== (by > y) && x < (bx - ax) * (y - ay) / (by - ay) + ax) hit = !hit;
  }
  return hit;
}

export function tireMotion(distance, speed) {
  const turns = distance / (TAU * TIRES.radius);
  const blur = clamp((Math.abs(speed) - TIRES.blurStart) / (TIRES.blurFull - TIRES.blurStart), 0, 1);
  return {
    phase: (turns % 1) * TAU,
    blur: blur * blur * (3 - 2 * blur),
    // Remove fine detail before its temporal frequency can alias at normal frame rates.
    fine: Math.exp(-((Math.abs(speed) / 4) ** 2)),
    tread: Math.exp(-((Math.abs(speed) / 10) ** 2)),
    sidewall: Math.exp(-((Math.abs(speed) / 20) ** 2)),
  };
}

export class TireAnimator {
  constructor(cockpit, makeCanvas = () => document.createElement('canvas')) {
    const source = makeCanvas();
    source.width = COCKPIT.w;
    source.height = COCKPIT.h;
    const ctx = source.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(cockpit, 0, 0, COCKPIT.w, COCKPIT.h);
    const rgba = ctx.getImageData(0, 0, COCKPIT.w, COCKPIT.h).data;
    this.steering = new TireSteering(rgba, makeCanvas);
    this.patches = SHAPES.map(shape => {
      const canvas = makeCanvas();
      canvas.width = shape.w / STEP;
      canvas.height = shape.h / STEP;
      const context = canvas.getContext('2d');
      const frame = context.createImageData(canvas.width, canvas.height);
      const pixels = [];
      for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
          const ax = shape.x + x * STEP + 1, ay = shape.y + y * STEP + 1;
          // Keep each complete 2x2 cell inside the tyre, including the bodywork edge.
          if (![[ax-1,ay-1],[ax+1,ay-1],[ax-1,ay+1],[ax+1,ay+1]].every(p => inside(...p, shape.outline))) continue;
          const si = (ay * COCKPIT.w + ax) * 4;
          if (rgba[si + 3] !== 255) continue;
          const base = Array.from(rgba.subarray(si, si + 3));
          const smooth = [0, 0, 0];
          let n = 0;
          for (let dy = -12; dy <= 12; dy += 2) {
            if (!inside(ax, ay + dy, shape.outline)) continue;
            const j = ((ay + dy) * COCKPIT.w + ax) * 4;
            if (rgba[j + 3] !== 255) continue;
            for (let c = 0; c < 3; c++) smooth[c] += rgba[j + c];
            n++;
          }
          for (let c = 0; c < 3; c++) smooth[c] /= n || 1;
          const boundary = shape.side < 0 ? 292 - (ay - 350) * 0.35 : 980 + (ay - 350) * 0.35;
          const wall = clamp(0.5 + (shape.side < 0 ? ax - boundary : boundary - ax) / 18, 0, 1);
          const angle = Math.atan2((ay - shape.cy) / 82, (ax - shape.cx) / 52);
          // Curved projection compresses texture towards the top of the tyre.
          const surface = Math.acos(clamp(1 - (ay - shape.y) / shape.h, -1, 1));
          pixels.push({ index: (y * canvas.width + x) * 4, base, smooth, wall,
            angle: angle * shape.side, surface, lateral: ax * 0.025 });
        }
      }
      return { ...shape, canvas, context, frame, pixels };
    });
    this.lastDistance = null;
    this.lastSpeed = null;
  }

  update(distance, speed) {
    if (distance === this.lastDistance && speed === this.lastSpeed) return;
    this.lastDistance = distance;
    this.lastSpeed = speed;
    const motion = tireMotion(distance, speed);
    for (const patch of this.patches) {
      const data = patch.frame.data;
      for (const p of patch.pixels) {
        const rolling = motion.phase - p.surface;
        const tread = Math.sin(rolling * 8 + p.lateral) * 0.29 * motion.tread
          + Math.sin(rolling * 19 - p.lateral * 2) * 0.12 * motion.fine;
        const wall = Math.sin(p.angle * 3 - motion.phase * 3) * 0.32 * motion.sidewall;
        // At full blur, remove even subpixel contrast: tiny residual waves can
        // otherwise flip rounded colour values and shimmer at maximum speed.
        const shade = 1 + (tread * (1 - p.wall) + wall * p.wall) * (1 - motion.blur);
        for (let c = 0; c < 3; c++) {
          const base = p.base[c] + (p.smooth[c] - p.base[c]) * motion.blur * 0.9;
          data[p.index + c] = clamp(Math.round(base * shade), 0, 255);
        }
        data[p.index + 3] = 255;
      }
      patch.context.putImageData(patch.frame, 0, 0);
    }
  }

  drawCockpit(ctx, cockpit, car, x, y, width, height) {
    if (TIRES.steering) {
      if (TIRES.animated) this.update(car.z, car.v);
      this.steering.draw(ctx, car, TIRES.animated ? this.patches : [], x, y, width, height);
    } else {
      ctx.drawImage(cockpit, x, y, width, height);
      this.draw(ctx, car, x, y, width, height);
    }
  }

  draw(ctx, car, x, y, width, height) {
    if (!TIRES.animated) return;
    this.update(car.z, car.v);
    const sx = width / COCKPIT.w, sy = height / COCKPIT.h;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    for (const p of this.patches) {
      ctx.drawImage(p.canvas, x + p.x * sx, y + p.y * sy, p.w * sx, p.h * sy);
    }
    ctx.restore();
  }

}
