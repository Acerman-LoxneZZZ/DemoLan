const INITIAL_SPLIT = 52;
export const playgroundMoods = Object.freeze({
  expressive: { name: 'Выразительно', font: 'Unbounded', description: 'Широкий шрифт · ультрафиолет' },
  precise: { name: 'Точно', font: 'Manrope', description: 'Чёткий шрифт · ледяной синий' },
  warm: { name: 'Тепло', font: 'Cormorant Garamond', description: 'Живая антиква · шампань' }
});

export function comparisonValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(100, Math.max(0, Math.round(number))) : INITIAL_SPLIT;
}

function tutorContent() {
  return `<div class="demo-preview-nav"><span>Анна · математика</span><span>Знакомство с предметом</span></div>
    <div class="demo-preview-body"><h3>Математика,<br>которая становится<br><em>понятной.</em></h3><p class="demo-preview-copy">Разбираем сложное по шагам. Учимся замечать логику и находить свой путь к решению.</p><span class="demo-preview-action">Познакомиться <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h15M13 5l7 7-7 7"/></svg></span></div>
    <span class="demo-preview-symbol" aria-hidden="true">x²</span><div class="demo-preview-foot"><span>В своём темпе</span><span>От вопроса — к пониманию</span></div>`;
}

export function renderPlayground() {
  const content = tutorContent();
  return `<section class="demo-playground" id="demo-playground" data-mood="expressive" aria-labelledby="playground-title">
    <div class="demo-playground-inner">
      <div class="demo-playground-heading"><h2 id="playground-title">Один смысл.<br><em>Разный характер.</em></h2><p>Один и тот же текст может звучать по-разному. Двигайте границу, меняйте настроение — найдите подачу, которая ближе вам.</p></div>
      <div class="demo-moods" role="group" aria-label="Настроение демонстрации">${Object.entries(playgroundMoods).map(([id, mood]) => `<button class="demo-mood" type="button" data-demo-mood="${id}" aria-pressed="${id === 'expressive'}"><span class="demo-mood-swatch swatch-${id}" aria-hidden="true"></span><span><strong>${mood.name}</strong><small>${mood.description}</small></span><svg class="demo-mood-check" viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4 10-10"/></svg></button>`).join('')}</div>
      <div class="demo-experiment">
        <div class="demo-comparison-area"><div class="demo-comparison" style="--compare-split:52%">
          <div class="demo-preview demo-preview-after">${content}</div>
          <div class="demo-preview demo-preview-before" aria-hidden="true" inert>${content}</div>
          <div class="demo-compare-labels" aria-hidden="true"><span>До</span><span>После</span></div>
          <span class="demo-divider" aria-hidden="true"><span class="demo-divider-grip"><svg viewBox="0 0 24 24"><path d="m9 7-5 5 5 5M15 7l5 5-5 5"/></svg></span></span>
        </div><div class="demo-comparison-controls"><label for="demo-comparison-range" id="demo-comparison-help">Потяните границу или ползунок ниже</label><output class="demo-comparison-value" for="demo-comparison-range" aria-live="off">До: 52%</output><input class="demo-range" id="demo-comparison-range" type="range" min="0" max="100" value="52" step="1" aria-label="Доля исходного оформления" aria-valuetext="Исходное оформление: 52 процентов" aria-describedby="demo-comparison-help"></div><p class="demo-example-note">Учебный пример для вымышленного преподавателя. Содержание в обоих вариантах одинаковое.</p></div>
        <div class="demo-orbit-area"><div class="demo-orbit" aria-hidden="true"><canvas class="orbit-canvas" width="640" height="640"></canvas><svg class="orbit-fallback" viewBox="0 0 480 480" fill="none"><g transform="translate(240 240)" stroke="currentColor" stroke-width="24"><ellipse rx="155" ry="66" transform="rotate(-30)"/><ellipse rx="155" ry="66" transform="rotate(90)"/><ellipse rx="155" ry="66" transform="rotate(30)"/></g></svg></div><div class="demo-orbit-caption"><span class="demo-orbit-spark" aria-hidden="true"></span><p>Характер в движении<span>Свет и материал тоже подстраиваются под настроение.</span></p></div></div>
      </div>
      <div class="demo-playground-bottom"><p class="demo-mood-status" role="status" aria-live="polite">Выразительно. Шрифт Unbounded.</p><button class="demo-reset" type="button">Вернуть исходный вариант <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 9a8 8 0 1 1-1 7M5 4v5h5"/></svg></button></div>
    </div>
  </section>`;
}

export function setupPlayground(motion, doc = document) {
  const section = doc.querySelector('.demo-playground');
  if (!section) return null;
  if (section.playgroundController) return section.playgroundController;
  const comparison = section.querySelector('.demo-comparison');
  const range = section.querySelector('.demo-range');
  const output = section.querySelector('.demo-comparison-value');
  const status = section.querySelector('.demo-mood-status');
  const reset = section.querySelector('.demo-reset');
  const buttons = [...section.querySelectorAll('[data-demo-mood]')];
  const listeners = [];
  let animation;
  let dragging = null;
  function listen(element, type, callback) { element.addEventListener(type, callback); listeners.push(() => element.removeEventListener(type, callback)); }
  function setSplit(value) {
    const split = comparisonValue(value);
    range.value = String(split);
    range.setAttribute('aria-valuetext', `Исходное оформление: ${split} процентов`);
    comparison.style.setProperty('--compare-split', `${split}%`);
    output.textContent = `До: ${split}%`;
    return split;
  }
  function setMood(mood, announce = true) {
    if (!Object.hasOwn(playgroundMoods, mood)) return false;
    const previous = section.dataset.mood;
    section.dataset.mood = mood;
    for (const button of buttons) button.setAttribute('aria-pressed', String(button.dataset.demoMood === mood));
    const choice = playgroundMoods[mood];
    if (announce) status.textContent = `${choice.name}. Шрифт ${choice.font}.`;
    animation?.cancel();
    animation = null;
    if (previous !== mood && !motion?.matches && comparison.animate) animation = comparison.animate([{ opacity: .82 }, { opacity: 1 }], { duration: 240, easing: 'cubic-bezier(.16,1,.3,1)' });
    const CustomEventType = doc.defaultView?.CustomEvent || CustomEvent;
    section.dispatchEvent(new CustomEventType('moodchange', { detail: { mood }, bubbles: true }));
    return true;
  }
  listen(range, 'input', () => setSplit(range.value));
  function splitAt(event) {
    const rect = comparison.getBoundingClientRect();
    if (rect.width > 0) setSplit((event.clientX - rect.left) / rect.width * 100);
  }
  function releaseDrag(event) {
    if (dragging === null || (event?.pointerId !== undefined && event.pointerId !== dragging)) return;
    const id = dragging;
    dragging = null;
    if (comparison.hasPointerCapture?.(id)) comparison.releasePointerCapture(id);
  }
  listen(comparison, 'pointerdown', event => {
    if (event.button !== undefined && event.button !== 0) return;
    dragging = event.pointerId;
    comparison.setPointerCapture?.(event.pointerId);
    splitAt(event);
  });
  listen(comparison, 'pointermove', event => { if (dragging === event.pointerId) splitAt(event); });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) listen(comparison, type, releaseDrag);
  listen(range, 'keydown', event => {
    if (event.key !== 'Home' && event.key !== 'End') return;
    event.preventDefault();
    setSplit(event.key === 'Home' ? 0 : 100);
  });
  for (const button of buttons) listen(button, 'click', () => setMood(button.dataset.demoMood));
  listen(reset, 'click', () => { setSplit(INITIAL_SPLIT); setMood('expressive'); status.textContent = 'Исходный вариант восстановлен: выразительно, Unbounded, граница 52 процента.'; });
  function motionChanged() { if (motion?.matches) { animation?.cancel(); animation = null; } }
  motion?.addEventListener?.('change', motionChanged);
  setSplit(range.value);
  setMood(section.dataset.mood || 'expressive', false);
  const controller = { setSplit, setMood, destroy() { releaseDrag(); listeners.forEach(remove => remove()); animation?.cancel(); motion?.removeEventListener?.('change', motionChanged); delete section.playgroundController; } };
  section.playgroundController = controller;
  return controller;
}
