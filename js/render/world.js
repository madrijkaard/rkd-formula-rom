// Pseudo-3D world: sky, horizon, scanline-projected road and segment-projected
// roadside scenery (barrier wall, catch fence, grandstands, roof, banner gantries).
import { SCREEN_W as W, SCREEN_H as H, VIEW, TRACK } from '../config.js';
import { C } from './palette.js';
import { Framebuffer, PAT_CHECK, PAT_MESH } from './framebuffer.js';
import { drawText, measureText } from './font.js';
import { hash } from '../util.js';

const CX = W / 2;
const SKY_BANDS = [C.sky0, C.sky1, C.sky2, C.sky3, C.sky4, C.sky5, C.sky6];
const CROWD = [C.crowdR, C.crowdW, C.crowdS, C.crowdB, C.crowdY, C.crowdK, C.crowdG, C.crowdR, C.crowdS];

const CLOUDS = [
  { x: 40, y: 34, s: 1.0 }, { x: 150, y: 22, s: 0.8 }, { x: 250, y: 44, s: 1.2 },
  { x: 330, y: 28, s: 0.9 }, { x: 420, y: 52, s: 0.7 },
];

function makeBanner(text, width = 0) {
  const tw = measureText(text);
  const b = new Framebuffer(Math.max(width, tw + 12), 13);
  b.fillRect(0, 0, b.w, b.h, C.bannerEdge);
  b.fillRect(1, 1, b.w - 2, b.h - 2, C.bannerBg);
  drawText(b, text, Math.floor((b.w - tw) / 2), 3, C.pureWhite);
  return b;
}

