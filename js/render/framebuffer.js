// Software framebuffer with simple pixel-art rasterisation primitives.
// Coordinates passed to the primitives are absolute screen coordinates;
// (ox, oy) is where this buffer's top-left pixel sits in screen space, so a
// small sprite buffer can be drawn into using the same coordinates as the screen.
export const PAT_SOLID = 0;
export const PAT_CHECK = 1;   // 1x1 checker dither of c / c2
export const PAT_MESH = 2;    // diagonal chain-link mesh, draws only c

export class Framebuffer {
  constructor(w, h, ox = 0, oy = 0) {
    this.w = w;
    this.h = h;
    this.ox = ox;
    this.oy = oy;
    this.buf = new ArrayBuffer(w * h * 4);
    this.px = new Uint32Array(this.buf);
    this.bytes = new Uint8ClampedArray(this.buf);
    this._xs = new Float64Array(64);
  }

  clear(c = 0) { this.px.fill(c); }

  pset(x, y, c) {
    x = Math.floor(x) - this.ox;
    y = Math.floor(y) - this.oy;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.px[y * this.w + x] = c;
  }

  // Fill pixels of row y whose centres lie in [xa, xb).
  span(y, xa, xb, c, c2 = 0, pat = PAT_SOLID) {
    const yy = y - this.oy;
    if (yy < 0 || yy >= this.h) return;
    let x0 = Math.ceil(xa - 0.5) - this.ox;
    let x1 = Math.ceil(xb - 0.5) - this.ox;
    if (x0 < 0) x0 = 0;
    if (x1 > this.w) x1 = this.w;
    if (x1 <= x0) return;
    const row = yy * this.w;
    const px = this.px;
    if (pat === PAT_SOLID) {
      px.fill(c, row + x0, row + x1);
    } else if (pat === PAT_CHECK) {
      for (let x = x0; x < x1; x++) px[row + x] = ((x + this.ox + y) & 1) ? c2 : c;
    } else if (pat === PAT_MESH) {
      for (let x = x0; x < x1; x++) {
        const ax = x + this.ox;
        if (((ax + y) & 3) === 0 || ((ax - y) & 3) === 0) px[row + x] = c;
      }
    }
  }

  fillRect(x, y, w, h, c, c2 = 0, pat = PAT_SOLID) {
    if (w < 1) { x = x + w / 2 - 0.5; w = 1; }
    if (h < 1) { y = y + h / 2 - 0.5; h = 1; }
    const y0 = Math.ceil(y - 0.5), y1 = Math.ceil(y + h - 0.5);
    for (let yy = y0; yy < y1; yy++) this.span(yy, x, x + w, c, c2, pat);
  }

  // Even-odd scanline polygon fill. pts = [x0, y0, x1, y1, ...]
  fillPoly(pts, c, c2 = 0, pat = PAT_SOLID) {
    const n = pts.length >> 1;
    let minY = Infinity, maxY = -Infinity;
    for (let i = 1; i < pts.length; i += 2) {
      if (pts[i] < minY) minY = pts[i];
      if (pts[i] > maxY) maxY = pts[i];
    }
    const y0 = Math.max(Math.ceil(minY - 0.5), this.oy);
    const y1 = Math.min(Math.ceil(maxY - 0.5), this.oy + this.h);
    const xs = this._xs;
    for (let y = y0; y < y1; y++) {
      const sy = y + 0.5;
      let cnt = 0;
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        const ax = pts[i * 2], ay = pts[i * 2 + 1], bx = pts[j * 2], by = pts[j * 2 + 1];
        if ((ay <= sy && by > sy) || (by <= sy && ay > sy)) {
          xs[cnt++] = ax + ((sy - ay) * (bx - ax)) / (by - ay);
        }
      }
      for (let i = 1; i < cnt; i++) {
        const v = xs[i];
        let k = i - 1;
        while (k >= 0 && xs[k] > v) { xs[k + 1] = xs[k]; k--; }
        xs[k + 1] = v;
      }
      for (let k = 0; k + 1 < cnt; k += 2) this.span(y, xs[k], xs[k + 1], c, c2, pat);
    }
  }

  fillCircle(cx, cy, r, c, c2 = 0, pat = PAT_SOLID) {
    const y0 = Math.ceil(cy - r - 0.5), y1 = Math.ceil(cy + r - 0.5);
    for (let y = y0; y < y1; y++) {
      const dy = y + 0.5 - cy;
      const hw = Math.sqrt(Math.max(0, r * r - dy * dy));
      this.span(y, cx - hw, cx + hw, c, c2, pat);
    }
  }

  line(x0, y0, x1, y1, c) {
    x0 = Math.floor(x0); y0 = Math.floor(y0); x1 = Math.floor(x1); y1 = Math.floor(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    let guard = 4096;
    while (guard--) {
      this.pset(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }

  // Nearest-neighbour scaled copy of the whole src into the rect (x, y, w, h).
  blitScaled(src, x, y, w, h) {
    if (w <= 0 || h <= 0) return;
    const x0 = Math.max(Math.ceil(x - 0.5), this.ox), x1 = Math.min(Math.ceil(x + w - 0.5), this.ox + this.w);
    const y0 = Math.max(Math.ceil(y - 0.5), this.oy), y1 = Math.min(Math.ceil(y + h - 0.5), this.oy + this.h);
    const s = src.px, d = this.px;
    for (let yy = y0; yy < y1; yy++) {
      const sy = Math.min(src.h - 1, Math.floor(((yy + 0.5 - y) / h) * src.h));
      const drow = (yy - this.oy) * this.w - this.ox;
      for (let xx = x0; xx < x1; xx++) {
        const sx = Math.min(src.w - 1, Math.floor(((xx + 0.5 - x) / w) * src.w));
        const c = s[sy * src.w + sx];
        if (c >>> 24) d[drow + xx] = c;
      }
    }
  }
}
