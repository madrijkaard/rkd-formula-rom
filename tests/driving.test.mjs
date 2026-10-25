import test from 'node:test';
import assert from 'node:assert/strict';
import {Car} from '../js/game/car.js';
import {CAR,TRACK,FIXED_DT as dt} from '../js/config.js';
import {corners,LAP_LENGTH} from '../js/game/track.js';

const input=(steer=0,throttle=1)=>({steer,throttle,brake:0});
const limit=TRACK.roadHalf-CAR.halfWidth;

test('automatic steering completes two laps without lateral drift or contact',()=>{
  for(const offset of [-limit,0,limit]) {
    const car=new Car();car.x=offset;
    for(let i=0;i<25000 && car.z<2*LAP_LENGTH;i++) {
      car.update(dt,input());
      assert.equal(car.x,offset);
      assert.equal(car.headingError,0);
      assert.equal(car.contactSide,0);
      assert.equal(car.shake,0);
    }
    assert(car.z>=2*LAP_LENGTH);
  }
});

test('steering moves left and right and releasing it settles in the chosen lane',()=>{
  for(const side of [-1,1]) {
    const car=new Car();car.z=corners[0].d;car.v=30;
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
