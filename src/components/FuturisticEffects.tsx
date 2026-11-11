import { useEffect } from 'react';

/**
 * Pointer-driven polish for hover devices: cursor glow on cards (.glow-card), a few degrees of tilt (.tilt-card)
 * and buttons that lean toward the cursor (.magnetic). Off for touch screens and reduced motion.
 */
export function FuturisticEffects() {
  useEffect(() => {
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    if (!fine || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let raf = 0;
    let last: PointerEvent | null = null;

    const apply = () => {
      raf = 0;
      const e = last;
      if (!e) return;
      const target = e.target as HTMLElement | null;
      if (!target?.closest) return;
      const glow = target.closest<HTMLElement>('.glow-card');
      if (glow) {
        const r = glow.getBoundingClientRect();
        glow.style.setProperty('--mx', `${e.clientX - r.left}px`);
        glow.style.setProperty('--my', `${e.clientY - r.top}px`);
      }
      const tilt = target.closest<HTMLElement>('.tilt-card');
      if (tilt) {
        const r = tilt.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width;
        const py = (e.clientY - r.top) / r.height;
        tilt.style.setProperty('--ry', `${((px - 0.5) * 7).toFixed(2)}deg`);
        tilt.style.setProperty('--rx', `${((0.5 - py) * 5).toFixed(2)}deg`);
      }
      const mag = target.closest<HTMLElement>('.magnetic');
      if (mag) {
        const r = mag.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height / 2);
        mag.style.translate = `${(dx * 0.12).toFixed(1)}px ${(dy * 0.2).toFixed(1)}px`;
      }
    };
    const onMove = (e: PointerEvent) => {
      last = e;
      if (!raf) raf = requestAnimationFrame(apply);
    };
    const onOut = (e: PointerEvent) => {
      const el = e.target as HTMLElement | null;
      const mag = el?.closest?.<HTMLElement>('.magnetic');
      if (mag && !mag.contains(e.relatedTarget as Node)) mag.style.translate = '';
      const tilt = el?.closest?.<HTMLElement>('.tilt-card');
      if (tilt && !tilt.contains(e.relatedTarget as Node)) { tilt.style.setProperty('--rx', '0deg'); tilt.style.setProperty('--ry', '0deg'); }
    };
    document.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerout', onOut, { passive: true });
    return () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerout', onOut);
      cancelAnimationFrame(raf);
    };
  }, []);
  return null;
}
