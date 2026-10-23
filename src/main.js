import { site } from './config.js';
import { renderConcept } from './concepts.js';
import { validateInquiry, formatInquiry } from './inquiry.js';
import { setupSculpture } from './sculpture.js';
import { setupAccordion } from './motion.js';
import { setupScrollScenes } from './scroll-scenes.js';
import { setupCardMotion } from './card-motion.js';
import { setupPalettePreview } from './palette-preview.js';
import { setupPlayground } from './playground.js';
import { setupOrbitScene } from './orbit-scene.js';

const systemMotion = matchMedia('(prefers-reduced-motion: reduce)');
const motionEvents = new EventTarget();
let manualReduction = false;
const motionPreference = {
  get matches() { return systemMotion.matches || manualReduction; },
  addEventListener(type, listener) { motionEvents.addEventListener(type, listener); },
  removeEventListener(type, listener) { motionEvents.removeEventListener(type, listener); }
};
function updateMotion() {
  document.documentElement.toggleAttribute('data-reduced-motion', motionPreference.matches);
  const toggle = document.querySelector('#motion-toggle');
  toggle.setAttribute('aria-pressed', String(motionPreference.matches));
  toggle.textContent = systemMotion.matches ? site.accessibility.motionSystem : manualReduction ? site.accessibility.motionRestore : site.accessibility.motionReduce;
  toggle.disabled = systemMotion.matches;
  motionEvents.dispatchEvent(new Event('change'));
}
document.querySelector('#motion-toggle').addEventListener('click', () => { manualReduction = !manualReduction; updateMotion(); });
systemMotion.addEventListener('change', updateMotion);
updateMotion();

function setupNavigation() {
  const toggle = document.querySelector('.menu-toggle');
  const nav = document.querySelector('.site-nav');
  const label = toggle.querySelector('[data-menu-label]');
  function close(restoreFocus = false) {
    toggle.setAttribute('aria-expanded', 'false');
    nav.classList.remove('is-open');
    label.textContent = site.navigation.menu;
    if (restoreFocus) toggle.focus();
  }
  toggle.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', String(open));
    nav.classList.toggle('is-open', open);
    label.textContent = open ? site.navigation.close : site.navigation.menu;
  });
  nav.addEventListener('click', event => {
    if (event.target.closest('a')) close();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') close(true);
  });
  document.addEventListener('click', event => {
    if (!event.target.closest('.site-header') && toggle.getAttribute('aria-expanded') === 'true') close();
  });
  matchMedia('(min-width: 601px)').addEventListener('change', () => close());
}

function setupConcepts() {
  const tabs = [...document.querySelectorAll('[data-concept]')];
  const panel = document.querySelector('#concept-panel');
  const cards = setupCardMotion({ motion: motionPreference });
  function select(tab) {
    const concept = site.concepts.items.find(item => item.id === tab.dataset.concept);
    if (!concept || tab.getAttribute('aria-selected') === 'true') return;
    for (const item of tabs) {
      const selected = item === tab;
      item.setAttribute('aria-selected', String(selected));
      item.tabIndex = selected ? 0 : -1;
    }
    cards.swap(mount => { mount.innerHTML = renderConcept({ ...concept, actionContext: site.concepts.visit }); });
    panel.setAttribute('aria-labelledby', tab.id);
    document.querySelector('#concept-note').textContent = concept.note;
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => select(tab));
    tab.addEventListener('keydown', event => {
      let target;
      if (event.key === 'ArrowRight') target = (index + 1) % tabs.length;
      if (event.key === 'ArrowLeft') target = (index + tabs.length - 1) % tabs.length;
      if (event.key === 'Home') target = 0;
      if (event.key === 'End') target = tabs.length - 1;
      if (target !== undefined) {
        event.preventDefault();
        tabs[target].focus();
        select(tabs[target]);
      }
    });
  });
}

