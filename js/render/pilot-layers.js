// The pilot artwork contains both thighs below the wheel. Separate them once at
// load time, keeping the original pixels and the 1280x800 art coordinate system.
const LEG_OUTLINE = [
  [447,657], [466,670], [482,691], [498,698], [625,696], [640,697],
  [655,696], [780,698], [795,691], [810,670], [829,657], [846,699],
  [890,800], [386,800], [430,699],
];

function insideLegs(x, y) {
  let inside = false;
  for (let i = 0, j = LEG_OUTLINE.length - 1; i < LEG_OUTLINE.length; j = i++) {
    const [ax, ay] = LEG_OUTLINE[i], [bx, by] = LEG_OUTLINE[j];
    if ((ay > y) !== (by > y) && x < (bx - ax) * (y - ay) / (by - ay) + ax) inside = !inside;
  }
  return inside;
}

export function splitPilotPixels(source, width, height) {
  const wheel = new Uint8ClampedArray(source);
  const legs = new Uint8ClampedArray(source.length);
  const tops = new Int32Array(width).fill(-1);
  for (let y = 657; y < height; y++) {
    for (let x = 386; x < Math.min(890, width); x++) {
      if (!insideLegs(x + 0.5, y + 0.5)) continue;
      const i = (y * width + x) * 4;
      legs.set(source.subarray(i, i + 4), i);
      wheel[i + 3] = 0;
      if (tops[x] < 0 && source[i + 3] === 255) tops[x] = y;
    }
  }
  // Continue the thigh fabric a little way under the opaque wheel. A turned wheel
  // can reveal it without opening a gap; at 0 degrees the source looks identical.
  for (let x = 386; x < Math.min(890, width); x++) {
    const top = tops[x];
    if (top < 0) continue;
    // Sample inside the cloth, below the dark wheel rim at the split boundary.
    const sample = (Math.min(height - 1, top + 16) * width + x) * 4;
    for (let y = Math.max(0, top - 32); y < top; y++) {
      const i = (y * width + x) * 4;
      if (wheel[i + 3] === 255) legs.set(source.subarray(sample, sample + 4), i);
    }
  }
  return { wheel, legs };
}

export function splitPilotLayers(image, width, height, makeCanvas = () => document.createElement('canvas')) {
  const source = makeCanvas();
  source.width = width;
  source.height = height;
  const ctx = source.getContext('2d');
  ctx.drawImage(image, 0, 0);
  const pixels = ctx.getImageData(0, 0, width, height);
  const split = splitPilotPixels(pixels.data, width, height);
  const layers = {};
  for (const name of ['wheel', 'legs']) {
    const canvas = makeCanvas();
    canvas.width = width;
    canvas.height = height;
    const target = canvas.getContext('2d');
    const data = target.createImageData(width, height);
    data.data.set(split[name]);
    target.putImageData(data, 0, 0);
    layers[name] = canvas;
  }
  return layers;
}
