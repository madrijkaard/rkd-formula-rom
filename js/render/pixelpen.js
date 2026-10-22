// Crisp pixel drawing on a full-resolution 2D canvas using a coordinate space of
// "art pixels" (here: the cockpit image's native 1280x720 pixels). Every rectangle is
// snapped to whole device pixels so nothing gets anti-aliased.
import { FONT_BIG } from './font.js';

export class PixelPen {
  constructor(ctx) {
    this.ctx = ctx;
    this.set(1, 0, 0);
  }

  // canvas = offset + art * scale
  set(scale, ox, oy) {
    this.s = scale;
    this.ox = ox;
    this.oy = oy;
  }

  rect(x, y, w, h, color) {
    const { s, ox, oy } = this;
    const x0 = Math.round(ox + x * s), y0 = Math.round(oy + y * s);
    const x1 = Math.round(ox + (x + w) * s), y1 = Math.round(oy + (y + h) * s);
    if (x1 <= x0 || y1 <= y0) return;
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  }

  // Text in the 5x7 bitmap font. px/py = size of one font pixel in art pixels.
  textWidth(str, px, spacing = 1) {
    return str.length ? (str.length * (FONT_BIG.w + spacing) - spacing) * px : 0;
  }

  text(str, x, y, { px = 3, py = px, color = '#fff', outline = null, ow = 2, align = 'left', spacing = 1 } = {}) {
    const w = this.textWidth(str, px, spacing);
    if (align === 'right') x -= w;
    else if (align === 'center') x -= w / 2;
    const passes = outline ? [[outline, ow], [color, 0]] : [[color, 0]];
    for (const [col, grow] of passes) {
      let cx = x;
      for (const ch of str) {
        const g = FONT_BIG.glyphs[ch.toUpperCase()] || FONT_BIG.glyphs[' '];
        for (let r = 0; r < FONT_BIG.h; r++) {
          for (let c = 0; c < FONT_BIG.w; c++) {
            if (g[r][c]) this.rect(cx + c * px - grow, y + r * py - grow, px + grow * 2, py + grow * 2, col);
          }
        }
        cx += (FONT_BIG.w + spacing) * px;
      }
    }
    return w;
  }
}
