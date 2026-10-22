import test from 'node:test';
import assert from 'node:assert/strict';
import { setupAccordion } from '../src/motion.js';

function fixture(reduced = false) {
  const animations = [];
  const items = Array.from({ length: 3 }, (_, index) => ({
    open: index === 0,
    click: null,
    querySelector() { return { addEventListener: (_, fn) => { this.click = fn; } }; },
    getBoundingClientRect() { return { height: this.open ? 190 : 70 }; },
    animate(frames, timing) {
      const animation = { frames, timing, cancelled: false, cancel() { this.cancelled = true; } };
      animations.push(animation);
      return animation;
    }
  }));
  const listeners = [];
  const motion = { matches: reduced, addEventListener: (_, fn) => listeners.push(fn) };
  const previousDocument = globalThis.document;
  globalThis.document = { hidden: false, querySelectorAll: () => items };
  setupAccordion(motion);
  return {
    items, animations, motion,
    click(index) { let prevented = false; items[index].click({ preventDefault() { prevented = true; } }); assert.equal(prevented, true); },
    changeReduced() { motion.matches = true; listeners.forEach(fn => fn()); },
    restore() { globalThis.document = previousDocument; }
  };
}

test('opening a new FAQ immediately closes the previous one', () => {
  const ui = fixture();
  try {
    ui.click(1);
    assert.deepEqual(ui.items.map(item => item.open), [false, true, false]);
    assert.equal(ui.animations.length, 2);
    ui.click(2);
    assert.deepEqual(ui.items.map(item => item.open), [false, false, true]);
  } finally { ui.restore(); }
});

test('rapid clicks can close and reopen an answer without leaving multiple open', () => {
  const ui = fixture();
  try {
    for (const index of [1, 1, 1, 2, 0, 2, 2, 0]) {
      ui.click(index);
      assert.ok(ui.items.filter(item => item.open).length <= 1);
    }
    assert.equal(ui.items[0].open, true);
    assert.ok(ui.animations.some(animation => animation.cancelled));
  } finally { ui.restore(); }
});

test('reduced motion preserves the exclusive behavior with no spatial animation', () => {
  const ui = fixture(true);
  try {
    ui.click(2);
    assert.deepEqual(ui.items.map(item => item.open), [false, false, true]);
    assert.equal(ui.animations.length, 0);
  } finally { ui.restore(); }
});

test('switching to reduced motion cancels in-flight accordion animation', () => {
  const ui = fixture();
  try {
    ui.click(1);
    ui.changeReduced();
    assert.ok(ui.animations.every(animation => animation.cancelled));
    assert.equal(ui.items[1].open, true);
  } finally { ui.restore(); }
});
