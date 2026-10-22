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
  roadHalf: 6.0,     // half width of the asphalt
  lineW: 0.25,       // white edge line width
  kerbW: 1.2,        // kerb width
  grassW: 1.3,       // artificial grass strip
  wallX: 10.5,       // barrier wall / catch fence distance from centre
  wallH: 1.0,
  fenceH: 4.2,
  segLen: 4,         // length of one scenery segment
  drawSegs: 60,      // number of segments drawn (draw distance = segLen * drawSegs)
  lapLength: 5000,   // virtual lap length used by the HUD
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

// Cockpit overlay image (assets/cockpit.png) native size; HUD and dash coordinates
// are expressed in these pixels.
export const COCKPIT = { src: 'assets/cockpit.png', w: 1280, h: 720 };

// Steering wheel + hands layer (assets/wheel_hands.png, same width, extends below the
// screen). It rotates around the wheel display centre / steering column axis.
// screen: the wheel display region repainted every frame before the live dash is drawn.
export const WHEEL = {
  src: 'assets/wheel_hands.png', w: 1280, h: 800,
  visible: true,      // set false to hide wheel + hands
  pivotX: 640, pivotY: 503,
  maxDeg: 7.0,        // full lock = 7.0 degrees, a light turn
  follow: 14,         // 1/s, extra smoothing of the displayed angle
  screen: [540, 440, 200, 125],
};
