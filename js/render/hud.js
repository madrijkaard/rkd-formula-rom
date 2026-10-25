// HUD overlay in the pixel font. Coordinates are cockpit-image native pixels
// (1280x720): lap top-left, minimap top-right, position bottom-left, speed bottom-right.
import { TRACK } from '../config.js';
import { mapPoints, sampleTrack, trackSection, crossover, LAP_LENGTH } from '../game/track.js';

const WHITE = '#ffffff', BLACK = '#000000', YELLOW = '#f0c020', RED = '#e02020';
const MAP = { x: 1005, y: 25, w: 255, h: 180 };
const bounds={minX:Math.min(...mapPoints.map(p=>p.x)),maxX:Math.max(...mapPoints.map(p=>p.x)),
  minZ:Math.min(...mapPoints.map(p=>p.z)),maxZ:Math.max(...mapPoints.map(p=>p.z))};
const mapScale=Math.min(222/(bounds.maxX-bounds.minX),112/(bounds.maxZ-bounds.minZ));
const mapLeft=MAP.x+12+(230-(bounds.maxX-bounds.minX)*mapScale)/2;
const mapPosition=p=>[mapLeft+(p.x-bounds.minX)*mapScale,MAP.y+38+(bounds.maxZ-p.z)*mapScale];
const mini=mapPoints.map(mapPosition);
const CYAN='#5ee8ef';

function positionMarker(pen,x,y,dx,dy) {
  // A direction pointer and a high-contrast centre remain visible on both
  // the pale track and its dark crossing, without ever blinking the car away.
  const tipX=x+dx*15,tipY=y+dy*15;
  pen.line(x,y,tipX,tipY,BLACK,7);
  pen.line(x,y,tipX,tipY,YELLOW,3);
  for(const side of [-1,1]) {
    const tx=tipX-dx*5-dy*side*4,ty=tipY-dy*5+dx*side*4;
    pen.line(tx,ty,tipX,tipY,BLACK,7);
    pen.line(tx,ty,tipX,tipY,YELLOW,3);
  }
  pen.rect(x-8,y-8,16,16,BLACK);
  pen.rect(x-6,y-6,12,12,WHITE);
  pen.rect(x-4,y-4,8,8,RED);
}

function suzukaHud(pen, car) {
  const p=sampleTrack(car.z);
  pen.text('SUZUKA',640,23,{px:3,outline:BLACK,align:'center'});
  pen.text(trackSection(car.z),640,53,{px:2.2,outline:BLACK,align:'center'});
  const grade=Math.round(p.grade*100);
  pen.text(`${grade>0?'UP':grade<0?'DOWN':'LEVEL'} ${Math.abs(grade)}%`,640,75,
    {px:1.8,color:YELLOW,outline:BLACK,align:'center'});
  pen.rect(MAP.x,MAP.y,MAP.w,MAP.h,'#10141b');
  pen.text('SUZUKA  5.807 KM',MAP.x+12,MAP.y+11,{px:1.7,color:WHITE});
  const progress=p.d/LAP_LENGTH;
  for(let i=0;i<mini.length;i++) {
    const a=mini[i],b=mini[(i+1)%mini.length];
    pen.line(...a,...b,BLACK,6);
  }
  for(let i=0;i<mini.length;i++) {
    const a=mini[i],b=mini[(i+1)%mini.length];
    pen.line(...a,...b,(i+1)/mini.length<=progress?CYAN:WHITE,3);
  }
  // Show the upper branch of the figure eight with an outlined short bridge.
  const a=mapPosition(sampleTrack(crossover.upper-45)), b=mapPosition(sampleTrack(crossover.upper+45));
  pen.line(...a,...b,BLACK,7);pen.line(...a,...b,YELLOW,3);
  const start=mapPosition(sampleTrack(0));
  for(let row=0;row<2;row++)for(let col=0;col<3;col++) {
    pen.rect(start[0]-4.5+col*3,start[1]-3+row*3,3,3,(row+col)&1?BLACK:WHITE);
  }
  const dot=mapPosition({x:p.x+p.rx*car.x,z:p.z+p.rz*car.x});
  const yaw=car.headingError || 0, c=Math.cos(yaw), s=Math.sin(yaw);
  positionMarker(pen,...dot,p.tx*c+p.rx*s,-(p.tz*c+p.rz*s));
  const labelX=Math.max(MAP.x+12,Math.min(MAP.x+202,dot[0]+12));
  const labelY=Math.max(MAP.y+33,Math.min(MAP.y+138,dot[1]-22));
  pen.text('VOCE',labelX,labelY,{px:1.6,color:YELLOW,outline:BLACK,ow:2});
  pen.rect(MAP.x+12,MAP.y+164,8,8,RED);
  pen.text('VOCE',MAP.x+26,MAP.y+164,{px:1.6,color:WHITE});
  pen.text(`${Math.floor(progress*100)}% DA VOLTA`,MAP.x+241,MAP.y+164,{px:1.5,color:CYAN,align:'right'});
}

export function drawHud(pen, car) {
  const lap = Math.floor(car.z / TRACK.lapLength) + 1;
  pen.text('LAP', 31, 25, { px: 4, py: 3.5, outline: BLACK });
  pen.text(String(lap), 31, 60, { px: 6, py: 5.5, outline: BLACK });

  pen.text('POS', 31, 604, { px: 4, py: 3.5, outline: BLACK });
  pen.text('1/1', 31, 639, { px: 6, py: 5.5, outline: BLACK });

  pen.text(String(Math.round(car.kmh)), 1186, 625, { px: 6, py: 7, outline: BLACK, align: 'right' });
  pen.text('KM/H', 1258, 654, { px: 3, outline: BLACK, align: 'right' });

  if (TRACK.layout === 'suzuka') {
    suzukaHud(pen, car);
    return;
  }

  // minimap: straight track with start/finish line and the car dot
  const x = 1198, top = 58, bottom = 181;
  pen.rect(x - 7, top - 3, 14, bottom - top + 6, BLACK);
  pen.rect(x - 4, top, 8, bottom - top, WHITE);
  pen.rect(x - 11, bottom - 16, 22, 4, BLACK);
  pen.rect(x - 9, bottom - 15, 18, 2, YELLOW);
  const prog = (car.z % TRACK.lapLength) / TRACK.lapLength;
  const dy = bottom - 14 - prog * (bottom - top - 24);
  const dx = x + (car.x / TRACK.roadHalf) * 3;
  positionMarker(pen,dx,dy,0,-1);
  pen.text('VOCE',x+15,dy-5,{px:2,color:YELLOW,outline:BLACK});
}
