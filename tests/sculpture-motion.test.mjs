import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceSculptureMotion, setupSculpture } from '../src/sculpture.js';

const rest = () => ({ x: 0, y: 0, progress: 0, vx: 0, vy: 0, vp: 0 });

test('damped turns have the same timing at 30, 60 and 120 Hz', () => {
  const targets = { x: .8, y: -.6, progress: 1 };
  const samples = [30, 60, 120].map(rate => {
    let state = rest();
    for (let i = 0; i < rate; i++) state = advanceSculptureMotion(state, targets, 1 / rate);
    return state;
  });
  for (const state of samples.slice(1)) for (const key of Object.keys(state)) assert.ok(Math.abs(state[key] - samples[0][key]) < 1e-10, key);
});

test('scroll and pointer targets accelerate smoothly and settle to an exact rest', () => {
  let state = rest();
  const target = { x: 1, y: -.8, progress: 1 };
  state = advanceSculptureMotion(state, target, 1 / 60);
  assert.ok(state.progress > 0 && state.progress < .01, 'scroll does not snap to its target');
  assert.ok(state.x > 0 && state.x < .01, 'pointer starts with gentle acceleration');
  let previous = state.progress;
  for (let i = 0; i < 180; i++) {
    state = advanceSculptureMotion(state, target, 1 / 60);
    assert.ok(state.progress >= previous && state.progress <= 1);
    previous = state.progress;
  }
  assert.deepEqual(state, { x: 1, y: -.8, progress: 1, vx: 0, vy: 0, vp: 0 });
});

