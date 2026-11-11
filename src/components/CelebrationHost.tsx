import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { m, AnimatePresence } from 'framer-motion';
import { CELEBRATE_EVENT, getCelebrationMode, type CelebrateDetail } from '@/lib/celebrate';
import { cn } from '@/lib/utils';

const EASE = [0.22, 1, 0.36, 1] as const;

function initials(text: string) {
  return (text || '').trim().split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase() || 'NL';
}

const SPARK_COLORS = ['hsl(var(--primary))', 'hsl(var(--accent))', 'hsl(var(--success))', '#ffd36e', '#ffffff'];

function useSparks(count: number, minDist: number, spread: number) {
  return useMemo(
    () => Array.from({ length: count }, (_, i) => {
      const a = (i / count) * Math.PI * 2 + Math.random() * 0.5;
      const d = minDist + Math.random() * spread;
      return { x: Math.cos(a) * d, y: Math.sin(a) * d, r: Math.floor(Math.random() * 540 - 270), c: SPARK_COLORS[i % SPARK_COLORS.length], delay: Math.random() * 0.15, round: i % 3 === 0 };
    }),
    [count, minDist, spread],
  );
}

/** Lead created: the lead card draws itself (outline, fill, avatar, lines, chips), a check badge lands, ripples spread, then actions rise in. */
function LeadScene({ detail, onView, onAnother }: { detail: CelebrateDetail; onView: () => void; onAnother: () => void }) {
  const name = detail.subtitle || detail.title;
  const chips = (detail.chips ?? []).slice(0, 3);
  const spring = { type: 'spring' as const, stiffness: 420, damping: 18 };
  return (
    <m.div
      className="glass-strong relative w-[min(92vw,380px)] overflow-hidden rounded-[28px] border px-7 pb-6 pt-8 text-center shadow-2xl"
      initial={{ scale: 0.88, y: 24, opacity: 0 }}
      animate={{ scale: 1, y: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 320, damping: 26 }}
    >
      {/* soft light that blooms behind the card */}
      <m.div
        className="pointer-events-none absolute left-1/2 top-[96px] h-52 w-52 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/30 blur-3xl"
        initial={{ scale: 0.3, opacity: 0 }}
        animate={{ scale: [0.3, 1.5, 1.15], opacity: [0, 0.8, 0.5] }}
        transition={{ duration: 1.6, ease: 'easeOut' }}
      />
      <m.div animate={{ y: [0, -4, 0] }} transition={{ delay: 2.1, duration: 3.4, repeat: Infinity, ease: 'easeInOut' }} className="relative mx-auto w-[260px]">
        <svg viewBox="0 0 260 156" className="h-auto w-full overflow-visible" aria-hidden="true">
          <defs>
            <linearGradient id="lc-fill" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="hsl(var(--card))" />
              <stop offset="1" stopColor="hsl(var(--primary) / .10)" />
            </linearGradient>
            <linearGradient id="lc-sheen" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#fff" stopOpacity="0" />
              <stop offset=".5" stopColor="#fff" stopOpacity=".55" />
              <stop offset="1" stopColor="#fff" stopOpacity="0" />
            </linearGradient>
            <clipPath id="lc-clip"><rect x="6" y="14" width="240" height="132" rx="18" /></clipPath>
          </defs>
          {/* card body */}
          <m.rect x="6" y="14" width="240" height="132" rx="18" fill="url(#lc-fill)" stroke="hsl(var(--border))" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.45, duration: 0.35 }} />
          {/* outline that draws itself */}
          <m.rect x="6" y="14" width="240" height="132" rx="18" fill="none" stroke="hsl(var(--primary))" strokeWidth="2.2" strokeLinecap="round" initial={{ pathLength: 0, opacity: 1 }} animate={{ pathLength: 1, opacity: [1, 1, 0.25] }} transition={{ pathLength: { duration: 0.7, ease: 'easeInOut' }, opacity: { duration: 1.1, times: [0, 0.7, 1] } }} />
          {/* avatar */}
          <m.circle cx="52" cy="62" r="24" fill="hsl(var(--primary) / .16)" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.75, ...spring }} style={{ transformBox: 'fill-box', transformOrigin: 'center' }} />
          <m.circle cx="52" cy="62" r="24" fill="none" stroke="hsl(var(--primary))" strokeWidth="2" initial={{ scale: 1, opacity: 0.8 }} animate={{ scale: 2, opacity: 0 }} transition={{ delay: 0.9, duration: 0.85, ease: 'easeOut' }} style={{ transformBox: 'fill-box', transformOrigin: 'center' }} />
          <m.text x="52" y="68" textAnchor="middle" fontSize="16" fontWeight="800" fill="hsl(var(--primary))" fontFamily="Outfit, sans-serif" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.95, duration: 0.2 }}>{initials(name)}</m.text>
          {/* text lines that grow in */}
          <m.rect x="90" y="46" height="11" rx="5.5" fill="hsl(var(--foreground) / .78)" initial={{ width: 0 }} animate={{ width: 104 }} transition={{ delay: 0.95, duration: 0.5, ease: [0.22, 1, 0.36, 1] }} />
          <m.rect x="90" y="66" height="8" rx="4" fill="hsl(var(--primary) / .30)" initial={{ width: 0 }} animate={{ width: 70 }} transition={{ delay: 1.1, duration: 0.45, ease: [0.22, 1, 0.36, 1] }} />
          <m.rect x="24" y="100" height="7" rx="3.5" fill="hsl(var(--border))" initial={{ width: 0 }} animate={{ width: 150 }} transition={{ delay: 1.2, duration: 0.5, ease: [0.22, 1, 0.36, 1] }} />
          <m.rect x="24" y="116" height="7" rx="3.5" fill="hsl(var(--border) / .7)" initial={{ width: 0 }} animate={{ width: 110 }} transition={{ delay: 1.28, duration: 0.5, ease: [0.22, 1, 0.36, 1] }} />
          {/* sheen sweeping across the finished card */}
          <g clipPath="url(#lc-clip)">
            <m.rect y="14" width="70" height="132" fill="url(#lc-sheen)" initial={{ x: -90 }} animate={{ x: 300 }} transition={{ delay: 1.45, duration: 0.9, ease: 'easeInOut' }} style={{ transform: 'skewX(-14deg)', transformOrigin: 'center' }} />
          </g>
          {/* success badge */}
          <m.circle cx="236" cy="22" r="17" fill="hsl(var(--success))" initial={{ scale: 0 }} animate={{ scale: [0, 1.25, 1] }} transition={{ delay: 1.15, duration: 0.5, times: [0, 0.65, 1] }} style={{ transformBox: 'fill-box', transformOrigin: 'center' }} />
          <m.circle cx="236" cy="22" r="17" fill="none" stroke="hsl(var(--success))" strokeWidth="2" initial={{ scale: 1, opacity: 0.7 }} animate={{ scale: 2.2, opacity: 0 }} transition={{ delay: 1.35, duration: 0.9, ease: 'easeOut' }} style={{ transformBox: 'fill-box', transformOrigin: 'center' }} />
          <m.path d="M228 22l6 6 11-12" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 1.35, duration: 0.3 }} />
        </svg>
      </m.div>

      <m.div className="relative mt-4 space-y-1" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.2, duration: 0.45, ease: EASE }}>
        <p className="font-display text-2xl font-bold tracking-tight text-foreground">Lead created</p>
        <p className="truncate text-sm text-muted-foreground">{name} was added to Leads</p>
      </m.div>

      {chips.length > 0 && (
        <div className="relative mt-3 flex flex-wrap justify-center gap-1.5">
          {chips.map((c, i) => (
            <m.span key={c} className="rounded-full border border-border/70 bg-background/60 px-2.5 py-1 text-[11px] font-semibold text-foreground/80" initial={{ opacity: 0, y: 8, scale: 0.92 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay: 1.4 + i * 0.08, type: 'spring', stiffness: 400, damping: 24 }}>{c}</m.span>
          ))}
        </div>
      )}

      <m.div className="relative mt-5 flex gap-2" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.6, duration: 0.4, ease: EASE }}>
        {detail.leadId && (
          <button type="button" onClick={onView} className="h-11 flex-1 rounded-xl bg-primary text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-transform active:scale-[.97]">View lead</button>
        )}
        <button type="button" onClick={onAnother} className="glass h-11 flex-1 rounded-xl border text-sm font-semibold text-foreground transition-transform active:scale-[.97]">Add another</button>
      </m.div>
    </m.div>
  );
}

