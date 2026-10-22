const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, (character) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}[character]));

const arrow = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 12h15M13 5l7 7-7 7"/></svg>';

const art = {
  tutor: (letter) => `<div class="concept__art tutor-art" aria-hidden="true">
    <span class="tutor-art__letter">${letter}</span>
    <svg class="tutor-art__path" viewBox="0 0 370 350" fill="none"><path d="M30 304h130c87 0 101-76 101-125V45M244 65l17-21 18 21"/><circle cx="30" cy="304" r="5"/></svg>
    <span class="tutor-art__rule"></span>
  </div>`,
  trainer: (letter) => `<div class="concept__art trainer-art" aria-hidden="true">
    <span class="trainer-art__letter">${letter}</span>
    <span class="trainer-art__bar trainer-art__bar--one"></span>
    <span class="trainer-art__bar trainer-art__bar--two"></span>
  </div>`,
  psychologist: () => `<div class="concept__art psychologist-art" aria-hidden="true">
    <svg viewBox="0 0 300 360" fill="none"><ellipse cx="150" cy="180" rx="100" ry="146" transform="rotate(-23 150 180)"/><ellipse cx="150" cy="180" rx="100" ry="146" transform="rotate(23 150 180)"/><path d="M34 318h232M150 25v310"/></svg>
  </div>`,
  doctor: () => `<div class="concept__art doctor-art" aria-hidden="true">
    <svg viewBox="0 0 320 320" fill="none"><path d="M160 20v280M20 160h280"/><circle cx="160" cy="160" r="105"/><path class="doctor-art__arc" d="M160 55a105 105 0 0 1 105 105H160Z"/><path d="M55 55h210v210H55z"/><circle class="doctor-art__point" cx="160" cy="160" r="5"/></svg>
  </div>`,
};

/** Render one authored demonstration. The caller owns tabs and selection state. */
export function renderConcept(concept = {}) {
  const id = Object.hasOwn(art, concept.id) ? concept.id : 'tutor';
  const titleId = `concept-title-${id}`;
  const brand = escapeHtml(concept.brand);
  const title = escapeHtml(concept.title);
  const description = escapeHtml(concept.description);
  const action = escapeHtml(concept.action);
  const note = escapeHtml(concept.note);
  const letter = escapeHtml(Array.from(String(concept.brand || concept.title || ''))[0]?.toUpperCase() || '');
  const tags = (Array.isArray(concept.tags) ? concept.tags : []).map((tag) => `<li>${escapeHtml(tag)}</li>`).join('');

  return `<article class="concept concept--${id}" aria-labelledby="${titleId}">
    <header class="concept__masthead">
      <span class="concept__brand">${brand}</span>
      <span class="concept__note">${note}</span>
    </header>
    <div class="concept__hero">
      <h3 class="concept__title" id="${titleId}">${title}</h3>
      ${art[id](letter)}
      <div class="concept__copy">
        <p class="concept__description">${description}</p>
        <a class="concept__action" href="#contact" aria-label="${action}${concept.actionContext ? ' — ' + escapeHtml(concept.actionContext) : ''}"><span>${action}</span>${arrow}</a>
      </div>
    </div>
    <ul class="concept__tags" aria-label="${brand}">${tags}</ul>
  </article>`;
}
