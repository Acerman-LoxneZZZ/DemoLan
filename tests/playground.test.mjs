import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderPlayground, setupPlayground } from '../src/playground.js';

function fixture() {
  class Element {
    constructor() { this.dataset = {}; this.attrs = new Map(); this.handlers = new Map(); this.props = new Map(); this.style = { setProperty: (name, value) => this.props.set(name, value) }; this.events = []; this.textContent = ''; }
    setAttribute(name, value) { this.attrs.set(name, value); }
    getAttribute(name) { return this.attrs.get(name); }
    addEventListener(name, callback) { this.handlers.set(name, callback); }
    removeEventListener(name, callback) { if (this.handlers.get(name) === callback) this.handlers.delete(name); }
    dispatchEvent(event) { this.events.push(event); }
  }
  const section = new Element();
  section.dataset.mood = 'expressive';
  const comparison = new Element();
  comparison.getBoundingClientRect = () => ({ left: 100, width: 400 });
  let captured = null;
  comparison.setPointerCapture = id => { captured = id; };
  comparison.hasPointerCapture = id => captured === id;
  comparison.releasePointerCapture = () => { captured = null; };
  const effects = [];
  comparison.animate = (frames, options) => { const effect = { frames, options, cancelled: false, cancel() { this.cancelled = true; } }; effects.push(effect); return effect; };
  const range = new Element(); range.value = '52';
  const output = new Element(), status = new Element(), reset = new Element();
  const buttons = ['expressive', 'precise', 'warm'].map(mood => { const button = new Element(); button.dataset.demoMood = mood; return button; });
  const nodes = { '.demo-comparison': comparison, '.demo-range': range, '.demo-comparison-value': output, '.demo-mood-status': status, '.demo-reset': reset };
  section.querySelector = selector => nodes[selector];
  section.querySelectorAll = selector => selector === '[data-demo-mood]' ? buttons : [];
  const doc = { querySelector: selector => selector === '.demo-playground' ? section : null, documentElement: { dataset: { palette: 'ultraviolet' } }, defaultView: { CustomEvent } };
  const motionHandlers = new Map();
  const motion = { matches: false, addEventListener: (name, handler) => motionHandlers.set(name, handler), removeEventListener: name => motionHandlers.delete(name) };
  function fire(element, type, extra = {}) { const event = { target: element, prevented: false, preventDefault() { this.prevented = true; }, ...extra }; element.handlers.get(type)?.(event); return event; }
  return { doc, section, comparison, range, output, status, reset, buttons, motion, motionHandlers, effects, fire };
}

test('server markup has a labelled native comparison and readable identical tutor content', () => {
  const html = renderPlayground();
  assert.match(html, /<section class="demo-playground"[^>]+data-mood="expressive"[^>]+aria-labelledby="playground-title"/);
  assert.match(html, /type="range" min="0" max="100" value="52" step="1"/);
  assert.match(html, /<label for="demo-comparison-range"/);
  const after = html.match(/<div class="demo-preview demo-preview-after">([\s\S]*?)<\/div>\s*<div class="demo-preview demo-preview-before"/)[1];
  const before = html.match(/<div class="demo-preview demo-preview-before" aria-hidden="true" inert>([\s\S]*?)<\/div>\s*<div class="demo-compare-labels"/)[1];
  assert.equal(after, before);
  assert.doesNotMatch(before, /<(?:a|button|input|textarea|select)\b/);
  assert.match(html, /Учебный пример для вымышленного преподавателя/);
});

test('native input updates clipping, visible percentage and accessible value across both bounds', () => {
  const ui = fixture(); const controller = setupPlayground(ui.motion, ui.doc);
  for (const [value, expected] of [['17', 17], ['-5', 0], ['112', 100], ['not-a-number', 52]]) {
    ui.range.value = value; ui.fire(ui.range, 'input');
    assert.equal(ui.range.value, String(expected));
    assert.equal(ui.comparison.props.get('--compare-split'), `${expected}%`);
    assert.equal(ui.range.getAttribute('aria-valuetext'), `Исходное оформление: ${expected} процентов`);
    assert.equal(ui.output.textContent, `До: ${expected}%`);
  }
  assert.equal(ui.effects.length, 0, 'dragging does not wait for an animation');
  controller.destroy();
});

test('Home and End reach the endpoints without intercepting native arrow keys', () => {
  const ui = fixture(); const controller = setupPlayground(ui.motion, ui.doc);
  assert.equal(ui.fire(ui.range, 'keydown', { key: 'Home' }).prevented, true);
  assert.equal(ui.range.value, '0');
  assert.equal(ui.fire(ui.range, 'keydown', { key: 'End' }).prevented, true);
  assert.equal(ui.range.value, '100');
  assert.equal(ui.fire(ui.range, 'keydown', { key: 'ArrowLeft' }).prevented, false);
  controller.destroy();
});

