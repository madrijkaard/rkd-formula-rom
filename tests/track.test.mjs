import test from 'node:test';
import assert from 'node:assert/strict';
import {LAP_LENGTH,sampleTrack,corners,crossover} from '../js/game/track.js';
import {TRACK,FIXED_DT} from '../js/config.js';
import {Car} from '../js/game/car.js';
import {RoadRaster} from '../js/render/road-raster.js';
import {Framebuffer} from '../js/render/framebuffer.js';
import {SuzukaRenderer} from '../js/render/suzuka.js';
import {C} from '../js/render/palette.js';

test('the 5807 m loop closes with continuous position, heading and grade',()=>{
  assert.equal(TRACK.lapLength,LAP_LENGTH);
  assert.equal(LAP_LENGTH,5807);
  assert.deepEqual(sampleTrack(0),sampleTrack(LAP_LENGTH));
  const a=sampleTrack(-0.01),b=sampleTrack(0.01);
  assert(Math.hypot(a.x-b.x,a.z-b.z)<0.025);
  assert(Math.hypot(a.tx-b.tx,a.tz-b.tz)<0.002);
  assert(Math.abs(a.grade-b.grade)<0.001);
  assert(Math.abs(a.heading-b.heading)<0.001);
  let length=0;
  for(let d=0;d<LAP_LENGTH;d++) {
    const p=sampleTrack(d),q=sampleTrack(Math.min(LAP_LENGTH,d+1));
    length+=Math.hypot(q.x-p.x,q.z-p.z);
  }
  assert(Math.abs(length-LAP_LENGTH)<5);
});

test('all 18 turns have the reference left/right sequence',()=>{
  const signs=[1,1,-1,1,-1,1,-1,1,1,1,-1,1,-1,-1,-1,1,-1,1];
  assert.equal(corners.length,18);
  corners.forEach((p,i)=>{
    assert.equal(p.number,i+1);
    assert.equal(Math.sign(sampleTrack(p.d).curve),signs[i],p.name);
  });
});

test('elevation spans 52 m and the crossover has a driveable underpass',()=>{
  const heights=Array.from({length:5808},(_,d)=>sampleTrack(d).y);
  assert(Math.max(...heights)>51.99);
  assert(Math.min(...heights)>=-0.001 && Math.min(...heights)<0.01);
  const lower=sampleTrack(crossover.lower),upper=sampleTrack(crossover.upper);
  assert(Math.hypot(lower.x-upper.x,lower.z-upper.z)<3);
  assert(upper.y-lower.y>7);
  assert(upper.y-lower.y<15);
});

test('curves are automatic and steering changes the lateral position',()=>{
  const a=new Car(), b=new Car();
  a.z=b.z=corners[0].d;a.v=b.v=40;b.steer=1;
  a.update(FIXED_DT,{steer:0,throttle:0,brake:0});
  b.update(FIXED_DT,{steer:1,throttle:0,brake:0});
  assert.equal(a.x,0);assert(b.x>a.x);
});

test('parked car stays still on hills and braking reaches rest',()=>{
  for(const d of [0,1000,2000,4000,5700]) {
    const car=new Car();car.z=d;
    car.update(FIXED_DT,{steer:0,throttle:0,brake:0});
    assert.equal(car.v,0);assert.equal(car.z,d);
    car.v=30;
    for(let i=0;i<300;i++)car.update(FIXED_DT,{steer:0,throttle:0,brake:1});
    assert.equal(car.v,0);
  }
});

test('road depth hides distant surfaces regardless of draw order',()=>{
  const fb=new Framebuffer(40,30),r=new RoadRaster(40,30,20,15);
  const face=z=>[[-3,-3,z],[3,-3,z],[3,3,z],[-3,3,z]];
  r.begin(fb);r.polygon(face(4),0xff0000ff);r.polygon(face(8),0xff00ff00);
  assert.equal(fb.px[15*40+20],0xff0000ff);
  r.begin(fb);r.polygon(face(8),0xff00ff00);r.polygon(face(4),0xff0000ff);
  assert.equal(fb.px[15*40+20],0xff0000ff);
  r.polygon([[-2,-1,-1],[2,-1,3],[0,2,3]],0xffffffff);
  assert(r.depth.every(z=>z===Infinity || Number.isFinite(z)&&z>0));
});

test('neighbouring terrain never covers the near road throughout the lap',()=>{
  const world=new SuzukaRenderer(),fb=new Framebuffer(384,216);
  for(let d=10;d<LAP_LENGTH-10;d+=25) {
    world.render(fb,{z:d,x:0},0);
    const color=fb.px[160*384+192];
    assert(color===C.asphalt0 || color===C.asphalt1,`Road hidden at ${d}m`);
  }
});

test('every tree crown clears the entire circuit, including neighbouring lanes',()=>{
  const world=new SuzukaRenderer();
  assert(world.trees.size>50,'Keep roadside scenery instead of hiding every tree');
  // Independently sample the authored centreline at 1 m, not the placement helper.
  const road=Array.from({length:LAP_LENGTH},(_,d)=>sampleTrack(d));
  for(const tree of world.trees.values()) {
    const clearance=TRACK.roadHalf+0.25+0.8+tree.radius+2;
    for(const p of road) {
      assert(Math.hypot(tree.x-p.x,tree.z-p.z)>=clearance-0.1,
        `Tree crown intrudes near ${p.d}m`);
    }
  }
});
