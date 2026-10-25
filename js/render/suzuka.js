import {SCREEN_W as W,SCREEN_H as H,VIEW,TRACK} from '../config.js';
import {sampleTrack,LAP_LENGTH,corners,crossover} from '../game/track.js';
import {C,rgb} from './palette.js';
import {Framebuffer} from './framebuffer.js';
import {drawText,measureText} from './font.js';
import {WorldRenderer} from './world.js';
import {RoadRaster} from './road-raster.js';

const FAR=520, COUNT=Math.ceil(LAP_LENGTH/7), STEP=LAP_LENGTH/COUNT;
const GRAVEL=rgb('#b9a58c'), DARK=rgb('#30343b'), CONCRETE=rgb('#999d9e');
const TREE_RADIUS=4, TREE_SETBACK=2;
const point=(p,x,h=0)=>[p.x+p.rx*x,p.y+h,p.z+p.rz*x];
const label=(text,w=0)=>{
  const b=new Framebuffer(Math.max(w,measureText(text)+6),13);
  b.clear(C.pureWhite);b.fillRect(1,1,b.w-2,b.h-2,DARK);
  drawText(b,text,3,3,C.pureWhite);return b;
};

export class SuzukaRenderer {
  constructor() {
    this.sky=new WorldRenderer();
    this.raster=new RoadRaster(W,H,VIEW.depth,VIEW.horizon);
    this.nodes=Array.from({length:COUNT+1},(_,i)=>sampleTrack(i*STEP));
    // Bound each grass apron by the neighbouring piece of road. Wide flat
    // strips otherwise bury the returning lane at the hairpin and the esses.
    this.aprons=this.nodes.map((p,i)=>[-1,1].map(side=>{
      let width=55,height=p.y;
      for(let j=0;j<COUNT;j++) {
        const separation=Math.min(Math.abs(i-j),COUNT-Math.abs(i-j))*STEP;
        if(separation<35) continue;
        const q=this.nodes[j],dx=q.x-p.x,dz=q.z-p.z;
        const across=2*side*(dx*p.rx+dz*p.rz);
        if(across<=0) continue;
        const boundary=(dx*dx+dz*dz)/across;
        if(boundary<width) {width=boundary;height=(p.y+q.y)/2;}
      }
      return {width:Math.max(TRACK.roadHalf+1.6,width),height};
    }));
    this.trees=new Map();
    const kerb=TRACK.roadHalf+0.25+0.8;
    for(let i=0;i<COUNT;i+=7) {
      const d=i*STEP;
      if(d<950 || d>LAP_LENGTH-200 || Math.abs(d-crossover.upper)<36) continue;
      const p=this.nodes[i],side=(i&1)?-1:1,offset=side*(29+(i%5)*3);
      const apron=this.aprons[i][side<0?0:1];
      // Keep the whole crown on this verge, out of stands and neighbouring lanes.
      if(Math.abs(offset)+TREE_RADIUS+TREE_SETBACK>apron.width) continue;
      const [x,,z]=point(p,offset);
      if(this.roadDistance(x,z)<kerb+TREE_RADIUS+TREE_SETBACK) continue;
      const blend=(Math.abs(offset)-kerb)/(apron.width-kerb);
      const anchor={...p,y:p.y+(apron.height-p.y)*blend};
      this.trees.set(i,{anchor,offset,x,z,radius:TREE_RADIUS});
    }
    this.signs=[];
    for(const number of [1,9,11,13,16]) {
      const corner=corners[number-1];
      for(const distance of [150,100,50]) {
        const p=sampleTrack(corner.d-distance);
        this.signs.push({p:point(p,-Math.sign(sampleTrack(corner.d).curve)*10,0.3),
          image:label(String(distance)),w:2.1,h:1.4});
      }
    }
    this.signs.push({p:point(sampleTrack(75),0,6),image:label('SUZUKA',80),w:15,h:2});
  }

