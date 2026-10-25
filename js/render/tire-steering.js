// Separate the front tyres from the chassis once, then project a small steering yaw.
// These boundaries follow the bodywork edge in the current 1280x720 artwork.
import { COCKPIT, TIRES } from '../config.js';
import { clamp } from '../util.js';

const REGIONS = [
  { x: 96, y: 320, w: 292, h: 158, side: -1,
    edge: [[96,454],[108,452],[372,397],[380,391],[388,387.4]] },
  { x: 896, y: 320, w: 284, h: 158, side: 1,
    edge: [[896,391.48],[905,394],[1165,452],[1180,453]] },
];
// Chassis mirror axis from the original artwork (x = 638).
const MIRROR_SUM = 1276;

function edgeY(x, points) {
  for (let i = 1; i < points.length; i++) {
    const [ax, ay] = points[i - 1], [bx, by] = points[i];
    if (x <= bx) return ay + (by - ay) * (x - ax) / (bx - ax);
  }
  return points.at(-1)[1];
}

export function steeringProjection(steer, side) {
  const amount = clamp(steer || 0, -1, 1);
  // Local direction is mirrored across the car: positive opens away from the
  // chassis, negative points inward. Left turn: left opens, right closes;
  // right turn: right opens, left closes. Both still point into the same turn.
  const outward = side * amount;
  const ratio = outward < 0 ? TIRES.steerInwardRatio : 1;
  const localAngle = outward * TIRES.steerMaxDeg * ratio * Math.PI / 180;
  return {
    shear: side * Math.tan(localAngle),
    // Open up the tread on the outward tyre and foreshorten the inward tyre.
    width: 1 + outward * 0.06,
  };
}

export function splitTirePixels(source, width, height) {
  const chassis = new Uint8ClampedArray(source);
  const tires = REGIONS.map(region => {
    const pixels = new Uint8ClampedArray(region.w * region.h * 4);
    for (let dx = 0; dx < region.w; dx++) {
      const x = region.x + dx;
      if (x >= width) continue;
      const edge = edgeY(x + 0.5, region.edge);
      let last = -1;
      for (let dy = 0; dy < region.h; dy++) {
        const y = region.y + dy;
        if (y >= height || y + 0.5 >= edge) break;
        const src = (y * width + x) * 4, dst = (dy * region.w + dx) * 4;
        pixels.set(source.subarray(src, src + 4), dst);
        chassis[src + 3] = 0;
        if (source[src + 3] === 255) last = dy;
      }
      // Hidden rubber beneath the chassis prevents gaps along its slanted edge
      // when the tyre turns. The unchanged chassis is composited over it.
      if (last >= 0) {
        const sample = (last * region.w + dx) * 4;
        for (let dy = last + 1; dy <= Math.min(last + 24, region.h - 1); dy++) {
          pixels.set(pixels.subarray(sample, sample + 4), (dy * region.w + dx) * 4);
        }
      }
    }
    return { ...region, pixels };
  });
  return { chassis, tires };
}

export class TireSteering {
  constructor(rgba, makeCanvas) {
    const split = splitTirePixels(rgba, COCKPIT.w, COCKPIT.h);
    const imageCanvas = (pixels, w, h) => {
      const canvas = makeCanvas();
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      const data = ctx.createImageData(w, h);
      data.data.set(pixels);
      ctx.putImageData(data, 0, 0);
      return canvas;
    };
    this.chassis = imageCanvas(split.chassis, COCKPIT.w, COCKPIT.h);
    this.tires = split.tires.map(tire => ({ ...tire,
      canvas: imageCanvas(tire.pixels, tire.w, tire.h) }));
  }

  draw(ctx, car, patches, x, y, width, height) {
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.translate(x, y);
    ctx.scale(width / COCKPIT.w, height / COCKPIT.h);
    for (let i = 0; i < this.tires.length; i++) {
      const tire = this.tires[i];
      // Use the approved right tyre as the left tyre's mirrored artwork, including
      // its rolling texture. Keep each side's own steering projection.
      const mirrored = tire.side < 0;
      const sourceIndex = mirrored ? 1 : i;
      const artwork = this.tires[sourceIndex];
      const projection = steeringProjection(car.steer, tire.side);
      const sourcePivotX = artwork.x + artwork.w / 2;
      const pivotX = mirrored ? MIRROR_SUM - sourcePivotX : sourcePivotX, pivotY = 452;
      ctx.save();
      // Mirrored local yaw opens one tyre and closes the other around their bases.
      ctx.transform(projection.width, 0, -projection.shear, 1,
        (1 - projection.width) * pivotX + projection.shear * pivotY, 0);
      if (mirrored) {
        ctx.translate(MIRROR_SUM, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(artwork.canvas, artwork.x, artwork.y);
      const patch = patches[sourceIndex];
      if (patch) ctx.drawImage(patch.canvas, patch.x, patch.y, patch.w, patch.h);
      ctx.restore();
    }
    ctx.drawImage(this.chassis, 0, 0);
    ctx.restore();
  }
}
