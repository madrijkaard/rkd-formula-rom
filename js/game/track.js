// Suzuka GP: hand-traced centreline from the supplied map, not survey/GPS data.
// Elevation shape: Suzuka's official July 2026 course guide; range scaled to
// the 52 m published by Super Formula. See README for sources and limitations.
export const LAP_LENGTH = 5807;

// Map coordinates preserve the reference's orientation. Third field marks an apex.
const TRACE = [
  [690,210], [737,267], [793,337], [843,399],
  [864,427,1], [868,447], [859,473], [847,484,2], [832,481], [818,466],
  [795,428], [782,409,3], [768,401], [744,398], [732,390],
  [722,373,4], [717,352], [708,338,5], [695,331], [673,329], [656,323],
  [641,311,6], [638,293], [647,268], [648,246], [639,230],
  [620,218], [596,209,7], [569,208], [546,215], [529,228],
  [503,255], [481,280], [473,287,8], [454,289], [422,291],
  [410,289,9], [403,281], [398,252], [389,202], [382,166,10],
  [386,140], [396,116], [394,109,11], [387,106], [380,112],
  [364,139], [344,164], [325,178], [300,187], [272,188,12],
  [242,184], [217,176], [196,166], [179,152], [165,132], [151,104],
  [142,76], [132,58,13], [118,53], [99,55], [84,66,14], [78,81],
  [82,96], [95,112], [122,134], [157,158], [201,185], [253,211],
  [308,233], [365,251], [397,260], [419,263,15], [446,259], [468,248],
  [495,227], [523,202], [547,181], [558,170,16], [566,177],
  [572,182,17], [581,177], [593,167], [609,158], [626,157,18],
  [643,163], [659,177], [673,190],
];

const TURN_NAMES = ['', 'FIRST CURVE', 'SECOND CURVE', 'S CURVES', 'S CURVES',
  'S CURVES', 'GYAKU BANK', 'DUNLOP', 'DEGNER 1', 'DEGNER 2',
  '110R', 'HAIRPIN', '200R', 'SPOON 1', 'SPOON 2', '130R',
  'CASIO TRIANGLE', 'CASIO TRIANGLE', 'FINAL CURVE'];

// [lap fraction, relative height in metres]. The interpolation is monotone
// between knots, with periodic derivatives at the start/finish seam.
const HEIGHTS = [[0,18],[0.14,0],[0.19,9],[0.22,20],[0.239,18],
  [0.27,34],[0.31,43],[0.33,42],[0.39,36],[0.423,34],[0.44,34],
  [0.49,51],[0.51,52],[0.54,45],[0.59,52],[0.635,52],[0.68,36],
  [0.75,44],[0.85,44],[0.89,48],[0.925,49],[0.96,32],[1,18]];

export const wrapDistance = d => ((d % LAP_LENGTH) + LAP_LENGTH) % LAP_LENGTH;
const mix = (a,b,t) => a + (b-a)*t;

function elevation(f) {
  let i = 0;
  while (i < HEIGHTS.length - 2 && f > HEIGHTS[i+1][0]) i++;
  const a = HEIGHTS[i], b = HEIGHTS[i+1], n = HEIGHTS.length - 1;
  const slope = k => {
    const prev = k === 0 ? [HEIGHTS[n-1][0]-1,HEIGHTS[n-1][1]] : HEIGHTS[k-1];
    const next = k === n ? [HEIGHTS[1][0]+1,HEIGHTS[1][1]] : HEIGHTS[k+1];
    const cur = HEIGHTS[k];
    const l = (cur[1]-prev[1])/(cur[0]-prev[0]);
    const r = (next[1]-cur[1])/(next[0]-cur[0]);
    return l*r <= 0 ? 0 : 2*l*r/(l+r);
  };
  const span = b[0]-a[0], t = (f-a[0])/span, t2=t*t, t3=t2*t;
  return (2*t3-3*t2+1)*a[1] + (t3-2*t2+t)*span*slope(i)
    + (-2*t3+3*t2)*b[1] + (t3-t2)*span*slope(i+1);
}

// Centripetal Catmull-Rom avoids loops/overshoot at the tight hairpin and chicane.
function spline(index, u) {
  const count = TRACE.length;
  const p = [-1,0,1,2].map(k => TRACE[(index+k+count)%count]);
  const knots = [0];
  for(let k=1;k<4;k++) knots.push(knots[k-1]+Math.sqrt(Math.hypot(p[k][0]-p[k-1][0],p[k][1]-p[k-1][1])));
  const t = mix(knots[1],knots[2],u);
  const blend = (a,b,ta,tb) => [mix(a[0],b[0],(t-ta)/(tb-ta)),mix(a[1],b[1],(t-ta)/(tb-ta))];
  const a1=blend(p[0],p[1],knots[0],knots[1]), a2=blend(p[1],p[2],knots[1],knots[2]), a3=blend(p[2],p[3],knots[2],knots[3]);
  return blend(blend(a1,a2,knots[0],knots[2]),blend(a2,a3,knots[1],knots[3]),knots[1],knots[2]);
}