test('moods select exactly one local choice and announce its actual font to the scene', () => {
  const ui = fixture(); const controller = setupPlayground(ui.motion, ui.doc);
  for (const [id, font] of [['precise', 'Manrope'], ['warm', 'Cormorant Garamond'], ['expressive', 'Unbounded']]) {
    ui.fire(ui.buttons.find(button => button.dataset.demoMood === id), 'click');
    assert.equal(ui.section.dataset.mood, id);
    assert.equal(ui.buttons.filter(button => button.getAttribute('aria-pressed') === 'true').length, 1);
    assert.equal(ui.buttons.find(button => button.getAttribute('aria-pressed') === 'true').dataset.demoMood, id);
    assert.match(ui.status.textContent, new RegExp(font));
    assert.equal(ui.section.events.at(-1).type, 'moodchange');
    assert.deepEqual(ui.section.events.at(-1).detail, { mood: id });
  }
  assert.equal(ui.doc.documentElement.dataset.palette, 'ultraviolet', 'main site palette remains local to its own controller');
  assert.equal(controller.setMood('nonexistent'), false);
  controller.destroy();
});

test('reset restores the split and font, reduced motion cancels effects without hiding content', () => {
  const ui = fixture(); const controller = setupPlayground(ui.motion, ui.doc);
  controller.setMood('warm');
  const effect = ui.effects.at(-1);
  ui.motion.matches = true; ui.motionHandlers.get('change')();
  assert.equal(effect.cancelled, true);
  controller.setSplit(100); ui.fire(ui.reset, 'click');
  assert.equal(ui.range.value, '52');
  assert.equal(ui.section.dataset.mood, 'expressive');
  assert.equal(ui.effects.length, 1, 'reduced motion keeps switching functional without a new effect');
  assert.match(ui.status.textContent, /52 процента/);
  controller.destroy();
});

test('optional section needs no listeners and repeated setup does not duplicate behavior', () => {
  assert.equal(setupPlayground({ matches: false }, { querySelector: () => null }), null);
  const ui = fixture(); const first = setupPlayground(ui.motion, ui.doc);
  assert.equal(setupPlayground(ui.motion, ui.doc), first);
  first.destroy();
  assert.equal(ui.range.handlers.size, 0);
  assert.equal(ui.reset.handlers.size, 0);
  assert.equal(ui.motionHandlers.size, 0);
  assert.ok(ui.buttons.every(button => button.handlers.size === 0));
});

test('theme declarations switch real type families and only style the scoped experiment', () => {
  const css = readFileSync(new URL('../src/playground.css', import.meta.url), 'utf8');
  assert.match(css, /--demo-display:Unbounded,Manrope,sans-serif/);
  assert.match(css, /\.demo-playground\[data-mood=precise\]\{[^}]*--demo-display:Manrope,Arial,sans-serif/);
  assert.match(css, /\.demo-playground\[data-mood=warm\]\{[^}]*--demo-display:'Cormorant Garamond',Georgia,serif/);
  assert.doesNotMatch(css, /(?:^|\})\s*(?::root|body|html)[\s{.#[]/);
});

test('dragging the comparison updates its split, clamps captured moves and ends cleanly', () => {
  const ui = fixture(); const controller = setupPlayground(ui.motion, ui.doc);
  ui.fire(ui.comparison, 'pointerdown', { pointerId: 7, clientX: 200, button: 0 });
  assert.equal(ui.range.value, '25');
  assert.equal(ui.comparison.hasPointerCapture(7), true);
  ui.fire(ui.comparison, 'pointermove', { pointerId: 8, clientX: 500 });
  assert.equal(ui.range.value, '25', 'another pointer cannot move this drag');
  ui.fire(ui.comparison, 'pointermove', { pointerId: 7, clientX: 900 });
  assert.equal(ui.range.value, '100');
  ui.fire(ui.comparison, 'pointermove', { pointerId: 7, clientX: 10 });
  assert.equal(ui.range.value, '0');
  ui.fire(ui.comparison, 'pointerup', { pointerId: 7 });
  assert.equal(ui.comparison.hasPointerCapture(7), false);
  ui.fire(ui.comparison, 'pointermove', { pointerId: 7, clientX: 300 });
  assert.equal(ui.range.value, '0');
  ui.fire(ui.comparison, 'pointerdown', { pointerId: 9, clientX: 300, button: 0 });
  controller.destroy();
  assert.equal(ui.comparison.hasPointerCapture(9), false);
  assert.equal(ui.comparison.handlers.size, 0);
});
