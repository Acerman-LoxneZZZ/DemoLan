import test from 'node:test';
import assert from 'node:assert/strict';
import {buildOrbitMesh,advanceOrbitMotion,getOrbitPose} from '../src/orbit-geometry.js';
import {setupOrbitScene} from '../src/orbit-scene.js';

test('linked rings have finite vertices, unit normals, valid indices and closed seams',()=>{
 const m=buildOrbitMesh();const t=m.topology;
 assert.ok(m.positions.every(Number.isFinite));
 assert.ok(m.indices.every(i=>i<m.positions.length/3));
 for(let i=0;i<m.normals.length;i+=3)assert.ok(Math.abs(Math.hypot(...m.normals.subarray(i,i+3))-1)<1e-5);
 for(let r=0;r<3;r++)for(let v=0;v<=t.sides;v++){
  const a=(r*t.verticesPerRing+v)*3,b=(r*t.verticesPerRing+t.segments*t.stride+v)*3;
  assert.deepEqual(m.positions.subarray(a,a+3),m.positions.subarray(b,b+3));
 }
 for(let i=0;i<m.indices.length;i+=3){
  const [a,b,c]=m.indices.subarray(i,i+3);const p=m.positions;
  const u=[0,1,2].map(k=>p[b*3+k]-p[a*3+k]),v=[0,1,2].map(k=>p[c*3+k]-p[a*3+k]);
  const n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
  assert.ok(Math.hypot(...n)>1e-9);assert.ok(n.reduce((s,x,k)=>s+x*m.normals[a*3+k],0)>0);
 }
});
test('unsafe dimensions are rejected before WebGL receives the mesh',()=>{
 for(const options of [{segments:1},{sides:2},{radius:NaN},{tube:.4},{spacing:0}])assert.throws(()=>buildOrbitMesh(options),RangeError);
});
test('orbit damping is refresh independent and reduced motion has one completed pose',()=>{
 const run=rate=>{let s={x:0,y:0,progress:0,vx:0,vy:0,vp:0};for(let i=0;i<rate;i++)s=advanceOrbitMotion(s,{x:.8,y:-.5,progress:1},1/rate);return s;};
 const a=run(30),b=run(120);for(const key of Object.keys(a))assert.ok(Math.abs(a[key]-b[key])<1e-10);
 assert.deepEqual(getOrbitPose({reduced:true}),getOrbitPose({reduced:true,x:1,y:1,time:99,progress:1}));
});
class Surface {
  listeners = new Map();
  dataset = {};
  classList = { add() {}, remove() {} };
  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(listener);
  }
  removeEventListener(type, listener) { this.listeners.get(type)?.delete(listener); }
  emit(type, values = {}) { for (const listener of this.listeners.get(type) || []) listener({ type, ...values }); }
  getBoundingClientRect() { return { left: 0, right: 740, top: 0, bottom: 700, width: 740, height: 700 }; }
}

