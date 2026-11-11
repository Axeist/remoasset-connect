import { useEffect } from 'react';
import autoAnimate from '@formkit/auto-animate';

/**
 * Any element with data-animate-list gets add / remove / reorder animation for its children
 * (rows glide into place, new rows ease in, removed rows ease out). Honors reduced motion.
 */
export function AutoAnimateLists() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const seen = new WeakSet<Element>();
    const attach = () => {
      document.querySelectorAll('[data-animate-list]').forEach((el) => {
        if (seen.has(el)) return;
        seen.add(el);
        autoAnimate(el as HTMLElement, { duration: 260, easing: 'cubic-bezier(.22,1,.36,1)' });
      });
    };
    attach();
    let raf = 0;
    const observer = new MutationObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(attach);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => { observer.disconnect(); cancelAnimationFrame(raf); };
  }, []);
  return null;
}
