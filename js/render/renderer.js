// Composes a frame: the procedural world is rendered into a low-res framebuffer and
// scaled up; the cockpit image (with a transparent windscreen) is drawn on top at full
// output size, then the steering wheel + hands layer (rotated by a few degrees with the
// steering, with the live wheel display baked into it) and finally the HUD.
import { SCREEN_W as W, SCREEN_H as H, COCKPIT, WHEEL } from '../config.js';
import { Framebuffer } from './framebuffer.js';
import { WorldRenderer } from './world.js';
import { PixelPen } from './pixelpen.js';
import { drawDash } from './dash.js';
import { drawHud } from './hud.js';
import { hash } from '../util.js';
import { TireAnimator } from './tires.js';
import { splitPilotLayers } from './pilot-layers.js';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.fb = new Framebuffer(W, H);
    this.low = document.createElement('canvas');
    this.low.width = W;
    this.low.height = H;
    this.lowCtx = this.low.getContext('2d');
    this.image = new ImageData(this.fb.bytes, W, H);
    this.world = new WorldRenderer();
    this.pen = new PixelPen(this.ctx);
    this.cockpit = null;
    this.tires = null;
    this.wheel = null;          // offscreen canvas: wheel layer + live dash, native pixels
    this.legs = null;           // stationary pilot layer, never steering-rotated
    this.wheelAngle = 0;        // displayed angle (rad), clockwise positive
    this.lastT = null;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  async load() {
    const loadImg = async (src) => {
      const img = new Image();
      img.src = src;
      await img.decode();
      return img;
    };
    const [cockpit, wheelImg] = await Promise.all([loadImg(COCKPIT.src), loadImg(WHEEL.src)]);
    this.cockpit = cockpit;
    this.tires = new TireAnimator(cockpit);
    const pilot = splitPilotLayers(wheelImg, WHEEL.w, WHEEL.h);
    this.wheelImg = pilot.wheel;
    this.legs = pilot.legs;
    const c = document.createElement('canvas');
    c.width = WHEEL.w;
    c.height = WHEEL.h;
    this.wheelCtx = c.getContext('2d');
    this.wheelCtx.imageSmoothingEnabled = false;
    this.wheelCtx.drawImage(this.wheelImg, 0, 0);
    this.wheelPen = new PixelPen(this.wheelCtx);
    this.wheel = c;
  }

  // Target angle from the (already rate-limited) car.steer with an ease-in-out curve,
  // followed by an exponential smoother so the wheel settles softly.
  updateWheelAngle(car, t) {
    const dt = this.lastT == null ? 0 : Math.min(0.1, Math.max(0, t - this.lastT));
    this.lastT = t;
    const a = Math.min(1, Math.abs(car.steer));
    const eased = Math.sign(car.steer) * a * a * (3 - 2 * a);
    const target = eased * WHEEL.maxDeg * Math.PI / 180;
    this.wheelAngle += (target - this.wheelAngle) * (1 - Math.exp(-WHEEL.follow * dt));
    if (Math.abs(this.wheelAngle - target) < 1e-5) this.wheelAngle = target;
  }

  // Repaint the display region of the wheel layer and draw the live dash into it.
  bakeDash(car) {
    const [x, y, w, h] = WHEEL.screen;
    this.wheelCtx.clearRect(x, y, w, h);
    this.wheelCtx.drawImage(this.wheelImg, x, y, w, h, x, y, w, h);
    this.wheelPen.set(1, 0, 0);
    drawDash(this.wheelPen, car);
  }

  // Fill the window keeping 16:9 (nearest-neighbour scaling keeps both layers crisp).
  resize() {
    const dpr = window.devicePixelRatio || 1;
    const vw = window.innerWidth * dpr, vh = window.innerHeight * dpr;
    const s = Math.min(vw / W, vh / H);
    const cw = Math.max(W, Math.round(W * s)), ch = Math.max(H, Math.round(H * s));
    this.canvas.width = cw;
    this.canvas.height = ch;
    this.canvas.style.width = `${cw / dpr}px`;
    this.canvas.style.height = `${ch / dpr}px`;
  }

  render(car, t) {
    const { ctx, canvas } = this;
    const cw = canvas.width, ch = canvas.height;
    // subtle cockpit shake above 200 km/h (about one art pixel)
    const k = Math.max(1, Math.round(cw / COCKPIT.w * 2));
    let sx = 0, sy = 0;
    const amp = Math.max(0, (car.kmh - 200) / 130);
    if (amp > 0) {
      const f = Math.floor(t * 30);
      if (hash(f, 1) < amp) sy = hash(f, 2) < 0.5 ? -k : k;
      if (hash(f, 3) < amp * 0.3) sx = hash(f, 4) < 0.5 ? -k : k;
    }
    this.world.render(this.fb, car, t, 0);
    this.lowCtx.putImageData(this.image, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.low, 0, 0, cw, ch);

    if (this.cockpit) {
      // overscan by k pixels on each side so the shake never reveals the edges
      const ox = -k + sx, oy = -k + sy, ow = cw + 2 * k, oh = ch + 2 * k;
      if (this.tires) this.tires.drawCockpit(ctx, this.cockpit, car, ox, oy, ow, oh);
      else ctx.drawImage(this.cockpit, ox, oy, ow, oh);

      // Legs follow the chassis placement/shake, but never the steering rotation.
      const s = ow / COCKPIT.w;
      if (this.legs) ctx.drawImage(this.legs, ox, oy, WHEEL.w * s, WHEEL.h * s);

      // wheel + hands, rotated around the steering column axis (nearest-neighbour)
      this.updateWheelAngle(car, t);
      if (WHEEL.visible !== false) {
        this.bakeDash(car);
        const px = ox + WHEEL.pivotX * s, py = oy + WHEEL.pivotY * s;
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(this.wheelAngle);
        ctx.translate(-px, -py);
        ctx.drawImage(this.wheel, ox, oy, WHEEL.w * s, WHEEL.h * s);
        ctx.restore();
      }
    }
    this.pen.set(cw / COCKPIT.w, 0, 0);
    drawHud(this.pen, car);
  }
}
