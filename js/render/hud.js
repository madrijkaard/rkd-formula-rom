// HUD overlay (lap, distance, position, speed, minimap) in the pixel font, positioned
// like the mockup. Coordinates are cockpit-image native pixels (1280x720).
import { TRACK } from '../config.js';

const WHITE = '#ffffff', BLACK = '#000000', YELLOW = '#f0c020', RED = '#e02020';

export function drawHud(pen, car) {
  const lap = Math.floor(car.z / TRACK.lapLength) + 1;
  pen.text('LAP', 31, 25, { px: 4, py: 3.5, outline: BLACK });
  pen.text(String(lap), 31, 60, { px: 6, py: 5.5, outline: BLACK });
  pen.text(`${(car.z / 1000).toFixed(2)}KM`, 31, 108, { px: 3, color: YELLOW, outline: BLACK, ow: 2 });

  pen.text('POS', 1248, 25, { px: 4, py: 3.5, outline: BLACK, align: 'right' });
  pen.text('1/1', 1250, 60, { px: 6, py: 5.5, outline: BLACK, align: 'right' });

  pen.text(String(Math.round(car.kmh)), 1186, 625, { px: 6, py: 7, outline: BLACK, align: 'right' });
  pen.text('KM/H', 1258, 654, { px: 3, outline: BLACK, align: 'right' });

  // minimap: straight track with start/finish line and the car dot
  const x = 58, top = 535, bottom = 658;
  pen.rect(x - 7, top - 3, 14, bottom - top + 6, BLACK);
  pen.rect(x - 4, top, 8, bottom - top, WHITE);
  pen.rect(x - 11, bottom - 16, 22, 4, BLACK);
  pen.rect(x - 9, bottom - 15, 18, 2, YELLOW);
  const prog = (car.z % TRACK.lapLength) / TRACK.lapLength;
  const dy = bottom - 14 - prog * (bottom - top - 24);
  const dx = x + (car.x / TRACK.roadHalf) * 3;
  pen.rect(dx - 7, dy - 7, 14, 14, BLACK);
  pen.rect(dx - 5, dy - 5, 10, 10, RED);
}