function CalendarScene({ subtitle }: { subtitle?: string }) {
  const day = (subtitle?.match(/\b(\d{1,2})\b/) ?? [])[1] ?? '•';
  return (
    <div className="relative flex h-[120px] w-[120px] items-center justify-center">
      {[0, 1].map((i) => (
        <m.span key={i} className="absolute inset-4 rounded-3xl border-2 border-primary/60" initial={{ scale: 0.8, opacity: 0.7 }} animate={{ scale: 1.7, opacity: 0 }} transition={{ delay: 0.5 + i * 0.25, duration: 0.9, ease: 'easeOut' }} />
      ))}
      <m.div className="relative h-[84px] w-[84px] overflow-hidden rounded-2xl border border-border bg-card shadow-xl" initial={{ y: -70, rotate: -10, opacity: 0 }} animate={{ y: 0, rotate: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 320, damping: 15 }}>
        <div className="flex h-7 items-center justify-center bg-primary text-[10px] font-bold uppercase tracking-widest text-primary-foreground">Follow-up</div>
        <m.p className="mt-1 text-center font-display text-3xl font-bold text-foreground" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.35, type: 'spring', stiffness: 500, damping: 14 }}>{day}</m.p>
      </m.div>
      <m.span className="absolute -right-1 -top-1 flex h-8 w-8 items-center justify-center rounded-full bg-success text-white shadow-lg" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.7, type: 'spring', stiffness: 500, damping: 14 }}>
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7" /></svg>
      </m.span>
    </div>
  );
}