test('repeated input reversals and a resumed frame stay finite and bounded', () => {
  let state = rest();
  for (let frame = 0; frame < 900; frame++) {
    const sign = Math.floor(frame / 18) % 2 ? -1 : 1;
    state = advanceSculptureMotion(state, { x: sign, y: -sign, progress: sign > 0 ? 1 : 0 }, frame === 400 ? 20 : 1 / 60);
    assert.ok(Object.values(state).every(Number.isFinite));
    assert.ok(Math.abs(state.x) <= 1 && Math.abs(state.y) <= 1);
    assert.ok(state.progress >= 0 && state.progress <= 1);
  }
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
    ['--model-light-rgb', '.43 .14 1'],
    ['--model-accent-rgb', '.62 .93 .16'],
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
  const hero = new Surface();
  const host = new Surface();
  host.closest = () => hero;
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
    canvas, host, hero, motion, document,
    get drawCount() { return drawCount; },
    get pending() { return queue.size; },
    get resources() { return { contexts: contextCount, programs: programCount, buffers: bufferCount }; },
    uniform: name => uniformValues.get(name),
    palette(light, accent) {
      paletteValues.set('--model-light-rgb', light);
      paletteValues.set('--model-accent-rgb', accent);
      document.documentElement.emit('palettechange');
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

test('coarse scroll settles over several frames, then releases its animation loop', () => {
  const env = rendererEnvironment();
  let renderer;
  try {
    renderer = setupSculpture(env);
    assert.equal(env.drawCount, 1, 'the first frame is synchronous');
    assert.equal(env.host.dataset.renderState, 'webgl');
    assert.equal(env.canvas.width, 1110, 'DPR is capped at 1.5');
    env.step(200);
    assert.equal(env.pending, 0, 'the mobile introduction stops');
    const before = env.drawCount;
    env.host.dataset.scrollProgress = '.95';
    env.host.emit('sculptureprogress');
    env.step(5);
    assert.ok(env.drawCount > before && env.pending > 0);
    env.step(200);
    assert.ok(env.drawCount > before + 10, 'scroll has a settling sequence rather than one snapped redraw');
    assert.equal(env.pending, 0);
    assert.equal(JSON.parse(env.host.dataset.pose).progress, .95);
    env.host.dataset.scrollProgress = '.1';
    env.host.emit('sculptureprogress');
    env.document.hidden = true;
    env.document.emit('visibilitychange');
    assert.equal(env.pending, 0, 'hidden pages cancel settling');
    env.document.hidden = false;
    env.document.emit('visibilitychange');
    assert.ok(env.pending > 0);
    env.visibility(false);
    assert.equal(env.pending, 0, 'offscreen scenes cancel settling');
    env.visibility(true);
    env.motion.matches = true;
    env.motion.emit('change');
    assert.equal(env.pending, 0, 'reduced motion has no recurring frames');
    const reduced = env.host.dataset.pose;
    const count = env.drawCount;
    env.host.dataset.scrollProgress = '1';
    env.host.emit('sculptureprogress');
    env.step(60);
    assert.equal(env.host.dataset.pose, reduced);
    assert.equal(env.drawCount, count);
  } finally { renderer?.destroy(); env.restore(); }
});

test('a missing WebGL context preserves the page artwork without scheduling motion', () => {
  const env = rendererEnvironment({ context: false });
  try {
    setupSculpture(env);
    assert.equal(env.host.dataset.renderState, 'fallback');
    assert.equal(env.canvas.hidden, true);
    assert.equal(env.pending, 0);
  } finally { env.restore(); }
});

test('desktop uses its 60 fps budget for a turn and returns to 45 fps idle', () => {
  const env = rendererEnvironment({ coarse: false });
  let renderer;
  try {
    renderer = setupSculpture(env);
    env.step(200);
    let before = env.drawCount;
    env.step(60);
    assert.ok(env.drawCount - before >= 44 && env.drawCount - before <= 46);
    env.hero.emit('pointermove', { clientX: 740, clientY: 0, pointerType: 'mouse' });
    before = env.drawCount;
    env.step(60);
    assert.ok(env.drawCount - before >= 58 && env.drawCount - before <= 61);
    env.step(120);
    before = env.drawCount;
    env.step(60);
    assert.ok(env.drawCount - before >= 44 && env.drawCount - before <= 46);
  } finally { renderer?.destroy(); env.restore(); }
});

test('palette changes update a reduced-motion frame without rebuilding WebGL resources', () => {
  const env = rendererEnvironment({ reduced: true });
  let renderer;
  try {
    renderer = setupSculpture(env);
    const resources = env.resources;
    assert.deepEqual(env.uniform('uLight'), [.43, .14, 1]);
    assert.equal(env.pending, 0);
    const pose = env.host.dataset.pose;
    env.palette('.25 .55 1', '.4 .9 1');
    assert.equal(env.drawCount, 2, 'the static pose redraws for its new lighting');
    assert.deepEqual(env.uniform('uLight'), [.25, .55, 1]);
    assert.deepEqual(env.uniform('uAccent'), [.4, .9, 1]);
    assert.equal(env.host.dataset.pose, pose, 'lighting does not change the pose');
    assert.equal(env.pending, 0, 'reduced motion never starts an animation loop');
    assert.deepEqual(env.resources, resources);

    env.document.hidden = true;
    env.document.emit('visibilitychange');
    env.palette('1 .25 .4', '1 .6 .4');
    assert.equal(env.drawCount, 2, 'a hidden page defers its redraw');
    assert.equal(env.pending, 0);
    env.document.hidden = false;
    env.document.emit('visibilitychange');
    assert.equal(env.drawCount, 3);
    assert.deepEqual(env.uniform('uLight'), [1, .25, .4]);
    assert.deepEqual(env.resources, resources);
    env.palette('1 .25 .4', '1 .6 .4');
    assert.equal(env.drawCount, 3, 'unchanged colors need no extra frame');

    renderer.destroy();
    assert.equal(env.document.documentElement.listeners.get('palettechange').size, 0);
    env.palette('.1 .2 .3', '.3 .2 .1');
    assert.equal(env.drawCount, 3, 'destroyed scenes no longer react to palette changes');
  } finally { renderer?.destroy(); env.restore(); }
});

test('a mobile scene at rest draws its new palette once and releases the frame', () => {
  const env = rendererEnvironment();
  let renderer;
  try {
    renderer = setupSculpture(env);
    env.step(200);
    assert.equal(env.pending, 0);
    const before = env.drawCount;
    const resources = env.resources;
    env.palette('.6 .35 1', '.8 .7 1');
    assert.equal(env.pending, 1);
    env.step(2);
    assert.equal(env.drawCount, before + 1);
    assert.equal(env.pending, 0);
    assert.deepEqual(env.uniform('uLight'), [.6, .35, 1]);
    assert.deepEqual(env.resources, resources);
  } finally { renderer?.destroy(); env.restore(); }
});
