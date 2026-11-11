import { flushSync } from 'react-dom';

type ViewTransitionDoc = Document & {
  startViewTransition?: (cb: () => void) => { ready: Promise<void> };
};

/**
 * Switch theme with a circular reveal that grows from the click point.
 * Falls back to an instant switch where the View Transitions API is missing
 * or the user prefers reduced motion.
 */
export function toggleThemeWithReveal(
  current: string | undefined,
  setTheme: (theme: string) => void,
  origin?: { clientX: number; clientY: number },
) {
  const next = current === 'dark' ? 'light' : 'dark';
  const doc = document as ViewTransitionDoc;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!doc.startViewTransition || reduce) {
    setTheme(next);
    return;
  }
  const x = origin?.clientX ?? window.innerWidth / 2;
  const y = origin?.clientY ?? window.innerHeight / 2;
  const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
  const transition = doc.startViewTransition(() => {
    flushSync(() => setTheme(next));
  });
  transition.ready
    .then(() => {
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
        { duration: 600, easing: 'cubic-bezier(.22, 1, .36, 1)', pseudoElement: '::view-transition-new(root)' },
      );
    })
    .catch(() => { /* transition skipped */ });
}
