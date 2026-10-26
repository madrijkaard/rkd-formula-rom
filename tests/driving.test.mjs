import test from 'node:test';
import assert from 'node:assert/strict';
import {Car} from '../js/game/car.js';
import {CAR,TRACK,FIXED_DT as dt} from '../js/config.js';
import {corners,sampleTrack} from '../js/game/track.js';

const input=(steer=0,throttle=1)=>({steer,throttle,brake:0});
const limit=TRACK.roadHalf-CAR.halfWidth;

test('a correct arrow tap enables automatic following after releasing it at all 18 corners',()=>{
  for(const corner of corners) {
    const car=new Car();car.z=corner.d;car.v=15;
    car.update(dt,input(Math.sign(sampleTrack(car.z).curve)));
    assert.equal(car.assistedCorner,corner.number);
    car.update(dt,input());
    const x=car.x;
    for(let i=0;i<30;i++) {
      car.update(dt,input());
      assert.equal(car.x,x);
      assert.equal(car.headingError,0);
      assert.equal(car.contactSide,0);
      assert.equal(car.shake,0);
    }
  }
});

test('throttle alone drifts outward at every corner, without a penalty in the road centre',()=>{
  for(const corner of corners) {
    const car=new Car();car.z=corner.d;car.v=30;
    const sign=Math.sign(sampleTrack(car.z).curve);
    car.update(dt,input());
    assert(car.x*sign<0,`T${corner.number}: drift towards the outside`);
    assert.equal(car.shake,0);assert(car.v>30);
    assert.equal(car.assistedCorner,null);
  }
});

test('unassisted drift reaches the outside edge, shakes and slows gradually on left and right turns',()=>{
  for(const corner of [corners[0],corners[10]]) {
    const car=new Car();car.z=corner.d;car.v=30;
    const outside=-Math.sign(sampleTrack(car.z).curve);
    let previous;
    for(let i=0;i<600 && !car.contactSide;i++) {
      previous=car.v;car.update(dt,input());
    }
    assert.equal(car.contactSide,outside);assert(car.shake>0);
    assert(car.v>previous-1 && car.v<previous,'No instant stop');
    assert.equal(car.x,outside*limit);
    car.update(dt,input(-outside));
    assert.equal(car.contactSide,0);assert.equal(car.shake,0);
    assert(Math.abs(car.x)<limit);
  }
});

test('an arrow tap does not grant assistance to the next curve or the wrong direction',()=>{
  const car=new Car();car.z=corners[0].d;car.v=15;
  car.update(dt,input(-1));assert.equal(car.assistedCorner,null);
  car.update(dt,input(1));assert.equal(car.assistedCorner,1);
  car.z=corners[1].d;car.steer=0;
  const x=car.x;
  car.update(dt,input());
  assert.equal(car.assistedCorner,null);assert(car.x<x);
});

test('throttle alone on a straight does not drift or trigger a penalty',()=>{
  const car=new Car();
  for(let i=0;i<120;i++)car.update(dt,input());
  assert.equal(car.x,0);assert.equal(car.shake,0);assert(car.v>0);
});

test('steering moves left and right and releasing it settles in the chosen lane',()=>{
  for(const side of [-1,1]) {
    const car=new Car();car.v=30;
    for(let i=0;i<30;i++)car.update(dt,input(side));
    assert(car.x*side>0);
    for(let i=0;i<40;i++)car.update(dt,input());
    const x=car.x;
    for(let i=0;i<120;i++)car.update(dt,input());
    assert.equal(car.x,x);assert.equal(car.contactSide,0);
  }
});

for(const side of [-1,1]) {
  test(`edge ${side}: gradual slowing on straights and all 18 corners, even at full throttle`,()=>{
    for(const d of [0,...corners.map(c=>c.d)]) {
      const car=new Car();car.z=d;car.x=side*limit;car.v=30;car.steer=side;
      car.update(dt,input(side));
      assert(car.v>29 && car.v<30,'No instant stop');
      assert(car.shake>0);
      let previous=car.v;
      for(let i=0;i<300;i++) {
        car.update(dt,input(side));
        assert(car.v<=previous);previous=car.v;
        assert.equal(car.x,side*limit);
      }
      assert.equal(car.v,0);
      const z=car.z;
      for(let i=0;i<120;i++)car.update(dt,input(side));
      assert.equal(car.z,z,'Persistent outward input must not creep forward');
      for(let i=0;i<120;i++)car.update(dt,input(-side));
      assert(car.v>0);assert(Math.abs(car.x)<limit);assert.equal(car.contactSide,0);
    }
  });
}

test('releasing outward steering allows acceleration without requiring countersteering',()=>{
  for(const side of [-1,1]) {
    const car=new Car();car.x=side*limit;car.steer=side;
    for(let i=0;i<60;i++)car.update(dt,input(side));
    assert.equal(car.v,0);
    for(let i=0;i<120;i++)car.update(dt,input());
    assert(car.v>0);assert.equal(car.contactSide,0);assert.equal(car.shake,0);
  }
});