const raw = [], apexDistances = [];
let rawLength=0;
for(let i=0;i<TRACE.length;i++) {
  for(let j=0;j<24;j++) {
    const p=spline(i,j/24), prev=raw.at(-1);
    if(prev) rawLength+=Math.hypot(p[0]-prev.x,p[1]-prev.z);
    raw.push({x:p[0],z:p[1],d:rawLength});
    if(j===0 && TRACE[i][2]) apexDistances.push({number:TRACE[i][2],d:rawLength});
  }
}
rawLength+=Math.hypot(raw[0].x-raw.at(-1).x,raw[0].z-raw.at(-1).z);
raw.push({...raw[0],d:rawLength});
const scale=LAP_LENGTH/rawLength;
export const corners=apexDistances.map(p=>({...p,d:p.d*scale,name:TURN_NAMES[p.number]}));

const COUNT=2048, STEP=LAP_LENGTH/COUNT;
const nodes=[];
let cursor=0;
for(let i=0;i<COUNT;i++) {
  const d=i/COUNT*rawLength;
  while(raw[cursor+1].d<d) cursor++;
  const a=raw[cursor], b=raw[cursor+1], f=(d-a.d)/(b.d-a.d);
  nodes.push({x:(mix(a.x,b.x,f)-TRACE[0][0])*scale,
    z:-(mix(a.z,b.z,f)-TRACE[0][1])*scale, y:elevation(i/COUNT)});
}
for(let i=0;i<COUNT;i++) {
  const a=nodes[(i-1+COUNT)%COUNT], b=nodes[(i+1)%COUNT], p=nodes[i];
  const len=Math.hypot(b.x-a.x,b.z-a.z);
  p.tx=(b.x-a.x)/len; p.tz=(b.z-a.z)/len;
  p.grade=(b.y-a.y)/(2*STEP);
}
for(let i=0;i<COUNT;i++) {
  const a=nodes[(i-2+COUNT)%COUNT], b=nodes[(i+2)%COUNT];
  nodes[i].curve=Math.atan2(a.tz*b.tx-a.tx*b.tz,a.tx*b.tx+a.tz*b.tz)/(4*STEP);
  const p=nodes[i],prev=nodes[i-1];
  p.heading=prev ? prev.heading+Math.atan2(prev.tz*p.tx-prev.tx*p.tz,prev.tx*p.tx+prev.tz*p.tz)
    : Math.atan2(p.tx,p.tz);
}

export function sampleTrack(distance) {
  const d=wrapDistance(distance), f=d/STEP, i=Math.floor(f), t=f-i;
  const a=nodes[i], b=nodes[(i+1)%COUNT];
  let tx=mix(a.tx,b.tx,t), tz=mix(a.tz,b.tz,t);
  const norm=Math.hypot(tx,tz); tx/=norm; tz/=norm;
  return {d,x:mix(a.x,b.x,t),z:mix(a.z,b.z,t),y:mix(a.y,b.y,t),
    tx,tz,rx:tz,rz:-tx,heading:mix(a.heading,b.heading,t),
    grade:mix(a.grade,b.grade,t),curve:mix(a.curve,b.curve,t)};
}

export function trackSection(distance) {
  const d=wrapDistance(distance);
  if(d<corners[0].d-180 || d>corners[17].d+85) return 'MAIN STRAIGHT';
  if(d>corners[13].d+110 && d<corners[14].d-110) return 'WEST STRAIGHT';
  const nearest=corners.reduce((a,b)=>Math.abs(b.d-d)<Math.abs(a.d-d)?b:a);
  return `T${nearest.number} ${nearest.name}`;
}

// Find the physical crossover between Degner exit and the west straight.
// Both surfaces share horizontal coordinates, but have different elevations.
function crossing() {
  const lowA=corners[8].d, lowB=corners[9].d;
  const highA=corners[13].d+150, highB=corners[14].d;
  let best={distance:Infinity};
  for(let a=lowA;a<lowB;a+=3) for(let b=highA;b<highB;b+=3) {
    const p=sampleTrack(a), q=sampleTrack(b), distance=Math.hypot(p.x-q.x,p.z-q.z);
    if(distance<best.distance) best={distance,lower:a,upper:b};
  }
  return best;
}
export const crossover=crossing();
export const mapPoints=Array.from({length:360},(_,i)=>sampleTrack(i/360*LAP_LENGTH));
