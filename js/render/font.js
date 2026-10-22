// Tiny 5x7 bitmap font for the HUD, wheel display and banners.
const BIG_SRC = {
  A: '01110 10001 10001 11111 10001 10001 10001', B: '11110 10001 10001 11110 10001 10001 11110',
  C: '01110 10001 10000 10000 10000 10001 01110', D: '11110 10001 10001 10001 10001 10001 11110',
  E: '11111 10000 10000 11110 10000 10000 11111', F: '11111 10000 10000 11110 10000 10000 10000',
  G: '01110 10001 10000 10111 10001 10001 01111', H: '10001 10001 10001 11111 10001 10001 10001',
  I: '01110 00100 00100 00100 00100 00100 01110', J: '00111 00010 00010 00010 00010 10010 01100',
  K: '10001 10010 10100 11000 10100 10010 10001', L: '10000 10000 10000 10000 10000 10000 11111',
  M: '10001 11011 10101 10101 10001 10001 10001', N: '10001 10001 11001 10101 10011 10001 10001',
  O: '01110 10001 10001 10001 10001 10001 01110', P: '11110 10001 10001 11110 10000 10000 10000',
  Q: '01110 10001 10001 10001 10101 10010 01101', R: '11110 10001 10001 11110 10100 10010 10001',
  S: '01111 10000 10000 01110 00001 00001 11110', T: '11111 00100 00100 00100 00100 00100 00100',
  U: '10001 10001 10001 10001 10001 10001 01110', V: '10001 10001 10001 10001 10001 01010 00100',
  W: '10001 10001 10001 10101 10101 10101 01010', X: '10001 10001 01010 00100 01010 10001 10001',
  Y: '10001 10001 01010 00100 00100 00100 00100', Z: '11111 00001 00010 00100 01000 10000 11111',
  0: '01110 10001 10011 10101 11001 10001 01110', 1: '00100 01100 00100 00100 00100 00100 01110',
  2: '01110 10001 00001 00010 00100 01000 11111', 3: '11111 00010 00100 00010 00001 10001 01110',
  4: '00010 00110 01010 10010 11111 00010 00010', 5: '11111 10000 11110 00001 00001 10001 01110',
  6: '00110 01000 10000 11110 10001 10001 01110', 7: '11111 00001 00010 00100 01000 01000 01000',
  8: '01110 10001 10001 01110 10001 10001 01110', 9: '01110 10001 10001 01111 00001 00010 01100',
  '/': '00001 00001 00010 00100 01000 10000 10000', '.': '00000 00000 00000 00000 00000 01100 01100',
  '-': '00000 00000 00000 11111 00000 00000 00000', ':': '00000 01100 01100 00000 01100 01100 00000',
  ' ': '00000 00000 00000 00000 00000 00000 00000',
};

function compile(src) {
  const out = {};
  for (const ch in src) out[ch] = src[ch].split(' ').map((r) => [...r].map((b) => b === '1'));
  return out;
}

export const FONT_BIG = { glyphs: compile(BIG_SRC), w: 5, h: 7 };

export function measureText(text, { font = FONT_BIG, scale = 1, spacing = 1 } = {}) {
  if (!text.length) return 0;
  return (text.length * (font.w + spacing) - spacing) * scale;
}

function drawGlyphs(fb, text, x, y, color, font, scale, spacing, skew) {
  let cx = x;
  for (let i = 0; i < text.length; i++) {
    const g = font.glyphs[text[i].toUpperCase()] || font.glyphs[' '];
    const gy = y + Math.round(i * skew);
    if (g) {
      for (let r = 0; r < font.h; r++) {
        for (let c = 0; c < font.w; c++) {
          if (g[r][c]) fb.fillRect(cx + c * scale, gy + r * scale, scale, scale, color);
        }
      }
    }
    cx += (font.w + spacing) * scale;
  }
}

// Draw text with optional 1px outline. skew = vertical pixels per character (slanted text).
export function drawText(fb, text, x, y, color, opts = {}) {
  const { font = FONT_BIG, scale = 1, spacing = 1, outline = null, align = 'left', skew = 0 } = opts;
  const w = measureText(text, { font, scale, spacing });
  if (align === 'right') x -= w;
  else if (align === 'center') x -= Math.floor(w / 2);
  if (outline !== null) {
    for (let oy = -1; oy <= 1; oy++) {
      for (let ox = -1; ox <= 1; ox++) {
        if (ox || oy) drawGlyphs(fb, text, x + ox, y + oy, outline, font, scale, spacing, skew);
      }
    }
  }
  drawGlyphs(fb, text, x, y, color, font, scale, spacing, skew);
  return w;
}