  roadDistance(x,z) {
    let nearest=Infinity;
    // Segment distance covers tight curves and both branches of the crossover.
    // Ignoring height deliberately also keeps tall trees away from the overpass.
    for(let i=0;i<COUNT;i++) {
      const a=this.nodes[i],b=this.nodes[i+1],dx=b.x-a.x,dz=b.z-a.z;
      const t=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz)));
      nearest=Math.min(nearest,Math.hypot(x-a.x-t*dx,z-a.z-t*dz));
    }
    return nearest;
  }

  camera(p) {
    const dx=p[0]-this.base.x-this.base.rx*this.carX, dz=p[2]-this.base.z-this.base.rz*this.carX;
    const along=dx*this.base.tx+dz*this.base.tz, across=dx*this.base.rx+dz*this.base.rz;
    const forward=along*this.cosYaw+across*this.sinYaw;
    const up=p[1]-this.base.y-VIEW.camHeight;
    return [across*this.cosYaw-along*this.sinYaw,
      up*this.cosPitch-forward*this.sinPitch,
      forward*this.cosPitch+up*this.sinPitch];
  }
  quad(points,color) { this.raster.polygon(points.map(p=>this.camera(p)),color); }
  strip(a,b,left,right,color,h=0) {
    this.quad([point(a,left,h),point(a,right,h),point(b,right,h),point(b,left,h)],color);
  }
  wall(a,b,x,h0,h1,color) {
    this.quad([point(a,x,h0),point(a,x,h1),point(b,x,h1),point(b,x,h0)],color);
  }
  crossbar(p,left,right,h0,h1,color) {
    this.quad([point(p,left,h0),point(p,left,h1),point(p,right,h1),point(p,right,h0)],color);
  }

  render(fb,car,t) {
    this.base=sampleTrack(car.z); this.carX=car.x;
    this.cosYaw=Math.cos(car.headingError || 0);this.sinYaw=Math.sin(car.headingError || 0);
    const pitch=Math.atan(this.base.grade);
    this.cosPitch=Math.cos(pitch);this.sinPitch=Math.sin(pitch);
    fb.clear(C.sky6);
    this.sky.drawSky(fb,VIEW.horizon,t,car.x+(this.base.heading+(car.headingError || 0))*45);
    fb.fillRect(0,VIEW.horizon,W,H-VIEW.horizon,C.grassMid);
    this.raster.begin(fb);
    const R=TRACK.roadHalf, edge=R+0.25, kerb=edge+0.8;
    for(let i=0;i<COUNT;i++) {
      const a=this.nodes[i], b=this.nodes[i+1], ca=this.camera([a.x,a.y,a.z]), cb=this.camera([b.x,b.y,b.z]);
      if(Math.max(ca[2],cb[2])<0.8 || Math.min(ca[2],cb[2])>FAR) continue;
      if(Math.hypot(a.x-this.base.x,a.z-this.base.z)>FAR+60) continue;
      const maxZ=Math.max(10,ca[2],cb[2]);
      if(Math.min(ca[0],cb[0])>maxZ*1.5+55 || Math.max(ca[0],cb[0])<-maxZ*1.5-55) continue;
      const d=i*STEP, onBridge=Math.abs(d-crossover.upper)<36;
      const stripe=(i&1)!==0, grass=stripe?C.grass0:C.grass1;
      // The overpass has no ground apron: the lower road remains visible below it.
      if(!onBridge) {
        for(let side=0;side<2;side++) {
          const sd=side===0?-1:1, ga=this.aprons[i][side],gb=this.aprons[i+1][side];
          const oa=point(a,sd*ga.width,ga.height-a.y),ob=point(b,sd*gb.width,gb.height-b.y);
          this.quad([point(a,sd*kerb),oa,ob,point(b,sd*kerb)],grass);
        }
        if(Math.abs(a.curve)>0.005) {
          const sd=-Math.sign(a.curve);
          const width=Math.min(20,this.aprons[i][sd<0?0:1].width-0.5,this.aprons[i+1][sd<0?0:1].width-0.5);
          this.strip(a,b,sd>0?kerb:-width,sd>0?width:-kerb,GRAVEL,0.012);
        }
      }
      this.strip(a,b,-R,R,stripe?C.asphalt0:C.asphalt1,0.025);
      for(const sd of [-1,1]) {
        this.strip(a,b,sd<0?-edge:R,sd<0?-R:edge,C.line,0.026);
        this.strip(a,b,sd<0?-kerb:edge,sd<0?-edge:kerb,stripe?C.kerbRed:C.kerbWhite,0.03);
        const verge=Math.min(this.aprons[i][sd<0?0:1].width,this.aprons[i+1][sd<0?0:1].width);
        const wallX=onBridge?sd*(kerb+0.3):sd*Math.min(23,verge);
        this.wall(a,b,wallX,0,0.9,stripe?C.wallRed0:C.pureWhite);
        if(onBridge) this.wall(a,b,wallX,-1.25,0,CONCRETE);
        if(i%4===0) {
          this.wall(a,b,wallX,0.9,1.02,C.post);
          this.crossbar(a,wallX-0.06,wallX+0.06,0,3,C.post);
        }
      }
      if(i===0) {
        const end=sampleTrack(2.4);
        for(let x=-R;x<R;x+=1) this.strip(a,end,x,x+1,(x&1)?C.pureWhite:DARK,0.04);
      }
      // Grandstands around the start/finish and first two corners; trees elsewhere.
      const main=d<950 || d>LAP_LENGTH-200;
      if(main && i%3===0) this.stand(a,this.nodes[Math.min(COUNT,i+3)],i);
      else if(this.trees.has(i)) {
        const {anchor,offset:x,radius}=this.trees.get(i);
        this.crossbar(anchor,x-0.35,x+0.35,0,7,C.post);
        this.quad([point(anchor,x-radius,3),point(anchor,x,12),point(anchor,x+radius,3)],C.tree0);
        this.quad([point(anchor,x-3,6),point(anchor,x,15),point(anchor,x+3,6)],C.tree1);
      }
    }
    this.bridge();
    // Start gantry, positioned along the centreline (no repeated fake gantries).
    const gantry=sampleTrack(75);
    if(this.camera([gantry.x,gantry.y,gantry.z])[2]<FAR) {
      for(const x of [-8,8]) this.crossbar(gantry,x-0.2,x+0.2,0,8,DARK);
    }
    for(const sign of this.signs) {
      const p=this.camera(sign.p);
      if(p[2]<FAR) this.raster.sprite(p,sign.w,sign.h,sign.image);
    }
  }

  stand(a,b,index) {
    for(const sd of [-1,1]) {
      for(let tier=0;tier<5;tier++) {
        const x=sd*(25+tier*2.5), nx=sd*(27.5+tier*2.5), h=1+tier*1.3;
        this.quad([point(a,x,h),point(a,nx,h+1.3),point(b,nx,h+1.3),point(b,x,h)],
          [C.crowdR,C.crowdW,C.crowdY,C.crowdB,C.stand1][(index+tier)%5]);
      }
      if(sd<0) this.quad([point(a,-24,9),point(a,-39,11),point(b,-39,11),point(b,-24,9)],C.roof);
    }
  }

  bridge() {
    const upper=sampleTrack(crossover.upper), lower=sampleTrack(crossover.lower);
    const cam=this.camera([upper.x,upper.y,upper.z]);
    if(cam[2]<-30 || cam[2]>FAR) return;
    const bottom=lower.y-upper.y-0.4;
    for(const offset of [-15,15]) {
      const p=sampleTrack(crossover.upper+offset);
      for(const side of [-1,1]) this.crossbar(p,side*9-0.6,side*9+0.6,bottom,-1.2,CONCRETE);
    }
    // The underside is a real surface, so it occludes the sky from the underpass.
    const a=sampleTrack(crossover.upper-36), b=sampleTrack(crossover.upper+36);
    this.strip(a,b,-7.35,7.35,DARK,-1.25);
    this.crossbar(a,-7.35,7.35,-1.25,0,CONCRETE);
    this.crossbar(b,-7.35,7.35,-1.25,0,CONCRETE);
    // Close the ends of the raised embankments instead of exposing grass sheets.
    for(const p of [a,b]) {
      this.crossbar(p,-24,-7.35,bottom,0,C.tree1);
      this.crossbar(p,7.35,24,bottom,0,C.tree1);
    }
  }
}