export class WorldRenderer {
  constructor() {
    this.banner = makeBanner('FORMULA ROM');
    this.bannerSmall = makeBanner('RKD  RKD  RKD', this.banner.w);
    this.treeProfile = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) {
      this.treeProfile[i] = 3 + 2.2 * Math.sin(i * 0.21) + 1.5 * Math.sin(i * 0.53 + 1.3) + 2 * hash(i, 7);
    }
  }

  render(fb, car, t, bob = 0) {
    const horizon = VIEW.horizon + bob;
    this.horizon = horizon;
    this.camX = car.x;
    this.pos = car.z;
    this.drawSky(fb, horizon, t, car.x);
    this.drawGround(fb, horizon, car);
    this.drawScenery(fb, car);
  }

  drawSky(fb, horizon, t, camX) {
    const bandH = horizon / SKY_BANDS.length;
    for (let y = 0; y < horizon; y++) {
      const b = Math.min(SKY_BANDS.length - 1, Math.floor(y / bandH));
      // dithered transition row between bands for a 16-bit look
      const edge = y % Math.ceil(bandH) === 0 && b > 0;
      fb.span(y, 0, W, SKY_BANDS[b], SKY_BANDS[b - 1] || SKY_BANDS[b], edge ? PAT_CHECK : 0);
    }
    // drifting pixel clouds
    const span = W + 140;
    for (const cl of CLOUDS) {
      let x = (cl.x - t * 2 * cl.s - camX * 0.8) % span;
      if (x < 0) x += span;
      x -= 70;
      const s = cl.s;
      const y = cl.y;
      fb.fillCircle(x + 2, y + 2, 7 * s, C.cloudShade);
      fb.fillCircle(x + 14 * s, y - 2 * s + 2, 9 * s, C.cloudShade);
      fb.fillCircle(x + 26 * s, y + 2, 6 * s, C.cloudShade);
      fb.fillCircle(x, y, 7 * s, C.cloud);
      fb.fillCircle(x + 13 * s, y - 3 * s, 9 * s, C.cloud);
      fb.fillCircle(x + 25 * s, y, 6 * s, C.cloud);
      fb.fillRect(x - 4 * s, y, 34 * s, 4 * s, C.cloud);
    }
    // distant tree line, slight parallax with lateral position
    const off = Math.floor(-camX * 1.5) + 512;
    for (let x = 0; x < W; x++) {
      const h = this.treeProfile[(x + off) & 1023];
      const top = horizon - h;
      fb.span(Math.floor(top), x, x + 1, C.tree1);
      for (let y = Math.floor(top) + 1; y < horizon; y++) fb.span(y, x, x + 1, ((x + y) & 3) ? C.tree0 : C.tree1);
    }
  }

  drawGround(fb, horizon, car) {
    const { depth: D, camHeight: CH } = VIEW;
    const R = TRACK.roadHalf, L = TRACK.lineW, K = TRACK.kerbW, G = TRACK.grassW, WX = TRACK.wallX;
    const camX = car.x, pos = car.z;
    const yStart = Math.max(0, Math.floor(horizon) + 1);
    for (let y = yStart; y < H; y++) {
      const dy = y + 0.5 - horizon;
      if (dy <= 0) continue;
      const z = (CH * D) / dy;
      const zFar = (CH * D) / Math.max(0.25, dy - 0.5);
      const zNear = (CH * D) / (dy + 0.5);
      const dz = zFar - zNear;          // world depth covered by this scanline
      const wz = pos + z;
      const s = D / z;                  // pixels per metre at this depth
      const X = (wx) => CX + (wx - camX) * s;
      const pick = (period, a, b, mid) => (dz > period * 0.5 ? mid : (Math.floor(wz / period) & 1 ? a : b));

      const asphalt = pick(8, C.asphalt0, C.asphalt1, C.asphaltMid);
      const kerb = pick(2.5, C.kerbRed, C.kerbWhite, C.kerbMid);
      const grass = pick(6, C.grass0, C.grass1, C.grassMid);
      const runoff = pick(10, C.runoff0, C.runoff1, C.runoffMid);

      fb.span(y, 0, W, C.concrete);
      for (const sd of [-1, 1]) {
        const a = X(sd * WX), b = X(sd * (R + L + K + G));
        fb.span(y, Math.min(a, b), Math.max(a, b), runoff);
        const c = X(sd * (R + L + K));
        fb.span(y, Math.min(b, c), Math.max(b, c), grass);
        const d = X(sd * (R + L));
        fb.span(y, Math.min(c, d), Math.max(c, d), kerb);
        const e = X(sd * R);
        fb.span(y, Math.min(d, e), Math.max(d, e), C.line);
      }
      const xl = X(-R), xr = X(R);
      fb.span(y, xl, xr, asphalt);
      // rubbered racing line + asphalt speckle that streams past at speed
      if (dz < 3) {
        fb.span(y, X(-2.2), X(-0.6), C.rubber, asphalt, PAT_CHECK);
        fb.span(y, X(0.6), X(2.2), C.rubber, asphalt, PAT_CHECK);
        if (dy > 6) {
          const row = Math.floor(wz * 1.5);
          const x0 = Math.max(0, Math.ceil(xl)), x1 = Math.min(W, Math.floor(xr));
          const step = Math.max(1, Math.floor(s / 6));
          for (let x = x0; x < x1; x += step) {
            const wx = (x - CX) / s + camX;
            if (hash(row, Math.floor(wx * 1.5)) < 0.05) fb.span(y, x, x + Math.max(1, s / 2.5), C.speck);
          }
        }
      }
    }
  }

  P(wx, wy, z) {
    const s = VIEW.depth / z;
    return [CX + (wx - this.camX) * s, this.horizon + (VIEW.camHeight - wy) * s];
  }

  // Vertical quad on the plane x = wx between heights h0..h1 and depths z0..z1.
  wallQuad(fb, wx, h0, h1, z0, z1, c, c2 = 0, pat = 0) {
    const [ax, ay0] = this.P(wx, h0, z0);
    const [, ay1] = this.P(wx, h1, z0);
    const [bx, by0] = this.P(wx, h0, z1);
    const [, by1] = this.P(wx, h1, z1);
    fb.fillPoly([ax, ay0, ax, ay1, bx, by1, bx, by0], c, c2, pat);
  }

  // Horizontal-ish strip from (xa, ha) to (xb, hb) across the cross-section, over z0..z1.
  slabQuad(fb, xa, ha, xb, hb, z0, z1, c, c2 = 0, pat = 0) {
    const p0 = this.P(xa, ha, z0), p1 = this.P(xa, ha, z1), p2 = this.P(xb, hb, z1), p3 = this.P(xb, hb, z0);
    fb.fillPoly([p0[0], p0[1], p1[0], p1[1], p2[0], p2[1], p3[0], p3[1]], c, c2, pat);
  }

  drawScenery(fb, car) {
    const SL = TRACK.segLen, N = TRACK.drawSegs, near = VIEW.nearZ;
    const pos = car.z;
    const k0 = Math.floor(pos / SL);
    for (let k = k0 + N; k >= k0; k--) {
      let z0 = k * SL - pos;
      const z1 = z0 + SL;
      if (z1 <= near) continue;
      const clipped = z0 < near;
      if (clipped) z0 = near;
      for (const sd of [-1, 1]) this.drawSide(fb, sd, k, z0, z1, clipped);
      // overhead banner gantry
      const bz = Math.floor((k * SL) / TRACK.bannerEvery) * TRACK.bannerEvery + 150;
      if (bz >= k * SL && bz < (k + 1) * SL) this.drawGantry(fb, bz - pos, Math.floor(bz / TRACK.bannerEvery));
    }
  }

  drawSide(fb, sd, k, z0, z1, clipped) {
    const WX = TRACK.wallX;
    const gap = (k % 40) < 3; // gaps between grandstands every 160 m
    // --- grandstand (behind the fence) ---
    if (!gap) {
      const far = z0 > 90;
      const tiers = far ? 5 : 10;
      const tw = 20 / tiers, th = 12 / tiers;
      for (let i = tiers - 1; i >= 0; i--) {
        const xa = WX + 1.5 + i * tw, ha = 1.4 + i * th;
        const h1 = hash(k, i, sd + 5), h2 = hash(k, i, sd + 9);
        const ca = CROWD[Math.floor(h1 * CROWD.length)];
        const cb = (h2 < 0.25) ? C.stand0 : CROWD[Math.floor(h2 * CROWD.length)];
        if (far) {
          this.slabQuad(fb, sd * xa, ha, sd * (xa + tw), ha + th, z0, z1, ca, cb, PAT_CHECK);
        } else {
          const zm = (z0 + z1) / 2;
          this.slabQuad(fb, sd * xa, ha, sd * (xa + tw), ha + th, z0, zm, ca, cb, PAT_CHECK);
          const h3 = hash(k, i, sd + 13);
          this.slabQuad(fb, sd * xa, ha, sd * (xa + tw), ha + th, zm, z1, CROWD[Math.floor(h3 * CROWD.length)], ca, PAT_CHECK);
        }
        // concrete riser line under each tier
        this.wallQuad(fb, sd * xa, ha - 0.35, ha, z0, z1, (k & 1) ? C.stand0 : C.stand1);
      }
      // back facade
      const xb = WX + 21.5;
      this.wallQuad(fb, sd * xb, 13.4, 15, z0, z1, (k & 1) ? C.facade : C.facadeShade);
      // roof on the left side grandstand
      if (sd < 0) {
        this.slabQuad(fb, -(WX + 0.5), 16.2, -(xb + 1), 17, z0, z1, (k & 1) ? C.roof : C.roofBeam);
        this.wallQuad(fb, -(WX + 0.5), 15.6, 16.4, z0, z1, C.roofEdge);
        if (k % 6 === 0 && !clipped) this.post(fb, -(xb + 0.2), 13.4, 16.3, z0, 0.5, C.facadeShade);
      }
    } else if (k % 40 === 1) {
      // light tower in the gap
      if (!clipped) {
        this.post(fb, sd * (WX + 6), 0, 18, z0, 0.6, C.post);
        const [x, y] = this.P(sd * (WX + 6), 18, z0);
        const s = VIEW.depth / z0;
        fb.fillRect(x - 1.5 * s, y - 1.2 * s, 3 * s, 1.4 * s, C.grey1);
        fb.fillRect(x - 1.3 * s, y - 1.0 * s, 2.6 * s, 1.0 * s, C.cloud, C.grey4, PAT_CHECK);
      }
    }

    // --- barrier wall ---
    this.wallQuad(fb, sd * WX, 0, TRACK.wallH * 0.82, z0, z1, (k & 1) ? C.wallRed0 : C.wallRed1);
    this.wallQuad(fb, sd * WX, TRACK.wallH * 0.82, TRACK.wallH, z0, z1, C.wallTop);
    // advertising boards on the wall every 120 m (fictional brand only)
    if (k % 30 === 5 || k % 30 === 6) {
      this.wallQuad(fb, sd * WX, 0.12, TRACK.wallH * 0.78, z0, z1, (k & 1) ? C.bannerBg : C.bannerEdge);
    }

    // --- catch fence ---
    const FH = TRACK.fenceH;
    this.wallQuad(fb, sd * WX, TRACK.wallH, FH, z0, z1, C.fence, 0, PAT_MESH);
    // horizontal cables
    const a = this.P(sd * WX, FH, z0), b = this.P(sd * WX, FH, z1);
    fb.line(a[0], a[1], b[0], b[1], C.grey1);
    const c = this.P(sd * WX, 2.6, z0), d = this.P(sd * WX, 2.6, z1);
    fb.line(c[0], c[1], d[0], d[1], C.grey3);
    // overhang (fence leans towards the track at the top)
    const lean = sd * (WX - 0.9);
    this.slabQuad(fb, sd * WX, FH, lean, FH + 0.7, z0, z1, C.fence, 0, PAT_MESH);
    // posts every 8 m
    if (!clipped && (k & 1) === 0) {
      this.post(fb, sd * WX, 0.6, FH, z0, 0.16, C.post, C.postHi);
      const p = this.P(sd * WX, FH, z0), q = this.P(lean, FH + 0.7, z0);
      const w = Math.max(1, (0.16 * VIEW.depth) / z0);
      for (let i = 0; i < w; i++) fb.line(p[0] + i, p[1], q[0] + i, q[1], C.post);
    }
  }

  post(fb, wx, h0, h1, z, width, c, hi) {
    const s = VIEW.depth / z;
    const [x, y0] = this.P(wx, h0, z);
    const [, y1] = this.P(wx, h1, z);
    const w = Math.max(1, width * s);
    fb.fillRect(x - w / 2, y1, w, y0 - y1, c);
    if (hi !== undefined && w >= 3) fb.fillRect(x - w / 2, y1, Math.max(1, w / 3), y0 - y1, hi);
  }

  drawGantry(fb, z, index) {
    if (z <= VIEW.nearZ + 0.5) return;
    const legX = 10.2, top = 8.4, bot = 5.6;
    this.post(fb, -legX, 0, top + 0.3, z, 0.5, C.gantry, C.grey1);
    this.post(fb, legX, 0, top + 0.3, z, 0.5, C.gantry, C.grey1);
    const [x0, y0] = this.P(-legX, top + 0.3, z);
    const [x1, y1] = this.P(legX, bot - 0.2, z);
    fb.fillRect(x0, y0, x1 - x0, y1 - y0, C.gantry);
    const [bx0, by0] = this.P(-9.6, top, z);
    const [bx1, by1] = this.P(9.6, bot, z);
    fb.blitScaled(index % 3 === 2 ? this.bannerSmall : this.banner, bx0, by0, bx1 - bx0, by1 - by0);
  }
}
