// Global constants for the prototype. World units are metres, time in seconds.
export const SCREEN_W = 384;
export const SCREEN_H = 216;

export const VIEW = {
  horizon: 89,       // screen row of the horizon (matches the cockpit image)
  depth: 160,        // projection distance in pixels (sets the field of view)
  camHeight: 1.0,    // driver eye height above the asphalt
  nearZ: 0.3,        // near clipping distance
};

export const TRACK = {
  layout: 'suzuka',  // 'straight' restores the original scenery renderer
  roadHalf: 6.0,     // half width of the asphalt
  lineW: 0.25,       // white edge line width
  kerbW: 1.2,        // kerb width
  grassW: 1.3,       // artificial grass strip
  wallX: 10.5,       // barrier wall / catch fence distance from centre
  wallH: 1.0,
  fenceH: 4.2,
  segLen: 4,         // length of one scenery segment
  drawSegs: 60,      // number of segments drawn (draw distance = segLen * drawSegs)
  lapLength: 5807,   // Suzuka GP lap length in metres
  bannerEvery: 400,  // overhead banner gantry spacing
};

export const CAR = {
  vmax: 330 / 3.6,   // m/s
  accel: 14,         // m/s^2 at low speed
  brake: 32,         // m/s^2
  coastBase: 0.35,   // m/s^2 rolling resistance
  coastDrag: 0.00022, // aero drag coefficient (a = k * v^2)
  lateral: 9,        // m/s lateral speed at full lock
  halfWidth: 1.0,    // car half width, used for track limits
  steerRate: 3.5,    // how fast the steering follows the (digital) input (1/s)
  // upper speed (km/h) of each gear 1..8
  gearTop: [90, 130, 165, 200, 235, 270, 300, 335],
  idleRpm: 4000,
  maxRpm: 12000,
};

export const FIXED_DT = 1 / 120;

// Cockpit overlay image native size; HUD and dash coordinates
// are expressed in these pixels.
// Rounded recesses with the reference Ferrari white/red/carbon palette.
// Previous cockpit.png and cockpit-rounded.png variants remain available.
export const COCKPIT = { src: 'assets/cockpit-ferrari.png', w: 1280, h: 720 };

// Front tyre surface animation; disable to restore the static cockpit artwork.
export const TIRES = {
  animated: true,
  steering: true,    // set false to restore the previous fixed tyre silhouettes
  steerMaxDeg: 7,    // outward yaw of the tyre on the side of the turn
  steerInwardRatio: 0.75, // opposite tyre turns inward with a slightly smaller angle
  radius: 0.36,       // rolling radius in metres
  blurStart: 35 / 3.6,
  blurFull: 210 / 3.6,
};

// Pilot artwork (same width, extends below the screen). At load time the legs
// become a fixed layer; only the wheel and hands rotate around the column axis.
// screen: the wheel display region repainted every frame before the live dash is drawn.
export const WHEEL = {
  src: 'assets/wheel_hands-hp-clean.png', w: 1280, h: 800,
  visible: true,      // set false to hide wheel + hands; legs stay visible
  pivotX: 640, pivotY: 503,
  maxDeg: 7.0,        // full lock = 7.0 degrees, a light turn
  follow: 14,         // 1/s, extra smoothing of the displayed angle
  screen: [540, 440, 200, 125],
};
