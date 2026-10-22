const limit = (value, min, max) => Math.min(max, Math.max(min, Number.isFinite(value) ? value : 0));

/** The preview stays legible at the edges of its pointer field. Angles are degrees. */
export function cardTiltTarget(clientX, clientY, rect) {
  if (!(rect?.width > 0) || !(rect?.height > 0)) return { rx: 0, ry: 0 };
  const x = limit((clientX - rect.left) / rect.width * 2 - 1, -1, 1);
  const y = limit((clientY - rect.top) / rect.height * 2 - 1, -1, 1);
  return { rx: -y * 4.5, ry: x * 7.5 };
}

/** Time-based damping gives the same response on different refresh-rate displays. */
export function advanceCardTilt(current, target, elapsed = 16) {
  const amount = 1 - Math.exp(-limit(elapsed, 0, 64) / 115);
  return {
    rx: current.rx + (target.rx - current.rx) * amount,
    ry: current.ry + (target.ry - current.ry) * amount,
  };
}

/**
 * The stage owns scroll rotation, a generated plane owns pointer tilt, and the
 * live article owns selection rotation. Rendering is synchronous for tab/ARIA
 * continuity; only a short inert copy of the outgoing article is retained.
 */
export function setupCardMotion({ motion } = {}) {
  const stage = document.querySelector('.concept-stage');
  const panel = document.querySelector('#concept-panel') || stage;
  if (!stage || !panel) return { swap(render) { if (panel) render(panel); }, reset() {}, destroy() {} };
  const preference = motion || matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  const plane = document.createElement('div');
  plane.className = 'card-motion-plane';
  while (panel.firstChild) plane.append(panel.firstChild);
  panel.append(plane);
  stage.setAttribute('data-card-motion', '');

  let destroyed = false;
  let visible = true;
  let frame = 0;
  let previousTime = 0;
  let current = { rx: 0, ry: 0 };
  let target = { rx: 0, ry: 0 };
  let snapshot = null;
  let revision = 0;
  const animations = new Set();
  const canMove = () => !destroyed && !preference.matches && !document.hidden && visible;

  function stopSwap() {
    revision += 1;
    for (const animation of animations) animation.cancel();
    animations.clear();
    snapshot?.remove();
    snapshot = null;
    plane.classList.remove('is-card-swapping');
  }

  function stopTilt() {
    cancelAnimationFrame(frame);
    frame = 0;
    previousTime = 0;
    current = { rx: 0, ry: 0 };
    target = { rx: 0, ry: 0 };
    plane.style.removeProperty('--card-rx');
    plane.style.removeProperty('--card-ry');
    plane.classList.remove('is-card-tilting');
  }

  function reset() { stopSwap(); stopTilt(); }

  function tick(time) {
    frame = 0;
    if (!canMove() || !finePointer.matches) { stopTilt(); return; }
    const elapsed = previousTime ? time - previousTime : 16;
    previousTime = time;
    current = advanceCardTilt(current, target, elapsed);
    const settled = Math.abs(current.rx - target.rx) + Math.abs(current.ry - target.ry) < .006;
    if (settled) current = { ...target };
    plane.style.setProperty('--card-rx', `${current.rx.toFixed(3)}deg`);
    plane.style.setProperty('--card-ry', `${current.ry.toFixed(3)}deg`);
    if (!settled) frame = requestAnimationFrame(tick);
    else {
      previousTime = 0;
      plane.classList.toggle('is-card-tilting', Boolean(target.rx || target.ry));
    }
  }

  function scheduleTilt() {
    if (frame || !canMove() || !finePointer.matches) return;
    plane.classList.add('is-card-tilting');
    frame = requestAnimationFrame(tick);
  }

  function onPointer(event) {
    if (event.pointerType === 'touch' || !canMove() || !finePointer.matches) return;
    target = cardTiltTarget(event.clientX, event.clientY, stage.getBoundingClientRect());
    scheduleTilt();
  }
  function releasePointer() { target = { rx: 0, ry: 0 }; scheduleTilt(); }
  function onVisibility() { if (document.hidden) reset(); }
  function onPreference() { if (preference.matches || !finePointer.matches) reset(); }

  function decorativeCopy(article) {
    const copy = article.cloneNode(true);
    for (const element of [copy, ...copy.querySelectorAll('*')]) {
      for (const attribute of ['id', 'name', 'tabindex', 'href', 'aria-labelledby', 'aria-describedby', 'for']) element.removeAttribute(attribute);
      if (element.hasAttribute('contenteditable')) element.setAttribute('contenteditable', 'false');
      if ('disabled' in element) element.disabled = true;
    }
    copy.inert = true;
    copy.setAttribute('inert', '');
    copy.setAttribute('aria-hidden', 'true');
    copy.classList.add('card-motion-snapshot');
    return copy;
  }

  function track(animation, complete) {
    animations.add(animation);
    animation.finished.then(() => {
      animations.delete(animation);
      complete();
    }, () => { animations.delete(animation); });
  }

  function swap(render) {
    if (destroyed) { render(panel); return; }
    const previous = plane.firstElementChild;
    const copy = canMove() && previous?.animate ? decorativeCopy(previous) : null;
    // Capture the currently displayed WAAPI pose before cancellation restores
    // the live article's base style during a rapid second selection.
    const displayed = copy ? getComputedStyle(previous) : null;
    const outgoingPose = { opacity: displayed?.opacity || '1', transform: displayed?.transform || 'none' };
    if (copy) {
      copy.style.setProperty('opacity', outgoingPose.opacity);
      copy.style.setProperty('transform', outgoingPose.transform);
    }
    stopSwap();
    // The new tab's contents and label are available in the same event turn.
    render(plane);
    const article = plane.firstElementChild;
    if (!copy || !article?.animate) return;
    const selection = revision;
    snapshot = copy;
    plane.append(copy);
    plane.classList.add('is-card-swapping');
    try {
      track(copy.animate([
        outgoingPose,
        { opacity: 0, transform: 'rotateY(17deg) rotateX(-2deg) translateZ(-85px) translateX(3%)' },
      ], { duration: 240, easing: 'cubic-bezier(.4,0,1,1)' }), () => {
        copy.remove();
        if (snapshot === copy) snapshot = null;
      });
      track(article.animate([
        { opacity: .28, transform: 'rotateY(-23deg) rotateX(4deg) translateZ(-110px) translateX(-3%)' },
        { opacity: 1, transform: 'rotateY(0) rotateX(0) translateZ(0) translateX(0)' },
      ], { duration: 660, easing: 'cubic-bezier(.16,1,.3,1)' }), () => {
        if (selection === revision) plane.classList.remove('is-card-swapping');
      });
    } catch {
      // An unavailable animation API must never hold the selected content back.
      stopSwap();
    }
  }

  stage.addEventListener('pointermove', onPointer, { passive: true });
  stage.addEventListener('pointerleave', releasePointer);
  stage.addEventListener('pointercancel', releasePointer);
  stage.addEventListener('focusin', releasePointer);
  document.addEventListener('visibilitychange', onVisibility);
  preference.addEventListener('change', onPreference);
  finePointer.addEventListener('change', onPreference);
  window.addEventListener('resize', stopTilt, { passive: true });
  const observer = typeof IntersectionObserver === 'function' ? new IntersectionObserver(entries => {
    visible = entries.some(entry => entry.isIntersecting);
    if (!visible) reset();
  }, { rootMargin: '80px 0px' }) : null;
  observer?.observe(stage);

  return { swap, reset, destroy() {
    if (destroyed) return;
    destroyed = true;
    reset();
    observer?.disconnect();
    stage.removeEventListener('pointermove', onPointer);
    stage.removeEventListener('pointerleave', releasePointer);
    stage.removeEventListener('pointercancel', releasePointer);
    stage.removeEventListener('focusin', releasePointer);
    document.removeEventListener('visibilitychange', onVisibility);
    preference.removeEventListener?.('change', onPreference);
    finePointer.removeEventListener?.('change', onPreference);
    window.removeEventListener('resize', stopTilt);
    while (plane.firstChild) panel.insertBefore(plane.firstChild, plane);
    plane.remove();
    stage.removeAttribute('data-card-motion');
  } };
}