function TransferScene({ from, to }: { from?: string; to?: string }) {
  return (
    <div className="relative flex h-[110px] w-[260px] items-center justify-between px-3">
      <m.span className="flex h-14 w-14 items-center justify-center rounded-full bg-muted font-display text-lg font-bold text-foreground ring-2 ring-border" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 16 }}>{initials(from || 'You')}</m.span>
      <m.svg viewBox="0 0 120 40" className="absolute left-[72px] top-[34px] h-10 w-[116px]" aria-hidden="true">
        <m.path d="M2 34 C 30 -6, 90 -6, 118 34" fill="none" stroke="hsl(var(--primary) / .45)" strokeWidth="2" strokeDasharray="4 5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.8, delay: 0.15 }} />
      </m.svg>
      <m.span
        className="absolute left-[64px] top-[58px] h-3.5 w-3.5 rounded-full bg-primary shadow-[0_0_18px_hsl(var(--primary))]"
        initial={{ x: 0, y: 0, opacity: 0 }}
        animate={{ x: [0, 40, 90, 128], y: [0, -34, -34, 0], opacity: [0, 1, 1, 0] }}
        transition={{ delay: 0.35, duration: 0.9, ease: 'easeInOut' }}
      />
      <m.span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent font-display text-lg font-bold text-white shadow-lg" initial={{ scale: 0 }} animate={{ scale: [0, 1, 1.18, 1] }} transition={{ delay: 0.25, duration: 0.9, times: [0, 0.3, 0.8, 1] }}>
        {initials(to || 'New')}
        <m.span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-success text-white" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 1.2, type: 'spring', stiffness: 500, damping: 14 }}>
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7" /></svg>
        </m.span>
      </m.span>
    </div>
  );
}

