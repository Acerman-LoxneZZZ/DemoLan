import test from 'node:test';
import assert from 'node:assert/strict';
import { clamp01, revealProgress, sectionProgress, assemblyProgress, footerProgress, setupScrollScenes } from '../src/scroll-scenes.js';

test('progress is finite and bounded, including resize edge cases', () => {
  for (const value of [-2, 0, .45, 1, 4, NaN, Infinity]) assert.ok(clamp01(value) >= 0 && clamp01(value) <= 1);
  assert.equal(clamp01(.45), .45);
  assert.equal(clamp01(NaN), 0);
  assert.equal(revealProgress(900, 0), 0);
});
test('a passage becomes fully visible as it enters the reading region', () => {
  assert.equal(revealProgress(1000, 1000), 0);
  assert.equal(revealProgress(580, 1000), 1);
  let previous = 0;
  for (let top = 1000; top >= -1000; top -= 20) {
    const current = revealProgress(top, 1000);
    assert.ok(current >= previous);
    previous = current;
  }
});
test('scrolling back reconstructs a scene rather than leaving a one-shot reveal', () => {
  const forward = [1000, 600, 200, -400].map(top => sectionProgress(top, 700, 1000));
  const backward = [-400, 200, 600, 1000].map(top => sectionProgress(top, 700, 1000));
  assert.deepEqual(forward, backward.toReversed());
});
test('the process can reach both complete fold and complete page on phone and desktop', () => {
  for (const viewport of [800, 1000]) {
    assert.equal(assemblyProgress(viewport, 700, viewport), 0);
    assert.equal(assemblyProgress(-1000, 700, viewport), 1);
    assert.ok(assemblyProgress(100, 700, viewport) > assemblyProgress(500, 700, viewport));
  }
});

test('footer reaches its final pose at the document bottom even on tall screens', () => {
  for (const viewport of [800, 1080, 2160, 4320]) {
    const finalTop = viewport - 326;
    assert.equal(footerProgress(finalTop, viewport, 0), 1);
    let previous = 0;
    for (let remaining = 800; remaining >= 0; remaining -= 20) {
      const progress = footerProgress(finalTop + remaining, viewport, remaining);
      assert.ok(progress >= previous && progress <= 1);
      previous = progress;
    }
  }
});

function sceneFixture(reduced = false) {
  const saved = new Map(['document','window','innerHeight','scrollY','IntersectionObserver','ResizeObserver','requestAnimationFrame','cancelAnimationFrame'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const element = (top = 700, height = 200) => ({
    top, height, dataset: {}, values: {}, classList: { add() {}, toggle() {} },
    style: { setProperty(name, value) { this.owner.values[name] = value; } },
    getBoundingClientRect() { return { top: this.top, bottom: this.top + this.height, height: this.height }; },
    querySelector() { return { textContent: '' }; }, dispatchEvent() {}, querySelectorAll() { return []; }
  });
  const elements = Object.fromEntries(['.hero','.hero-art','.concept-stage','.scope-section','.process-art','.process-list','.footer-wordmark','#value-title'].map(key => [key, element()]));
  const fan = element(780), wave = element(860), lines = [element(600, 50), element(720, 50), element(840, 50)];
  const all = [...Object.values(elements), fan, wave, ...lines];
  all.forEach(item => item.style.owner = item);
  elements['#value-title'].querySelectorAll = () => lines;
  const root = element(); root.style.owner = root; root.scrollHeight = 4000;
  const handlers = new Map(), frames = new Map(); let nextFrame = 0, observer;
  const motionListeners = [];
  const motion = { matches: reduced, addEventListener(_, fn) { motionListeners.push(fn); }, removeEventListener() {} };
  const doc = { documentElement: root, body: {}, hidden: false,
    querySelector: selector => elements[selector] || null,
    querySelectorAll: selector => selector === '.scope-panel' ? [fan] : selector === '.faq-entry' ? [wave] : [],
    addEventListener(type, fn) { handlers.set(type, fn); }, removeEventListener(type) { handlers.delete(type); }
  };
  Object.assign(globalThis, {
    document: doc, window: { addEventListener(type, fn) { handlers.set(type, fn); }, removeEventListener(type) { handlers.delete(type); } },
    innerHeight: 1000, scrollY: 0,
    requestAnimationFrame(fn) { frames.set(++nextFrame, fn); return nextFrame; }, cancelAnimationFrame(id) { frames.delete(id); },
    IntersectionObserver: class { constructor(callback) { this.callback = callback; this.elements = []; observer = this; } observe(node) { this.elements.push(node); } disconnect() { this.disconnected = true; } },
    ResizeObserver: class { observe() {} disconnect() {} }
  });
  const scene = setupScrollScenes(motion, ['Смысл', 'Страница']);
  return { fan, wave, lines, doc, motion, frames, elements,
    flush() { const pending = [...frames.values()]; frames.clear(); pending.forEach(fn => fn(16)); },
    enter() { observer.callback(observer.elements.map(target => ({ target, isIntersecting: true, boundingClientRect: target.getBoundingClientRect() }))); },
    scroll() { handlers.get('scroll')?.(); },
    exitAbove() { observer.callback(observer.elements.map(target => ({ target, isIntersecting: false, boundingClientRect: { bottom: -1 } }))); },
    reduce() { motion.matches = true; motionListeners.forEach(fn => fn()); },
    restore() { scene.destroy(); for (const [key, descriptor] of saved) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; } }
  };
}

test('three scroll gestures progress independently, reverse, and finish offscreen', () => {
  const ui = sceneFixture();
  try {
    ui.enter(); ui.flush();
    const fan = Number(ui.fan.values['--fan-progress']);
    const wave = Number(ui.wave.values['--wave-progress']);
    assert.ok(fan > wave && wave > 0 && fan < 1);
    const light = ui.lines.map(line => Number(line.values['--line-progress']));
    assert.ok(light[0] > light[1] && light[1] > light[2]);
    ui.fan.top = 900; ui.scroll(); ui.flush();
    assert.ok(Number(ui.fan.values['--fan-progress']) < fan);
    ui.exitAbove();
    assert.equal(ui.fan.values['--fan-progress'], '1');
    assert.equal(ui.wave.values['--wave-progress'], '1');
    assert.ok(ui.lines.every(line => line.values['--line-progress'] === '1'));
  } finally { ui.restore(); }
});

test('reducing motion completes the three gestures and cancels pending scroll work', () => {
  const ui = sceneFixture();
  try {
    ui.enter(); assert.ok(ui.frames.size > 0); ui.reduce();
    assert.equal(ui.frames.size, 0);
    assert.equal(ui.fan.values['--fan-progress'], '1');
    assert.equal(ui.wave.values['--wave-progress'], '1');
    assert.ok(ui.lines.every(line => line.values['--line-progress'] === '1'));
    ui.scroll(); assert.equal(ui.frames.size, 0);
  } finally { ui.restore(); }
});

test('initial reduced motion keeps readable finished poses before intersection events', () => {
  const ui = sceneFixture(true);
  try {
    ui.enter(); ui.exitAbove();
    assert.equal(ui.frames.size, 0);
    assert.equal(ui.fan.values['--fan-progress'], '1');
    assert.equal(ui.wave.values['--wave-progress'], '1');
    assert.ok(ui.lines.every(line => line.values['--line-progress'] === '1'));
  } finally { ui.restore(); }
});
