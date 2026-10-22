export const palettePresets = Object.freeze([
  { id: 'neon', name: 'Неон', description: 'Лайм и фиолетовый · яркий контраст', accent: '#d6ff62', secondary: '#a477ff' },
  { id: 'arctic', name: 'Арктика', description: 'Голубой и кобальт · холодный свет', accent: '#77dcff', secondary: '#6d8dff' },
  { id: 'coral', name: 'Коралл', description: 'Персик и розовый · тёплая энергия', accent: '#ff997e', secondary: '#ff5a8c' },
  { id: 'champagne', name: 'Шампань', description: 'Золото и песочный · мягкий блеск', accent: '#e8d09c', secondary: '#c9b898' },
  { id: 'ultraviolet', name: 'Ультрафиолет', description: 'Лаванда и фиолетовый · основная гамма', accent: '#bca4ff', secondary: '#9861ff' }
].map(preset => Object.freeze(preset)));

const instances = new WeakMap();

/** A temporary fitting room, available only on the explicit ?palette=1 URL. */
export function setupPalettePreview({ document: doc = globalThis.document, location = globalThis.location } = {}) {
  if (!doc?.body || new URLSearchParams(location?.search || '').get('palette') !== '1') return null;
  if (instances.has(doc)) return instances.get(doc);

  const root = doc.documentElement;
  const previousPalette = root.dataset.palette;
  const initialPreset = palettePresets.find(preset => preset.id === previousPalette) || palettePresets.find(preset => preset.id === 'ultraviolet');
  const wrapper = element('div', 'palette-preview');
  wrapper.setAttribute('data-palette-preview', '');
  const launcher = element('button', 'palette-preview-launcher', 'Цветовые варианты');
  launcher.type = 'button';
  launcher.setAttribute('aria-expanded', 'false');
  launcher.setAttribute('aria-controls', 'palette-preview-panel');
  const launcherSwatches = swatches(initialPreset);
  launcher.prepend(launcherSwatches);

  const panel = element('section', 'palette-preview-panel');
  panel.id = 'palette-preview-panel';
  panel.hidden = true;
  panel.setAttribute('aria-labelledby', 'palette-preview-title');
  const header = element('div', 'palette-preview-header');
  const title = element('h2', '', 'Примерьте цвет');
  title.id = 'palette-preview-title';
  const close = element('button', 'palette-preview-close', 'Закрыть');
  close.type = 'button';
  header.append(title, close);
  panel.append(header);

  const choices = element('div', 'palette-preview-choices');
  const buttons = palettePresets.map(preset => {
    const button = element('button', 'palette-preview-choice');
    button.type = 'button';
    button.dataset.paletteChoice = preset.id;
    button.setAttribute('aria-pressed', String(preset.id === initialPreset.id));
    const copy = element('span', 'palette-preview-copy');
    copy.append(element('strong', '', preset.name), element('span', '', preset.description));
    button.append(swatches(preset), copy);
    choices.append(button);
    return button;
  });
  const status = element('p', 'palette-preview-status', `Сейчас: ${initialPreset.name}`);
  status.setAttribute('role', 'status');
  panel.append(choices, status);
  wrapper.append(panel, launcher);
  doc.body.append(wrapper);

  function element(tag, className = '', text = '') {
    const node = doc.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }
  function swatches(preset) {
    const pair = element('span', 'palette-preview-swatches');
    pair.setAttribute('aria-hidden', 'true');
    for (const color of [preset.accent, preset.secondary]) {
      const swatch = element('i');
      swatch.style.backgroundColor = color;
      pair.append(swatch);
    }
    return pair;
  }
  function announcePalette() {
    const PaletteEvent = doc.defaultView?.CustomEvent || globalThis.CustomEvent;
    root.dispatchEvent(new PaletteEvent('palettechange', { bubbles: true, detail: { palette: root.dataset.palette || 'ultraviolet' } }));
  }
  function select(id) {
    const preset = palettePresets.find(item => item.id === id);
    if (!preset) return;
    root.dataset.palette = preset.id;
    buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.paletteChoice === preset.id)));
    const colors = launcherSwatches.children;
    colors[0].style.backgroundColor = preset.accent;
    colors[1].style.backgroundColor = preset.secondary;
    status.textContent = `Сейчас: ${preset.name}`;
    announcePalette();
  }
  function setOpen(open, restoreFocus = false) {
    panel.hidden = !open;
    launcher.setAttribute('aria-expanded', String(open));
    if (open) buttons.find(button => button.getAttribute('aria-pressed') === 'true')?.focus();
    else if (restoreFocus) launcher.focus();
  }
  function onLaunch() { setOpen(panel.hidden); }
  function onClose() { setOpen(false, true); }
  function onChoice(event) {
    const button = event.target.closest('[data-palette-choice]');
    if (button && choices.contains(button)) select(button.dataset.paletteChoice);
  }
  function onKey(event) {
    if (event.key !== 'Escape' || panel.hidden) return;
    event.preventDefault();
    setOpen(false, true);
  }
  function onOutside(event) {
    if (!panel.hidden && !wrapper.contains(event.target)) setOpen(false);
  }
  launcher.addEventListener('click', onLaunch);
  close.addEventListener('click', onClose);
  choices.addEventListener('click', onChoice);
  doc.addEventListener('keydown', onKey);
  doc.addEventListener('pointerdown', onOutside);
  select(initialPreset.id);

  const instance = {
    destroy() {
      launcher.removeEventListener('click', onLaunch);
      close.removeEventListener('click', onClose);
      choices.removeEventListener('click', onChoice);
      doc.removeEventListener('keydown', onKey);
      doc.removeEventListener('pointerdown', onOutside);
      wrapper.remove();
      if (previousPalette === undefined) delete root.dataset.palette;
      else root.dataset.palette = previousPalette;
      announcePalette();
      instances.delete(doc);
    }
  };
  instances.set(doc, instance);
  return instance;
}
