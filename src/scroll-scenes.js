export const clamp01 = value => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));

export function revealProgress(top, viewportHeight) {
  return clamp01((viewportHeight * .92 - top) / Math.max(1, viewportHeight * .34));
}

export function sectionProgress(top, height, viewportHeight) {
  return clamp01((viewportHeight * .8 - top) / Math.max(1, height + viewportHeight * .45));
}

export function assemblyProgress(top, height, viewportHeight) {
  return clamp01((viewportHeight * .62 - top) / Math.max(1, height - viewportHeight * .2));
}

export function footerProgress(top, viewportHeight, remainingScroll) {
  const end = Math.max(viewportHeight * .58, top - Math.max(0, remainingScroll));
  const start = Math.max(viewportHeight * .92, end + 1);
  return clamp01((start - top) / (start - end));
}

/** One passive scroll listener directs all visible scenes; the page never captures scrolling. */
export function setupScrollScenes(motion, stages) {
  const root = document.documentElement;
  const hero = document.querySelector('.hero');
  const sculpture = document.querySelector('.hero-art');
  const gallery = document.querySelector('.concept-stage');
  const scope = document.querySelector('.scope-section');
  const process = document.querySelector('.process-art');
  const steps = [...document.querySelectorAll('[data-process-step]')];
  const footer = document.querySelector('.footer-wordmark');
  const records = [];
  const active = new Set();
  let frame = 0;
  let lastSculpture = -1;
  let lastStage = -1;

  function register(element, kind) {
    if (!element) return;
    const record = { element, kind, lines: kind === 'light' ? [...element.querySelectorAll('.light-line')] : [] };
    records.push(record);
    if (kind === 'reveal') element.classList.add('scroll-reveal');
  }
  register(hero, 'hero');
  register(gallery, 'gallery');
  register(scope, 'scope');
  register(document.querySelector('.process-list'), 'assembly');
  register(footer, 'footer');
  register(document.querySelector('#value-title'), 'light');
  document.querySelectorAll('.scope-panel').forEach(el => register(el, 'fan'));
  document.querySelectorAll('.faq-entry').forEach(el => register(el, 'wave'));
  document.querySelectorAll('.value-statements article, .contact-heading').forEach(el => register(el, 'reveal'));
  const byElement = new Map(records.map(record => [record.element, record]));

  function setSculpture(value) {
    if (Math.abs(value - lastSculpture) < .002) return;
    lastSculpture = value;
    sculpture.dataset.scrollProgress = value.toFixed(4);
    sculpture.dispatchEvent(new CustomEvent('sculptureprogress', { detail: { progress: value } }));
  }

  function showStage(progress) {
    const index = Math.min(stages.length - 1, Math.floor(progress * stages.length));
    if (index === lastStage) return;
    lastStage = index;
    process.dataset.stage = String(index);
    process.querySelector('.stage-name').textContent = stages[index];
    steps.forEach((step, i) => step.classList.toggle('is-active', i === index));
  }

  function reset() {
    records.forEach(({ element, lines }) => {
      for (const property of ['--reveal', '--fan-progress', '--wave-progress']) element.style.setProperty(property, '1');
      lines.forEach(line => line.style.setProperty('--line-progress', '1'));
    });
    hero.style.setProperty('--hero-progress', '0');
    gallery.style.setProperty('--gallery-progress', '1');
    scope.style.setProperty('--fold-turn', '-12deg');
    scope.style.setProperty('--fold-rise', '0px');
    scope.style.setProperty('--fold-spread', '0px');
    process.style.setProperty('--assembly', '1');
    footer.style.setProperty('--footer-progress', '1');
    setSculpture(0);
    showStage(1);
  }

  function update() {
    frame = 0;
    if (document.hidden || motion.matches) return;
    const height = innerHeight;
    const pageHeight = Math.max(1, root.scrollHeight - height);
    // Finish every geometry read before the material properties are written.
    const measurements = [...active].map(record => ({
      ...record, rect: record.element.getBoundingClientRect(),
      lineRects: record.lines.map(line => ({ line, rect: line.getBoundingClientRect() })),
    }));
    root.style.setProperty('--page-progress', clamp01(scrollY / pageHeight).toFixed(5));
    for (const { element, kind, rect, lineRects } of measurements) {
      if (kind === 'reveal') element.style.setProperty('--reveal', revealProgress(rect.top, height).toFixed(4));
      if (kind === 'fan') element.style.setProperty('--fan-progress', revealProgress(rect.top, height).toFixed(4));
      if (kind === 'wave') element.style.setProperty('--wave-progress', revealProgress(rect.top, height).toFixed(4));
      if (kind === 'light') lineRects.forEach(({ line, rect: lineRect }) => line.style.setProperty('--line-progress', revealProgress(lineRect.top, height).toFixed(4)));
      if (kind === 'hero') {
        const progress = clamp01(-rect.top / Math.max(1, rect.height * .85));
        element.style.setProperty('--hero-progress', progress.toFixed(4));
        setSculpture(progress);
      }
      if (kind === 'gallery') {
        const progress = revealProgress(rect.top, height);
        element.style.setProperty('--gallery-progress', progress.toFixed(4));
      }
      if (kind === 'scope') {
        const progress = sectionProgress(rect.top, rect.height, height);
        element.style.setProperty('--fold-turn', `${(-32 + progress * 68).toFixed(2)}deg`);
        element.style.setProperty('--fold-rise', `${(-progress * 55).toFixed(2)}px`);
        element.style.setProperty('--fold-spread', `${((1 - progress) * 28).toFixed(2)}px`);
      }
      if (kind === 'assembly') {
        const progress = assemblyProgress(rect.top, rect.height, height);
        process.style.setProperty('--assembly', progress.toFixed(4));
        showStage(progress);
      }
      if (kind === 'footer') element.style.setProperty('--footer-progress', footerProgress(rect.top, height, pageHeight - scrollY).toFixed(4));
    }
  }

  function schedule() {
    if (!frame && !document.hidden && !motion.matches) frame = requestAnimationFrame(update);
  }
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      const record = byElement.get(entry.target);
      if (entry.isIntersecting) active.add(record);
      else {
        active.delete(record);
        // A completed passage stays complete; scrolling back naturally rebuilds it.
        if (!motion.matches) {
          const value = entry.boundingClientRect.bottom < 0 ? '1' : '0';
          const property = { reveal: '--reveal', fan: '--fan-progress', wave: '--wave-progress' }[record.kind];
          if (property) record.element.style.setProperty(property, value);
          if (record.kind === 'light') record.lines.forEach(line => line.style.setProperty('--line-progress', value));
        }
      }
    }
    schedule();
  }, { rootMargin: '80px 0px 80px 0px' });
  records.forEach(({ element }) => observer.observe(element));
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule, { passive: true });
  const resizeObserver = new ResizeObserver(schedule);
  resizeObserver.observe(document.body);
  function onVisibility() {
    if (document.hidden) { cancelAnimationFrame(frame); frame = 0; }
    else schedule();
  }
  document.addEventListener('visibilitychange', onVisibility);
  function onMotion() {
    cancelAnimationFrame(frame); frame = 0;
    if (motion.matches) reset();
    else schedule();
  }
  motion.addEventListener('change', onMotion);
  if (motion.matches) reset();
  else {
    process.style.setProperty('--assembly', '0');
    showStage(0);
    schedule();
  }
  return { destroy() {
    cancelAnimationFrame(frame);
    observer.disconnect(); resizeObserver.disconnect();
    window.removeEventListener('scroll', schedule);
    window.removeEventListener('resize', schedule);
    document.removeEventListener('visibilitychange', onVisibility);
    motion.removeEventListener?.('change', onMotion);
    reset();
  } };
}
