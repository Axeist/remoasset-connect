import { useEffect, useRef, useState } from 'react';
import { BrandLoader } from '@/components/BrandLoader';

/** Phone pull-to-refresh for the main scroll area: pull down at the top, release past the line, the page reloads fresh data. */
export function PullToRefresh({ target }: { target: React.RefObject<HTMLElement> }) {
  const [pull, setPull] = useState(0);
  const [busy, setBusy] = useState(false);
  const pullRef = useRef(0);

  useEffect(() => {
    const el = target.current;
    if (!el || !window.matchMedia('(pointer: coarse)').matches) return;
    let startY = 0;
    let active = false;
    const ts = (e: TouchEvent) => { if (el.scrollTop <= 0) { startY = e.touches[0].clientY; active = true; } };
    const tm = (e: TouchEvent) => {
      if (!active) return;
      const dy = e.touches[0].clientY - startY;
      if (dy > 0 && el.scrollTop <= 0) { pullRef.current = Math.min(dy * 0.5, 96); setPull(pullRef.current); }
      else { active = false; pullRef.current = 0; setPull(0); }
    };
    const te = () => {
      if (!active) return;
      active = false;
      if (pullRef.current >= 64) { setBusy(true); setPull(60); setTimeout(() => window.location.reload(), 500); }
      else { pullRef.current = 0; setPull(0); }
    };
    el.addEventListener('touchstart', ts, { passive: true });
    el.addEventListener('touchmove', tm, { passive: true });
    el.addEventListener('touchend', te, { passive: true });
    return () => { el.removeEventListener('touchstart', ts); el.removeEventListener('touchmove', tm); el.removeEventListener('touchend', te); };
  }, [target]);

  if (pull === 0 && !busy) return null;
  return (
    <div
      className="pointer-events-none fixed left-1/2 top-[max(3.5rem,env(safe-area-inset-top))] z-40 -translate-x-1/2"
      style={{ transform: `translate(-50%, ${pull - 36}px) rotate(${pull * 4}deg)`, opacity: Math.min(1, pull / 56), transition: busy ? 'transform .2s' : 'none' }}
      role="status"
      aria-label="Refreshing"
    >
      <span className="glass-strong flex h-10 w-10 items-center justify-center rounded-full border shadow-lg"><BrandLoader size={22} /></span>
    </div>
  );
}