function UploadScene() {
  const [pct, setPct] = useState(0);
  useEffect(() => {
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / 700);
      setPct(Math.round(100 * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  const done = pct >= 100;
  return (
    <div className="relative flex h-[112px] w-[112px] items-center justify-center">
      <svg viewBox="0 0 112 112" className="absolute inset-0" aria-hidden="true">
        <circle cx="56" cy="56" r="46" fill="none" stroke="hsl(var(--muted))" strokeWidth="8" />
        <circle cx="56" cy="56" r="46" fill="none" stroke={done ? 'hsl(var(--success))' : 'hsl(var(--primary))'} strokeWidth="8" strokeLinecap="round" strokeDasharray={289} strokeDashoffset={289 - (289 * pct) / 100} style={{ transform: 'rotate(-90deg)', transformOrigin: '56px 56px', transition: 'stroke .2s' }} />
      </svg>
      {done ? (
        <m.svg viewBox="0 0 24 24" className="h-12 w-12 text-success" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 500, damping: 14 }}><path d="M5 12l5 5L20 7" /></m.svg>
      ) : (
        <span className="font-display text-xl font-bold tabular-nums text-foreground">{pct}%</span>
      )}
    </div>
  );
}

function StampScene({ label }: { label: string }) {
  return (
    <div className="relative flex h-[128px] w-[150px] items-center justify-center">
      <m.div className="relative h-[108px] w-[84px] rounded-xl border border-border bg-card p-3 shadow-xl" initial={{ y: 30, opacity: 0, rotate: 4 }} animate={{ y: 0, opacity: 1, rotate: -3 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }}>
        {[0, 1, 2, 3].map((i) => <div key={i} className="mb-2 h-1.5 rounded-full bg-muted" style={{ width: `${90 - i * 14}%` }} />)}
      </m.div>
      <m.div className="absolute rounded-lg border-[3px] border-success px-2.5 py-1 font-display text-sm font-extrabold uppercase tracking-widest text-success-ink" style={{ boxShadow: '0 0 0 2px hsl(var(--success) / .25)' }} initial={{ scale: 2.4, opacity: 0, rotate: -22 }} animate={{ scale: 1, opacity: 1, rotate: -12 }} transition={{ delay: 0.45, type: 'spring', stiffness: 520, damping: 17 }}>
        {label}
      </m.div>
      <m.span className="absolute h-24 w-24 rounded-full border-2 border-success/60" initial={{ scale: 0.6, opacity: 0.8 }} animate={{ scale: 1.9, opacity: 0 }} transition={{ delay: 0.62, duration: 0.8, ease: 'easeOut' }} />
    </div>
  );
}

function RfqScene() {
  return (
    <svg viewBox="0 0 240 130" className="h-auto w-[240px] max-w-full overflow-visible" aria-hidden="true">
      <m.path d="M14 112 C 60 112, 90 80, 130 52 S 190 20, 214 18" fill="none" stroke="hsl(var(--primary) / .5)" strokeWidth="2" strokeDasharray="5 6" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1, delay: 0.1 }} />
      <m.g initial={{ x: 14, y: 112, opacity: 0 }} animate={{ x: [14, 70, 130, 190, 214], y: [112, 98, 52, 26, 18], rotate: [-12, -28, -40, -45, -45], opacity: 1 }} transition={{ duration: 1, delay: 0.1, ease: [0.45, 0.05, 0.3, 1] }}>
        <path d="M0 0 L34 -14 L14 18 L10 4 Z" fill="hsl(var(--primary))" />
      </m.g>
      <m.circle cx="214" cy="22" r="14" fill="hsl(var(--success))" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 1.1, type: 'spring', stiffness: 500, damping: 14 }} style={{ transformBox: 'fill-box', transformOrigin: 'center' }} />
      <m.path d="M207 22l5 5 10-11" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 1.25, duration: 0.25 }} />
      <g>{[0, 1].map((i) => <m.rect key={i} x="20" y={22 + i * 20} width={52 - i * 14} height="11" rx="5.5" fill="hsl(var(--primary) / .18)" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 + i * 0.1 }} />)}</g>
    </svg>
  );
}

