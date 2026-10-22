/** Native details keep their semantics; height animation gives the state change continuity. */
export function setupAccordion(motion) {
  const items = [...document.querySelectorAll('.faq-list details')];
  const animations = new Map();
  function setOpen(item, open) {
    const before = item.getBoundingClientRect().height;
    animations.get(item)?.cancel();
    item.open = open;
    const after = item.getBoundingClientRect().height;
    if (motion.matches || document.hidden || Math.abs(before - after) < 1) return;
    const animation = item.animate([{ height: `${before}px` }, { height: `${after}px` }], {
      duration: open ? 850 : 520, easing: 'cubic-bezier(.22,.61,.36,1)'
    });
    animations.set(item, animation);
    animation.onfinish = () => animations.delete(item);
  }
  items.forEach(item => item.querySelector('summary').addEventListener('click', event => {
    event.preventDefault();
    const next = !item.open;
    if (next) items.forEach(other => { if (other !== item && other.open) setOpen(other, false); });
    setOpen(item, next);
  }));
  motion.addEventListener('change', () => {
    animations.forEach(animation => animation.cancel());
    animations.clear();
  });
}


