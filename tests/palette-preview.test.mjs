import test from 'node:test';
import assert from 'node:assert/strict';
import { setupPalettePreview } from '../src/palette-preview.js';

function fixture(search = '?palette=1') {
  const doc = { activeElement: null, events: [], listeners: new Map(), defaultView: { CustomEvent } };
  class Element {
    constructor(tag) { this.tagName = tag; this.children = []; this.dataset = {}; this.style = {}; this.attributes = new Map(); this.listeners = new Map(); this.hidden = false; }
    append(...nodes) { for (const node of nodes) { node.parent = this; this.children.push(node); } }
    prepend(node) { node.parent = this; this.children.unshift(node); }
    remove() { this.parent.children.splice(this.parent.children.indexOf(this), 1); }
    setAttribute(name, value) { this.attributes.set(name, value); }
    getAttribute(name) { return this.attributes.get(name) ?? null; }
    addEventListener(name, handler) { this.listeners.set(name, handler); }
    removeEventListener(name) { this.listeners.delete(name); }
    focus() { doc.activeElement = this; }
    contains(node) { return node === this || this.children.some(child => child.contains(node)); }
    closest(selector) { return selector === '[data-palette-choice]' && this.dataset.paletteChoice ? this : this.parent?.closest(selector) || null; }
    dispatchEvent(event) { doc.events.push(event); return true; }
  }
  doc.createElement = tag => new Element(tag);
  doc.body = new Element('body');
  doc.documentElement = new Element('html');
  doc.addEventListener = (name, handler) => doc.listeners.set(name, handler);
  doc.removeEventListener = name => doc.listeners.delete(name);
  function find(predicate, node = doc.body) {
    if (predicate(node)) return node;
    for (const child of node.children) { const match = find(predicate, child); if (match) return match; }
    return null;
  }
  function fire(node, type, extra = {}) {
    const event = { target: node, prevented: false, preventDefault() { this.prevented = true; }, ...extra };
    node.listeners.get(type)?.(event);
    return event;
  }
  return {
    doc, document: doc, location: { search }, find, fire,
    launcher: () => find(node => node.className === 'palette-preview-launcher'),
    panel: () => find(node => node.id === 'palette-preview-panel'),
    choices: () => find(node => node.className === 'palette-preview-choices'),
    option: id => find(node => node.dataset.paletteChoice === id),
    documentEvent(type, extra = {}) { return fire(doc, type, extra); }
  };
}

test('ordinary URLs do not create preview UI, listeners or palette state', () => {
  for (const search of ['', '?palette=0', '?palette=arctic', '?other=1']) {
    const ui = fixture(search);
    assert.equal(setupPalettePreview(ui), null);
    assert.equal(ui.doc.body.children.length, 0);
    assert.equal(ui.doc.listeners.size, 0);
    assert.equal(ui.doc.documentElement.dataset.palette, undefined);
  }
});

test('preview starts closed and Escape closes it with focus returned to launcher', () => {
  const ui = fixture();
  const preview = setupPalettePreview(ui);
  assert.equal(ui.panel().hidden, true);
  assert.equal(ui.launcher().getAttribute('aria-expanded'), 'false');
  ui.fire(ui.launcher(), 'click');
  assert.equal(ui.panel().hidden, false);
  assert.equal(ui.doc.activeElement, ui.option('ultraviolet'));
  const escape = ui.documentEvent('keydown', { key: 'Escape' });
  assert.equal(escape.prevented, true);
  assert.equal(ui.panel().hidden, true);
  assert.equal(ui.doc.activeElement, ui.launcher());
  preview.destroy();
});

test('selecting a color updates one pressed choice and announces it to the sculpture', () => {
  const ui = fixture();
  const preview = setupPalettePreview(ui);
  for (const id of ['arctic', 'coral', 'champagne', 'ultraviolet', 'neon']) {
    ui.fire(ui.choices(), 'click', { target: ui.option(id) });
    assert.equal(ui.doc.documentElement.dataset.palette, id);
    assert.deepEqual(ui.choices().children.filter(button => button.getAttribute('aria-pressed') === 'true').map(button => button.dataset.paletteChoice), [id]);
    assert.equal(ui.doc.events.at(-1).type, 'palettechange');
    assert.deepEqual(ui.doc.events.at(-1).detail, { palette: id });
    assert.equal(ui.doc.events.at(-1).bubbles, true);
  }
  preview.destroy();
});

test('outside interaction stays available and cleanup restores prior state', () => {
  const ui = fixture();
  ui.doc.documentElement.dataset.palette = 'arctic';
  const preview = setupPalettePreview(ui);
  assert.equal(ui.doc.documentElement.dataset.palette, 'arctic');
  assert.equal(setupPalettePreview(ui), preview);
  assert.equal(ui.doc.body.children.length, 1);
  ui.fire(ui.launcher(), 'click');
  const outside = ui.doc.createElement('a');
  outside.focus();
  const event = ui.documentEvent('pointerdown', { target: outside });
  assert.equal(event.prevented, false);
  assert.equal(ui.panel().hidden, true);
  assert.equal(ui.doc.activeElement, outside);
  preview.destroy();
  assert.equal(ui.doc.documentElement.dataset.palette, 'arctic');
  assert.equal(ui.doc.body.children.length, 0);
  assert.equal(ui.doc.listeners.size, 0);
});
