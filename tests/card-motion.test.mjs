import test from 'node:test';
import assert from 'node:assert/strict';
import { setupCardMotion, cardTiltTarget, advanceCardTilt } from '../src/card-motion.js';

function fixture({ reduced = false, fine = true } = {}) {
  const animations = [];
  const frames = new Map();
  let sequence = 0;
  let clock = 0;
  let intersection;

  class Element extends EventTarget {
    constructor(tag = 'div') {
      super(); this.tagName = tag.toUpperCase(); this.children = []; this.attributes = new Map();
      const classes = new Set();
      this.classList = {
        add: (...values) => values.forEach(value => classes.add(value)),
        remove: (...values) => values.forEach(value => classes.delete(value)),
        contains: value => classes.has(value),
        toggle(value, force = !classes.has(value)) { if (force) classes.add(value); else classes.delete(value); },
      };
      Object.defineProperty(this, 'className', { get: () => [...classes].join(' '), set: value => { classes.clear(); value.split(' ').filter(Boolean).forEach(item => classes.add(item)); } });
      this.style = new Map();
      this.style.setProperty = this.style.set.bind(this.style);
      this.style.removeProperty = this.style.delete.bind(this.style);
    }
    get firstChild() { return this.children[0] || null; }
    get firstElementChild() { return this.firstChild; }
    append(element) { element.remove(); element.parent = this; this.children.push(element); }
    insertBefore(element, reference) { element.remove(); element.parent = this; this.children.splice(this.children.indexOf(reference), 0, element); }
    remove() { if (this.parent) this.parent.children.splice(this.parent.children.indexOf(this), 1); this.parent = null; }
    replaceChildren(...elements) { for (const child of [...this.children]) child.remove(); elements.forEach(element => this.append(element)); }
    setAttribute(name, value) { this.attributes.set(name, String(value)); }
    removeAttribute(name) { this.attributes.delete(name); }
    hasAttribute(name) { return this.attributes.has(name); }
    getAttribute(name) { return this.attributes.get(name) ?? null; }
    querySelectorAll() { return this.children.flatMap(child => [child, ...child.querySelectorAll('*')]); }
    cloneNode(deep) {
      const clone = new Element(this.tagName);
      clone.className = this.className;
      for (const [name, value] of this.attributes) clone.setAttribute(name, value);
      if (deep) this.children.forEach(child => clone.append(child.cloneNode(true)));
      return clone;
    }
    getBoundingClientRect() { return { left: 100, top: 200, width: 1000, height: 600 }; }
    animate(keyframes, timing) {
      let resolve, reject;
      const animation = {
        target: this, keyframes, timing, cancelled: false,
        finished: new Promise((yes, no) => { resolve = yes; reject = no; }),
        finish() { resolve(); },
        cancel() { this.cancelled = true; reject(new Error('cancelled')); },
      };
      animations.push(animation);
      return animation;
    }
  }
  function article(id) {
    const item = new Element('article');
    item.className = 'concept'; item.setAttribute('id', id); item.setAttribute('aria-labelledby', `${id}-title`);
    const title = new Element('h3'); title.setAttribute('id', `${id}-title`); item.append(title);
    const link = new Element('a'); link.setAttribute('href', '#contact'); link.setAttribute('name', 'contact'); link.setAttribute('tabindex', '0'); item.append(link);
    return item;
  }
  const stage = new Element(); stage.append(article('first'));
  const doc = Object.assign(new EventTarget(), {
    hidden: false,
    createElement: tag => new Element(tag),
    querySelector: selector => ['.concept-stage', '#concept-panel'].includes(selector) ? stage : null,
  });
  const media = Object.assign(new EventTarget(), { matches: fine });
  const motion = Object.assign(new EventTarget(), { matches: reduced });
  const previous = new Map();
  const replacements = {
    document: doc,
    window: new EventTarget(),
    matchMedia: () => media,
    getComputedStyle: element => animations.some(animation => animation.target === element && !animation.cancelled)
      ? { opacity: '1', transform: 'none', ...element.computedPose }
      : { opacity: '1', transform: 'none' },
    requestAnimationFrame: callback => { const id = ++sequence; frames.set(id, callback); return id; },
    cancelAnimationFrame: id => frames.delete(id),
    IntersectionObserver: class {
      constructor(callback) { intersection = callback; }
      observe() {}
      disconnect() {}
    },
  };
  for (const [key, value] of Object.entries(replacements)) { previous.set(key, globalThis[key]); globalThis[key] = value; }
  const api = setupCardMotion({ motion });
  function emit(element, type, properties = {}) { const event = new Event(type); Object.assign(event, properties); element.dispatchEvent(event); }
  return {
    api, stage, plane: stage.firstElementChild, article, animations, motion, media, frames,
    pointer(x, y, type = 'mouse') { emit(stage, 'pointermove', { clientX: x, clientY: y, pointerType: type }); },
    leave() { emit(stage, 'pointerleave'); },
    tick(count = 1) { for (let i = 0; i < count; i++) { clock += 16; const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback(clock)); } },
    hidden() { doc.hidden = true; emit(doc, 'visibilitychange'); },
    reduce() { motion.matches = true; emit(motion, 'change'); },
    offscreen() { intersection([{ isIntersecting: false }]); },
    restore() { api.destroy(); for (const [key, value] of previous) { if (value === undefined) delete globalThis[key]; else globalThis[key] = value; } },
  };
}