function setupForm() {
  const form = document.querySelector('#inquiry-form');
  const result = document.querySelector('#form-result');
  const summary = document.querySelector('#form-error-summary');
  const text = document.querySelector('#inquiry-text');
  const title = document.querySelector('#result-title');
  const description = document.querySelector('#result-description');
  const copy = document.querySelector('#copy-inquiry');
  const copyStatus = document.querySelector('#copy-status');
  const submit = form.querySelector('[type=submit]');
  const connected = site.form.mode === 'endpoint' && Boolean(site.form.endpoint);
  let busy = false;

  function showResult(values, state = 'demo') {
    text.value = formatInquiry(values, site.form.inquiry);
    title.textContent = state === 'sent' ? site.form.sentTitle : site.form.resultTitle;
    description.textContent = state === 'sent' ? site.form.sentText : state === 'error' ? site.form.sendFailure : site.form.resultText;
    result.hidden = false;
    copyStatus.textContent = '';
    copy.querySelector('span').textContent = site.form.copy;
    result.focus({ preventScroll: true });
    result.scrollIntoView({ behavior: motionPreference.matches ? 'instant' : 'smooth', block: 'nearest' });
  }
  form.addEventListener('input', event => {
    const field = event.target;
    if (!field.name) return;
    if (field.getAttribute('aria-invalid') === 'true') {
      const current = validateInquiry(Object.fromEntries(new FormData(form)));
      if (!current.errors[field.name]) {
        field.removeAttribute('aria-invalid');
        document.querySelector(`#${field.name}-error`).textContent = '';
      }
    }
    if (!result.hidden) result.hidden = true;
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy) return;
    const validation = validateInquiry(Object.fromEntries(new FormData(form)));
    for (const name of ['name', 'specialization', 'contact', 'message']) {
      const invalid = Boolean(validation.errors[name]);
      document.querySelector(`#${name}-error`).textContent = invalid ? site.form.errors[name] : '';
      form.elements[name].setAttribute('aria-invalid', String(invalid));
    }
    summary.hidden = validation.valid;
    summary.textContent = validation.valid ? '' : site.form.errorSummary;
    if (!validation.valid) {
      result.hidden = true;
      form.elements[Object.keys(validation.errors)[0]].focus();
      return;
    }
    if (!connected) { showResult(validation.values); return; }
    busy = true;
    submit.disabled = true;
    submit.querySelector('span').textContent = site.form.loading;
    form.setAttribute('aria-busy', 'true');
    try {
      const response = await fetch(site.form.endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(validation.values), signal: AbortSignal.timeout(15000), credentials: 'omit' });
      if (!response.ok) throw new Error('Submission not confirmed');
      showResult(validation.values, 'sent');
    } catch {
      showResult(validation.values, 'error');
    } finally {
      busy = false;
      submit.disabled = false;
      submit.querySelector('span').textContent = site.form.send;
      form.removeAttribute('aria-busy');
    }
  });
  copy.addEventListener('click', async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(text.value);
      copy.querySelector('span').textContent = site.form.copied;
      copyStatus.textContent = site.form.copied;
    } catch {
      text.focus();
      text.select();
      text.setSelectionRange(0, text.value.length);
      copyStatus.textContent = site.form.copyFallback;
    }
  });
  document.querySelector('#edit-inquiry').addEventListener('click', () => {
    result.hidden = true;
    form.elements.name.focus();
  });
}

setupNavigation();
setupConcepts();
setupForm();
setupSculpture({ canvas: document.querySelector('.sculpture-canvas'), host: document.querySelector('.hero-art'), motion: motionPreference });
setupAccordion(motionPreference);
setupScrollScenes(motionPreference, site.process.artStages);
setupPalettePreview();
setupPlayground(motionPreference);
setupOrbitScene({ canvas: document.querySelector('.orbit-canvas'), host: document.querySelector('.demo-orbit'), motion: motionPreference });


