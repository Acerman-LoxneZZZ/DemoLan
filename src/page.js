import { renderConcept } from './concepts.js';
import { renderPlayground } from './playground.js';

const e = (value = '') => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const lines = value => e(value).replace(/\n/g, '<br>');
const lightLines = value => String(value).split('\n').map(line => `<span class="light-line">${e(line)}</span>`).join('<br>');
const arrow = (className = '') => `<svg class="arrow ${className}" width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" stroke-width="1.5" stroke-linecap="square"/></svg>`;
const logo = '<span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i></span>';

export function renderDocument(s) {
  const connected = s.form.mode === 'endpoint' && Boolean(s.form.endpoint);
  const nav = s.navigation.items.map(item => `<a href="${e(item.href)}">${e(item.label)}</a>`).join('');
  const fields = [
    { id: 'name', label: s.form.name, placeholder: s.form.namePlaceholder, auto: 'name', max: 80 },
    { id: 'specialization', label: s.form.specialization, placeholder: s.form.specializationPlaceholder, auto: 'organization-title', max: 120 },
    { id: 'contact', label: s.form.contact, placeholder: s.form.contactPlaceholder, auto: 'off', max: 160 }
  ];
  return `<!doctype html>
<html lang="ru" data-palette="${e(s.palette || 'ultraviolet')}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#08090d">
  <title>${e(s.title)}</title>
  <meta name="description" content="${e(s.description)}">
  <meta property="og:title" content="${e(s.title)}">
  <meta property="og:description" content="${e(s.description)}">
  <meta property="og:type" content="website">
  <meta property="og:locale" content="ru_RU">
  ${s.canonicalUrl ? `<link rel="canonical" href="${e(s.canonicalUrl)}"><meta property="og:url" content="${e(s.canonicalUrl)}">` : ''}
  <link rel="icon" href="./assets/favicon.svg" type="image/svg+xml">
  <link rel="preload" href="./assets/fonts/manrope-cyrillic.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="./src/fonts.css">
  <link rel="stylesheet" href="./src/display-font.css">
  <link rel="stylesheet" href="./src/styles.css">
  <link rel="stylesheet" href="./src/concepts.css">
  <link rel="stylesheet" href="./src/experience.css">
  <link rel="stylesheet" href="./src/card-motion.css">
  <link rel="stylesheet" href="./src/identity.css">
  <link rel="stylesheet" href="./src/palette-tokens.css">
  <link rel="stylesheet" href="./src/viewport.css">
  <link rel="stylesheet" href="./src/scroll-details.css">
  <link rel="stylesheet" href="./src/palette-preview.css">
  <link rel="stylesheet" href="./src/playground.css">
  <link rel="stylesheet" href="./src/orbit-scene.css">
</head>
<body id="top">
  <div class="scroll-progress" aria-hidden="true"></div>
  <a class="skip-link" href="#main">${e(s.accessibility.skip)}</a>
  <header class="site-header wrap">
    <a class="brand" href="#top" aria-label="${e(s.brand)} — ${e(s.accessibility.top)}">${logo}<span class="brand-text">${e(s.brand)}<small>${e(s.hero.service)}</small></span></a>
    <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="site-nav"><span data-menu-label>${e(s.navigation.menu)}</span><span class="menu-lines" aria-hidden="true"></span></button>
    <nav class="site-nav" id="site-nav" aria-label="${e(s.navigation.label)}">${nav}<a class="nav-cta" href="#contact">${e(s.navigation.cta)}${arrow()}</a></nav>
  </header>
  <main id="main">
    <section class="hero wrap" aria-labelledby="hero-title">
      <h1 id="hero-title">${e(s.hero.title[0])}<br><span>${s.hero.emphasis ? e(s.hero.title[1]).replace(e(s.hero.emphasis), `<em>${e(s.hero.emphasis)}</em>`) : e(s.hero.title[1])}</span></h1>
      <p class="hero-aside">${e(s.hero.aside)}</p>
      <div class="hero-art" aria-hidden="true">
        <picture class="sculpture-fallback"><source srcset="./assets/shadow-720.webp 720w, ./assets/shadow-1440.webp 1440w" sizes="(max-width: 600px) 100vw, 65vw" type="image/webp"><img class="shadow-image" src="./assets/shadow-1440.webp" width="1440" height="1440" alt="" decoding="async"></picture>
        <canvas class="sculpture-canvas" width="960" height="720"></canvas>
        <span class="sculpture-orbit orbit-one"></span><span class="sculpture-orbit orbit-two"></span>
        <span class="sculpture-anchor anchor-one"></span><span class="sculpture-anchor anchor-two"></span>
      </div>
      <div class="hero-copy"><p>${e(s.hero.description)}</p><a class="button button-primary" href="#contact">${e(s.hero.primary)}${arrow()}</a><a class="text-link" href="#concepts">${e(s.hero.secondary)}${arrow('diagonal')}</a></div>
      <div class="hero-bottom"><a href="#meaning" class="scroll-link">${arrow('down')}${e(s.hero.scroll)}</a><p>${e(s.hero.artCaption)}<span class="pointer-hint">${e(s.hero.artHint)}</span></p></div>
    </section>

    <section id="meaning" class="value-section wrap section-space" aria-labelledby="value-title">
      <div class="value-intro"><h2 id="value-title">${lightLines(s.value.title)}</h2><p>${e(s.value.intro)}</p></div>
      <div class="value-statements">${s.value.statements.map((item, i) => `<article><span class="meaning-mark meaning-mark-${i}" aria-hidden="true"></span><h3>${e(item.title)}</h3><p>${e(item.text)}</p></article>`).join('')}</div>
    </section>

    <section class="concepts-section section-space" id="concepts" aria-labelledby="concepts-title">
      <div class="wrap"><div class="section-heading"><h2 id="concepts-title">${lines(s.concepts.title)}</h2><p>${e(s.concepts.intro)}</p></div>
        <div class="concept-toolbar"><span class="concept-label"><i aria-hidden="true"></i>${e(s.concepts.label)}</span><div class="concept-tabs" role="tablist" aria-label="${e(s.concepts.tabsLabel)}">${s.concepts.items.map((item, i) => `<button type="button" role="tab" id="tab-${item.id}" aria-controls="concept-panel" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}" data-concept="${item.id}">${e(item.label)}</button>`).join('')}</div></div>
        <div class="concept-stage" id="concept-panel" role="tabpanel" tabindex="0" aria-labelledby="tab-${s.concepts.items[0].id}">${renderConcept({ ...s.concepts.items[0], actionContext: s.concepts.visit })}</div>
        <div class="concept-caption"><p>${e(s.concepts.note)}</p><span id="concept-note" aria-live="polite">${e(s.concepts.items[0].note)}</span></div>
      </div>
    </section>

    <section class="scope-section" id="approach" aria-labelledby="scope-title"><div class="scope-layout wrap section-space"><div class="scope-heading"><h2 id="scope-title">${lines(s.scope.title)}</h2><p>${e(s.scope.description)}</p><div class="scope-seal" aria-hidden="true"><span></span><span></span><span></span><span></span></div></div><div class="scope-list">${s.scope.items.map(item => `<div class="scope-panel"><article><h3>${e(item.title)}</h3><p>${e(item.text)}</p></article></div>`).join('')}<p class="scope-note">${e(s.scope.footer)}</p></div></div></section>

    <section class="process-section wrap section-space" id="process" aria-labelledby="process-title"><div class="section-heading"><h2 id="process-title">${lines(s.process.title)}</h2><p>${e(s.process.intro)}</p></div><div class="process-layout"><div class="process-art" data-stage="3" aria-hidden="true"><div class="page-form"><div class="page-slice slice-1"><i></i><i></i><i></i></div><div class="page-slice slice-2"><i></i></div><div class="page-slice slice-3"><i></i><i></i></div><div class="page-slice slice-4"><i></i><i></i><i></i></div><span class="page-accent"></span></div><div class="process-art-caption"><span>${e(s.process.artLabel)}</span><span class="stage-name">${e(s.process.artStages[3])}</span></div></div><ol class="process-list">${s.process.items.map((item, i) => `<li data-process-step="${i}"><span class="step-number" aria-hidden="true">0${i + 1}</span><div><h3>${e(item.title)}</h3><p>${e(item.text)}</p></div></li>`).join('')}</ol></div></section>

    <section class="faq-section wrap section-space" id="questions" aria-labelledby="faq-title"><div class="faq-heading"><h2 id="faq-title">${lines(s.faq.title)}</h2><p>${e(s.faq.intro)}</p></div><div class="faq-list">${s.faq.items.map((item, i) => `<div class="faq-entry"><details name="practice-questions"${i === 0 ? ' open' : ''}><summary>${e(item.question)}<span class="faq-sign" aria-hidden="true"></span></summary><div class="faq-answer"><p>${e(item.answer)}</p></div></details></div>`).join('')}</div></section>

    <section class="contact-section" id="contact" aria-labelledby="contact-title"><div class="contact-layout wrap section-space"><div class="contact-heading"><h2 id="contact-title">${lines(s.form.title)}</h2><p>${e(s.form.intro)}</p><div class="contact-mark" aria-hidden="true">${logo}</div>${s.contacts.email || s.contacts.telegram ? `<div class="contact-links">${s.contacts.email ? `<a class="text-link" href="mailto:${e(s.contacts.email)}">${e(s.contacts.email)}${arrow()}</a>` : ''}${s.contacts.telegram ? `<a class="text-link" href="${e(s.contacts.telegram)}" target="_blank" rel="noopener noreferrer">Telegram${arrow('diagonal')}</a>` : ''}</div>` : ''}</div><div class="contact-form-area">
        <p class="form-notice">${e(connected ? s.form.connectedNotice : s.form.demoNotice)}</p>
        <form id="inquiry-form" novalidate>
          <p class="form-error-summary" id="form-error-summary" role="alert" hidden></p>
          ${fields.map(field => `<div class="form-field field-${field.id}"><label for="field-${field.id}">${e(field.label)}<span aria-label="${e(s.accessibility.required)}">*</span></label><input id="field-${field.id}" name="${field.id}" type="text" placeholder="${e(field.placeholder)}" autocomplete="${field.auto}" maxlength="${field.max}" aria-describedby="${field.id}-error" required><span class="field-error" id="${field.id}-error"></span></div>`).join('')}
          <div class="form-field field-message"><label for="message">${e(s.form.message)}<span class="optional">${e(s.form.messageOptional)}</span></label><textarea id="message" name="message" rows="3" maxlength="3000" placeholder="${e(s.form.messagePlaceholder)}" aria-describedby="message-error"></textarea><span class="field-error" id="message-error"></span></div>
          <button class="button button-dark form-submit" type="submit"><span>${e(connected ? s.form.send : s.form.submit)}</span>${arrow()}</button><p class="form-privacy">${e(connected ? s.form.connectedPrivacy : s.form.privacy)}</p>
        </form>
        <div id="form-result" class="form-result" hidden tabindex="-1"><h3 id="result-title">${e(s.form.resultTitle)}</h3><p id="result-description">${e(s.form.resultText)}</p><label for="inquiry-text" class="sr-only">${e(s.form.resultLabel)}</label><textarea id="inquiry-text" rows="8" readonly spellcheck="false"></textarea><div class="result-actions"><button class="button button-dark" type="button" id="copy-inquiry"><span>${e(s.form.copy)}</span>${arrow()}</button><button type="button" class="text-button" id="edit-inquiry">${e(s.form.edit)}</button></div><p class="copy-status" id="copy-status" role="status"></p></div>
      </div></div></section>
    ${s.playground?.enabled === false ? '' : renderPlayground()}
  </main>
  <footer class="site-footer wrap"><div class="footer-top"><p>${e(s.footer.line)}</p><a class="text-link" href="#top">${e(s.footer.back)}${arrow('up')}</a></div><div class="footer-wordmark" aria-hidden="true">${e(s.brand)}<i></i></div><div class="footer-bottom"><span>${e(s.brand)}</span><button class="motion-toggle" type="button" id="motion-toggle" aria-pressed="false">${e(s.accessibility.motionReduce)}</button><span>${e(s.footer.note)}</span></div></footer>
  <script type="module" src="./src/main.js"></script>
</body>
</html>`;
}
