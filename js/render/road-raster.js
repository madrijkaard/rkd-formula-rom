// Small depth-buffered rasterizer for the curved, elevated road and its bridge.
// Clipping happens before perspective division; depth uses reciprocal Z.
export class RoadRaster {
  constructor(width,height,depth,horizon) {
    this.w=width; this.h=height; this.focal=depth; this.horizon=horizon;
    this.depth=new Float32Array(width*height);
  }
  begin(fb) { this.fb=fb; this.depth.fill(Infinity); }
  project(p) { return [this.w/2+this.focal*p[0]/p[2],this.horizon-this.focal*p[1]/p[2],1/p[2]]; }
  polygon(points,color) {
    const near=0.8, clipped=[];
    let a=points.at(-1);
    for(const b of points) {
      if((a[2]>=near)!==(b[2]>=near)) {
        const t=(near-a[2])/(b[2]-a[2]);
        clipped.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,near]);
      }
      if(b[2]>=near) clipped.push(b);
      a=b;
    }
    if(clipped.length<3) return;
    const p=clipped.map(v=>this.project(v));
    for(let i=1;i<p.length-1;i++) this.triangle(p[0],p[i],p[i+1],color);
  }
  triangle(a,b,c,color) {
    const area=(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
    if(Math.abs(area)<1e-8) return;
    const x0=Math.max(0,Math.floor(Math.min(a[0],b[0],c[0]))), x1=Math.min(this.w-1,Math.ceil(Math.max(a[0],b[0],c[0])));
    const y0=Math.max(0,Math.floor(Math.min(a[1],b[1],c[1]))), y1=Math.min(this.h-1,Math.ceil(Math.max(a[1],b[1],c[1])));
    const inv=1/area;
    const ax=(b[1]-c[1])*inv;
    const bx=(c[1]-a[1])*inv;
    const px=this.fb.px, depth=this.depth, w=this.w;
    for(let y=y0;y<=y1;y++) {
      let u=((b[0]-x0-0.5)*(c[1]-y-0.5)-(b[1]-y-0.5)*(c[0]-x0-0.5))*inv;
      let v=((c[0]-x0-0.5)*(a[1]-y-0.5)-(c[1]-y-0.5)*(a[0]-x0-0.5))*inv;
      for(let x=x0;x<=x1;x++,u+=ax,v+=bx) {
        const t=1-u-v;
        if(u<-1e-8 || v<-1e-8 || t<-1e-8) continue;
        const z=1/(u*a[2]+v*b[2]+t*c[2]), i=y*w+x;
        if(z<depth[i]) { depth[i]=z; px[i]=color; }
      }
    }
  }
  sprite(p,width,height,source) {
    if(p[2]<=0.8) return;
    const [cx,cy]=this.project(p), scale=this.focal/p[2];
    const w=width*scale,h=height*scale,x=cx-w/2,y=cy-h;
    if(w<1 || h<1) return;
    for(let yy=Math.max(0,Math.ceil(y));yy<Math.min(this.h,y+h);yy++) {
      const sy=Math.min(source.h-1,Math.floor((yy-y)/h*source.h));
      for(let xx=Math.max(0,Math.ceil(x));xx<Math.min(this.w,x+w);xx++) {
        const sx=Math.min(source.w-1,Math.floor((xx-x)/w*source.w)), color=source.px[sy*source.w+sx];
        const i=yy*this.w+xx;
        if(color>>>24 && p[2]<this.depth[i]) { this.depth[i]=p[2];this.fb.px[i]=color; }
      }
    }
  }
}