test('pointer angles stay bounded and damping is refresh-rate independent', () => {
  const rect = { left: 20, top: 30, width: 400, height: 200 };
  assert.deepEqual(cardTiltTarget(220, 130, rect), { rx: -0, ry: 0 });
  assert.deepEqual(cardTiltTarget(-10000, 10000, rect), { rx: -4.5, ry: -7.5 });
  assert.deepEqual(cardTiltTarget(0, 0, { width: 0, height: 0 }), { rx: 0, ry: 0 });
  const target = { rx: 4.5, ry: 7.5 };
  let at60 = { rx: 0, ry: 0 }, at120 = { rx: 0, ry: 0 };
  for (let i = 0; i < 10; i++) at60 = advanceCardTilt(at60, target, 16);
  for (let i = 0; i < 20; i++) at120 = advanceCardTilt(at120, target, 8);
  assert.ok(Math.abs(at60.rx - at120.rx) < 1e-12);
  assert.ok(Math.abs(at60.ry - at120.ry) < 1e-12);
  assert.ok(at60.ry > 0 && at60.ry < target.ry);
});

test('selection content updates synchronously and the outgoing copy is inert', () => {
  const ui = fixture();
  try {
    const next = ui.article('second');
    ui.api.swap(mount => mount.replaceChildren(next));
    assert.equal(ui.plane.firstElementChild, next);
    const snapshot = ui.plane.children[1];
    assert.equal(snapshot.inert, true);
    assert.equal(snapshot.getAttribute('aria-hidden'), 'true');
    for (const element of [snapshot, ...snapshot.querySelectorAll('*')]) {
      for (const attribute of ['id', 'name', 'tabindex', 'href', 'aria-labelledby']) assert.equal(element.hasAttribute(attribute), false);
    }
    assert.equal(ui.animations.length, 2);
    assert.ok(ui.animations[0].timing.duration < ui.animations[1].timing.duration);
  } finally { ui.restore(); }
});

test('rapid selection cancels old turns and leaves only the latest live preview', async () => {
  const ui = fixture();
  try {
    ui.api.swap(mount => mount.replaceChildren(ui.article('second')));
    const outgoing = [...ui.animations];
    const latest = ui.article('third');
    ui.api.swap(mount => mount.replaceChildren(latest));
    assert.ok(outgoing.every(animation => animation.cancelled));
    assert.equal(ui.plane.children.length, 2);
    assert.equal(ui.plane.firstElementChild, latest);
    ui.animations.slice(2).forEach(animation => animation.finish());
    await Promise.resolve();
    assert.deepEqual(ui.plane.children, [latest]);
    assert.equal(ui.plane.classList.contains('is-card-swapping'), false);
  } finally { ui.restore(); }
});

test('an interrupted turn continues its outgoing copy from the displayed pose', () => {
  const ui = fixture();
  try {
    const incoming = ui.article('second');
    ui.api.swap(mount => mount.replaceChildren(incoming));
    incoming.computedPose = {
      opacity: '.63',
      transform: 'matrix3d(.97,0,.23,0,0,1,0,0,-.23,0,.97,0,-8,0,-42,1)',
    };
    ui.api.swap(mount => mount.replaceChildren(ui.article('third')));
    const snapshot = ui.plane.children[1];
    assert.deepEqual(ui.animations[2].keyframes[0], incoming.computedPose);
    assert.equal(snapshot.style.get('opacity'), incoming.computedPose.opacity);
    assert.equal(snapshot.style.get('transform'), incoming.computedPose.transform);
    assert.ok(ui.animations.slice(0, 2).every(animation => animation.cancelled));
  } finally { ui.restore(); }
});

test('pointer settles, returns to flat, and never tilts for touch or coarse input', () => {
  const ui = fixture();
  try {
    ui.pointer(1100, 200); ui.tick(80);
    assert.equal(ui.frames.size, 0);
    assert.equal(ui.plane.style.get('--card-rx'), '4.500deg');
    assert.equal(ui.plane.style.get('--card-ry'), '7.500deg');
    ui.leave(); ui.tick(80);
    assert.equal(ui.frames.size, 0);
    assert.equal(ui.plane.style.get('--card-rx'), '0.000deg');
    assert.equal(ui.plane.classList.contains('is-card-tilting'), false);
    ui.pointer(1100, 200, 'touch');
    assert.equal(ui.frames.size, 0);
    ui.media.matches = false;
    ui.pointer(1100, 200);
    assert.equal(ui.frames.size, 0);
  } finally { ui.restore(); }
});

test('hidden, offscreen and reduced motion cancel animation without losing selection', () => {
  for (const interrupt of ['hidden', 'offscreen', 'reduce']) {
    const ui = fixture();
    try {
      const selected = ui.article('second');
      ui.api.swap(mount => mount.replaceChildren(selected));
      ui.pointer(1100, 200); ui.tick();
      ui[interrupt]();
      assert.equal(ui.frames.size, 0);
      assert.ok(ui.animations.every(animation => animation.cancelled));
      assert.deepEqual(ui.plane.children, [selected]);
      assert.equal(ui.plane.style.has('--card-rx'), false);
      const third = ui.article('third');
      ui.api.swap(mount => mount.replaceChildren(third));
      assert.deepEqual(ui.plane.children, [third]);
      assert.equal(ui.animations.length, 2);
    } finally { ui.restore(); }
  }
});

test('initial reduced motion is still and destroy unwraps the latest semantic content', () => {
  const ui = fixture({ reduced: true });
  try {
    const selected = ui.article('second');
    ui.api.swap(mount => mount.replaceChildren(selected));
    ui.pointer(1100, 200);
    assert.equal(ui.animations.length, 0);
    assert.equal(ui.frames.size, 0);
    ui.api.destroy();
    assert.deepEqual(ui.stage.children, [selected]);
    assert.equal(ui.stage.hasAttribute('data-card-motion'), false);
    ui.pointer(1100, 200);
    assert.equal(ui.frames.size, 0);
  } finally { ui.restore(); }
});