function WonScene() {
  const sparks = useSparks(34, 100, 110);
  return (
    <div className="relative flex h-[150px] w-[220px] items-center justify-center">
      {sparks.map((s, i) => (
        <m.i key={i} className="pointer-events-none absolute left-1/2 top-1/2 block h-2 w-3 rounded-[2px]" style={{ background: s.c }} initial={{ x: 0, y: 0, opacity: 0 }} animate={{ x: s.x, y: s.y + 30, opacity: [0, 1, 0], rotate: s.r }} transition={{ duration: 1.3, delay: 0.25 + s.delay, ease: [0.2, 0.8, 0.3, 1] }} />
      ))}
      <m.div className="relative flex h-[112px] w-[112px] items-center justify-center rounded-full bg-gradient-to-br from-success to-success/70 shadow-2xl shadow-success/40" initial={{ scale: 0 }} animate={{ scale: [0, 1.15, 1] }} transition={{ duration: 0.55, times: [0, 0.7, 1] }}>
        <svg viewBox="0 0 24 24" className="h-14 w-14 text-white" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
          <m.path d="M5 12l5 5L20 7" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.45, duration: 0.4 }} />
        </svg>
      </m.div>
    </div>
  );
}

const DURATIONS: Record<CelebrateDetail['kind'], number> = { lead: 7000, won: 3400, rfq: 2800, followup: 2300, transfer: 2500, upload: 2100, request: 2300, nda: 2500 };

/** Mounted once inside the router. Listens for celebrate() and plays the matching moment. */
export function CelebrationHost() {
  const [current, setCurrent] = useState<(CelebrateDetail & { id: number }) | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const seq = useRef(0);
  const navigate = useNavigate();

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
      timer.current = setTimeout(() => setCurrent(null), DURATIONS[detail.kind] ?? 2500);
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

  const big = current?.kind === 'lead' || current?.kind === 'won' || current?.kind === 'rfq';

  return (
    <AnimatePresence>
      {current && (
        <m.div
          key={current.id}
          className={cn('fixed inset-0 z-[9998] flex items-center justify-center p-6', big ? 'bg-black/45 backdrop-blur-[4px]' : 'bg-black/25 backdrop-blur-[2px]')}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.2 } }}
          onClick={dismiss}
          role="status"
          aria-live="polite"
        >
          <div onClick={(e) => e.stopPropagation()}>
            {current.kind === 'lead' ? (
              <LeadScene
                detail={current}
                onView={() => { dismiss(); if (current.leadId) navigate(`/leads/${current.leadId}`); }}
                onAnother={() => { dismiss(); navigate('/leads?new=1'); }}
              />
            ) : (
              <m.div
                className="glass-strong relative flex max-w-[340px] flex-col items-center gap-3 rounded-[28px] border px-9 pb-7 pt-8 text-center shadow-2xl"
                initial={{ scale: 0.86, y: 18, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1, transition: { type: 'spring', stiffness: 380, damping: 26 } }}
                exit={{ scale: 0.96, y: 8, opacity: 0, transition: { duration: 0.16 } }}
                onClick={dismiss}
              >
                {current.kind === 'rfq' && <RfqScene />}
                {current.kind === 'won' && <WonScene />}
                {current.kind === 'followup' && <CalendarScene subtitle={current.subtitle} />}
                {current.kind === 'transfer' && <TransferScene from={current.from} to={current.to} />}
                {current.kind === 'upload' && <UploadScene />}
                {current.kind === 'request' && <StampScene label="Sent" />}
                {current.kind === 'nda' && <StampScene label="Signed" />}
                <m.div className="space-y-1" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: current.kind === 'won' ? 0.6 : 0.5, duration: 0.35 }}>
                  <p className="font-display text-2xl font-bold tracking-tight text-foreground">{current.title}</p>
                  {current.subtitle && <p className="text-sm text-muted-foreground">{current.subtitle}</p>}
                </m.div>
              </m.div>
            )}
          </div>
        </m.div>
      )}
    </AnimatePresence>
  );
}
