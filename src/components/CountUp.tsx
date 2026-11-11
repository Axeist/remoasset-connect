import { useEffect, useRef, useState } from 'react';

/** Animates a number from its previous value to the new one (never from zero on updates). Keeps prefix/suffix/commas. */
export function CountUp({ value, duration = 900, className }: { value: string | number; duration?: number; className?: string }) {
  const text = String(value);
  const match = text.match(/^([^\d-]*)(-?[\d,]*\.?\d+)(.*)$/);
  const target = match ? parseFloat(match[2].replace(/,/g, '')) : NaN;
  const decimals = match && match[2].includes('.') ? match[2].split('.')[1].length : 0;
  const commas = !!match && match[2].includes(',');
  const [shown, setShown] = useState<number>(Number.isFinite(target) ? 0 : NaN);
  const prev = useRef(0);

  useEffect(() => {
    if (!Number.isFinite(target)) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setShown(target); prev.current = target; return; }
    const from = prev.current;
    const t0 = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      const e = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
      const v = from + (target - from) * e;
      setShown(v);
      if (p < 1) raf = requestAnimationFrame(tick);
      else prev.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  if (!match || !Number.isFinite(target)) return <span className={className}>{text}</span>;
  const n = Number.isFinite(shown) ? shown : target;
  const body = commas ? n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) : n.toFixed(decimals);
  return <span className={className} style={{ fontVariantNumeric: 'tabular-nums' }}>{match[1]}{body}{match[3]}</span>;
}
