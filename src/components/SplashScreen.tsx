import { useEffect, useRef } from 'react';
import { BrandLogo } from '@/components/BrandLogo';
import { BrandLoader } from '@/components/BrandLoader';

type SplashVariant = 'welcome' | 'success';

interface SplashScreenProps {
  variant: SplashVariant;
  onComplete?: () => void;
  duration?: number;
  /** Shown in the success variant: "Welcome back, <name>". */
  name?: string;
}

export function SplashScreen({ variant, onComplete, duration = 3200, name }: SplashScreenProps) {
  // Keep the latest callback in a ref so parent re-renders never restart the timer.
  const done = useRef(onComplete);
  done.current = onComplete;
  useEffect(() => {
    const t = setTimeout(() => done.current?.(), duration);
    return () => clearTimeout(t);
  }, [duration]);

  if (variant === 'success') {
    return (
      <div
        className="splash-wrap fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden bg-splash-dark"
        aria-live="polite"
        aria-label="Login successful"
      >
        {/* Animated mesh gradient background */}
        <div className="splash-mesh-bg" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_50%,hsl(var(--primary)/0.25),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_80%_20%,hsl(var(--success)/0.2),transparent_50%)]" />

        {/* Floating orbs */}
        <div className="splash-orb splash-orb-1" />
        <div className="splash-orb splash-orb-2" />
        <div className="splash-orb splash-orb-3" />

        <div className="relative z-10 flex flex-col items-center justify-center px-6 text-center">
          {/* Success burst + checkmark */}
          <div className="relative flex h-28 w-28 items-center justify-center sm:h-32 sm:w-32">
            <div className="splash-success-burst absolute inset-0 flex items-center justify-center">
              <span className="splash-burst-dot" />
              <span className="splash-burst-dot" />
              <span className="splash-burst-dot" />
              <span className="splash-burst-dot" />
              <span className="splash-burst-dot" />
              <span className="splash-burst-dot" />
              <span className="splash-burst-dot" />
              <span className="splash-burst-dot" />
            </div>
            <div className="splash-success-ring flex h-28 w-28 sm:h-32 sm:w-32 items-center justify-center rounded-full bg-gradient-to-br from-primary via-primary to-accent text-white shadow-2xl splash-success-glow">
            <svg className="splash-check h-14 w-14 sm:h-16 sm:w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 13l4 4L19 7" />
            </svg>
            </div>
          </div>

          <h1 className="splash-success-title mt-8 font-display text-3xl sm:text-4xl font-bold tracking-tight">
            Welcome back{name ? `, ${name}` : ''}
          </h1>
          <p className="mt-3 text-base text-white/80">
            Taking you to your dashboard…
          </p>
          <BrandLogo tone="onDark" size={30} className="mt-8 opacity-80" />
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10 overflow-hidden">
          <div className="splash-progress h-full bg-gradient-to-r from-primary to-accent" style={{ animationDuration: `${duration}ms` }} />
        </div>
      </div>
    );
  }

  // Welcome (first load): the R mark breathing inside an orbit ring, then the lockup. Calm and centred.
  return (
    <div
      className="welcome-splash fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden"
      aria-live="polite"
      aria-label="Loading Connect"
    >
      <div className="relative z-10 flex flex-col items-center px-6 text-center">
        <BrandLoader size={104} className="welcome-rise" />
        <div className="welcome-rise mt-8 flex flex-col items-center" style={{ animationDelay: '.25s' }}>
          <p className="font-display text-[2.6rem] font-semibold leading-none tracking-tight text-white">Connect</p>
          <p className="mt-2 font-display text-sm font-medium tracking-wide text-white/60">
            by <span className="font-semibold text-white/85">Remoasset</span>
          </p>
        </div>
        <p className="welcome-rise mt-10 text-xs font-medium uppercase tracking-[0.22em] text-white/45" style={{ animationDelay: '.5s' }}>
          Getting your workspace ready
        </p>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-[3px] overflow-hidden bg-white/10">
        <div className="splash-progress h-full bg-gradient-to-r from-primary to-accent" style={{ animationDuration: `${duration}ms` }} />
      </div>
    </div>
  );
}