function rendererEnvironment({ coarse = true, context = true, reduced = false } = {}) {
  const saved = new Map();
  function install(name, value) {
    saved.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  }
  let drawCount = 0;
  let contextCount = 0;
  let programCount = 0;
  let bufferCount = 0;
  const uniformValues = new Map();
  const paletteValues = new Map([
    ['--orbit-light-rgb', '.43 .14 1'],
    ['--orbit-accent-rgb', '.62 .93 .16'],
  ]);
  let handle = 0;
  let now = 0;
  const queue = new Map();
  const document = new Surface();
  document.documentElement = new Surface();
  document.hidden = false;
  const window = new Surface();
  window.devicePixelRatio = 2;
  let intersection;
  class IntersectionObserver {
    constructor(callback) { intersection = callback; }
    observe() {}
    disconnect() {}
  }
  class ResizeObserver { observe() {} disconnect() {} }
  Object.assign(window, { IntersectionObserver, ResizeObserver });
  const gl = new Proxy({
    NO_ERROR: 0,
    getShaderPrecisionFormat: () => ({ precision: 23 }),
    getShaderParameter: () => true,
    getProgramParameter: () => true,
    createShader: () => ({}),
    createProgram: () => { programCount++; return {}; },
    createBuffer: () => { bufferCount++; return {}; },
    getUniformLocation: (_, name) => name,
    getAttribLocation: () => 0,
    getError: () => 0,
    isContextLost: () => false,
    uniform3f: (name, ...values) => uniformValues.set(name, values),
    drawElements: () => { drawCount++; },
  }, { get(target, key) { return key in target ? target[key] : typeof key === 'string' && key.toUpperCase() === key ? 1 : () => {}; } });
  const section = new Surface();
  const host = new Surface();
  host.closest = () => section;
  const canvas = new Surface();
  canvas.getContext = () => { contextCount++; return context ? gl : null; };
  const motion = new Surface();
  motion.matches = reduced;
  for (const [key, value] of Object.entries({ document, window, navigator: { hardwareConcurrency: 8, deviceMemory: 8 }, innerWidth: 1440, innerHeight: 900, IntersectionObserver, ResizeObserver,
    matchMedia: () => ({ matches: coarse }),
    getComputedStyle: () => ({ getPropertyValue: name => paletteValues.get(name) || '' }),
    requestAnimationFrame: callback => { const id = ++handle; queue.set(id, callback); return id; },
    cancelAnimationFrame: id => queue.delete(id),
  })) install(key, value);
  return {
    canvas, host, section, motion, document,
    get drawCount() { return drawCount; },
    get pending() { return queue.size; },
    get resources() { return { contexts: contextCount, programs: programCount, buffers: bufferCount }; },
    uniform: name => uniformValues.get(name),
    palette(light, accent) {
      paletteValues.set('--orbit-light-rgb', light);
      paletteValues.set('--orbit-accent-rgb', accent);
      section.emit('moodchange');
    },
    visibility(visible) { intersection([{ isIntersecting: visible }]); },
    step(count = 1) {
      for (let i = 0; i < count; i++) {
        now += 1000 / 60;
        const callbacks = [...queue.values()];
        queue.clear();
        for (const callback of callbacks) callback(now);
      }
    },
    restore() {
      for (const [key, descriptor] of saved) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else delete globalThis[key];
      }
    },
  };
}

test('orbit intro stops and local mood redraws without rebuilding resources',()=>{
 const e=rendererEnvironment();let renderer;
 try{renderer=setupOrbitScene(e);assert.equal(e.drawCount,1);assert.equal(e.host.dataset.renderState,'webgl');e.step(200);assert.equal(e.pending,0);
 const resources=e.resources,before=e.drawCount;e.palette('1 .4 .2','.2 .5 .9');e.step(5);assert.equal(e.drawCount,before+1);assert.equal(e.pending,0);assert.deepEqual(e.resources,resources);assert.deepEqual(e.uniform('uLight'),[1,.4,.2]);
 e.canvas.emit('pointerdown',{pointerId:1,clientX:200,clientY:200,button:0,pointerType:'mouse'});e.canvas.emit('pointermove',{pointerId:1,clientX:550,clientY:400,pointerType:'mouse'});assert.ok(e.pending>0);
 e.visibility(false);assert.equal(e.pending,0);renderer.destroy();assert.equal(e.section.listeners.get('moodchange')?.size,0);
 }finally{renderer?.destroy();e.restore();}
});
test('reduced orbit updates only a static color frame and hidden tabs defer rendering',()=>{
 const e=rendererEnvironment({reduced:true});let renderer;
 try{renderer=setupOrbitScene(e);assert.equal(e.drawCount,1);assert.equal(e.pending,0);e.palette('.1 .2 .3','.8 .7 .6');assert.equal(e.drawCount,2);assert.equal(e.pending,0);
 e.document.hidden=true;e.document.emit('visibilitychange');e.palette('.6 .5 .4','.3 .2 .1');assert.equal(e.drawCount,2);e.document.hidden=false;e.document.emit('visibilitychange');assert.equal(e.drawCount,3);assert.equal(e.pending,0);
 }finally{renderer?.destroy();e.restore();}
});
test('missing orbit WebGL preserves fallback without any animation loop',()=>{
 const e=rendererEnvironment({context:false});try{setupOrbitScene(e);assert.equal(e.host.dataset.renderState,'fallback');assert.equal(e.canvas.hidden,true);assert.equal(e.pending,0);}finally{e.restore();}
 assert.doesNotThrow(()=>setupOrbitScene({}));
});
