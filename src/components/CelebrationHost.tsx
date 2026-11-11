import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { m, AnimatePresence } from 'framer-motion';
import { CELEBRATE_EVENT, getCelebrationMode, type CelebrateDetail } from '@/lib/celebrate';

function initials(text: string) {
  return (text || '').trim().split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase() || 'NL';
}

function LeadScene({ name }: { name: string }) {
  return (
    <svg viewBox="0 0 230 130" className="cel-lead h-auto w-[230px] max-w-full overflow-visible" aria-hidden="true">
      <rect className="fl" x="6" y="6" width="218" height="118" rx="16" />
      <rect className="ol" x="6" y="6" width="218" height="118" rx="16" />
      <circle className="ring" cx="48" cy="52" r="22" />
      <circle className="av" cx="48" cy="52" r="22" />
      <text className="avt" x="48" y="57" textAnchor="middle">{initials(name)}</text>
      <rect className="ln" x="84" y="38" width="100" height="10" rx="5" />
      <rect className="ln2" x="84" y="58" width="68" height="8" rx="4" />
      <rect className="ln2" x="22" y="92" width="150" height="8" rx="4" />
      <circle className="cb" cx="206" cy="22" r="13" />
      <path className="ck" d="M200 22l5 5 9-10" />
    </svg>
  );
}

function RfqScene() {
  return (
    <svg viewBox="0 0 240 130" className="cel-rfq h-auto w-[240px] max-w-full overflow-visible" aria-hidden="true">
      <path className="trail" d="M14 112 C 60 112, 90 80, 130 52 S 190 20, 214 18" />
      <g className="plane">
        <path d="M0 0 L34 -14 L14 18 L10 4 Z" />
        <path d="M10 4 L34 -14" className="fold" />
      </g>
      <circle className="cb" cx="214" cy="22" r="14" />
      <path className="ck" d="M207 22l5 5 10-11" />
      <g className="chips">
        <rect x="20" y="22" width="52" height="12" rx="6" />
        <rect x="20" y="42" width="38" height="10" rx="5" />
      </g>
    </svg>
  );
}

function WonScene() {
  const bits = useMemo(
    () => Array.from({ length: 30 }, (_, i) => {
      const a = (i / 30) * Math.PI * 2 + Math.random() * 0.4;
      const d = 90 + Math.random() * 90;
      const colors = ['hsl(var(--primary))', 'hsl(var(--accent))', 'hsl(var(--success))', '#ffd36e'];
      return { dx: Math.cos(a) * d, dy: Math.sin(a) * d - 30, rot: Math.floor(Math.random() * 720 - 360), c: colors[i % colors.length], delay: Math.random() * 0.12 };
    }),
    [],
  );
  return (
    <div className="cel-won relative flex h-[150px] w-[220px] items-center justify-center" aria-hidden="true">
      <div className="cel-confetti">
        {bits.map((b, i) => (
          <i key={i} style={{ ['--dx' as string]: `${b.dx}px`, ['--dy' as string]: `${b.dy}px`, ['--rot' as string]: `${b.rot}deg`, background: b.c, animationDelay: `${0.25 + b.delay}s` }} />
        ))}
      </div>
      <svg viewBox="0 0 120 120" className="h-[120px] w-[120px]">
        <circle className="disc" cx="60" cy="60" r="52" />
        <path className="ck" d="M34 62l17 17 36-38" />
      </svg>
    </div>
  );
}

/** Mounted once at the app root. Listens for celebrate() and plays the matching moment. */
export function CelebrationHost() {
  const [current, setCurrent] = useState<(CelebrateDetail & { id: number }) | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const seq = useRef(0);

  const dismiss = useCallback(() => {
    clearTimeout(timer.current);
    setCurrent(null);
  }, []);

  useEffect(() => {
    const onEvent = (e: Event) => {
      const detail = (e as CustomEvent<CelebrateDetail>).detail;
      if (!detail) return;
      if (getCelebrationMode() !== 'full') return;
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      clearTimeout(timer.current);
      setCurrent({ ...detail, id: ++seq.current });
      timer.current = setTimeout(() => setCurrent(null), detail.kind === 'won' ? 2900 : 2300);
    };
    window.addEventListener(CELEBRATE_EVENT, onEvent);
    return () => {
      window.removeEventListener(CELEBRATE_EVENT, onEvent);
      clearTimeout(timer.current);
    };
  }, []);

  useEffect(() => {
    if (!current) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') dismiss(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [current, dismiss]);

  return (
    <AnimatePresence>
      {current && (
        <m.div
          key={current.id}
          className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/35 p-6 backdrop-blur-[3px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.18 } }}
          onClick={dismiss}
          role="status"
          aria-live="polite"
        >
          <m.div
            className="relative flex max-w-[340px] flex-col items-center gap-3 rounded-[28px] border border-border bg-card px-9 pb-7 pt-9 text-center shadow-2xl"
            initial={{ scale: 0.86, y: 18, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1, transition: { type: 'spring', stiffness: 380, damping: 26 } }}
            exit={{ scale: 0.96, y: 8, opacity: 0, transition: { duration: 0.16 } }}
          >
            {current.kind === 'lead' && <LeadScene name={current.subtitle || current.title} />}
            {current.kind === 'rfq' && <RfqScene />}
            {current.kind === 'won' && <WonScene />}
            <div className="cel-text space-y-1">
              <p className="font-display text-2xl font-bold tracking-tight text-foreground">{current.title}</p>
              {current.subtitle && <p className="text-sm text-muted-foreground">{current.subtitle}</p>}
            </div>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground/60">Tap anywhere to continue</p>
          </m.div>
        </m.div>
      )}
    </AnimatePresence>
  );
}
