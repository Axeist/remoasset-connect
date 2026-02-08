import { useEffect } from 'react';
import { Package, MapPin, Settings, RefreshCw } from 'lucide-react';

type SplashVariant = 'welcome' | 'success';

interface SplashScreenProps {
  variant: SplashVariant;
  onComplete?: () => void;
  duration?: number;
}

export function SplashScreen({ variant, onComplete, duration = 3200 }: SplashScreenProps) {
  useEffect(() => {
    const t = setTimeout(() => onComplete?.(), duration);
    return () => clearTimeout(t);
  }, [onComplete, duration]);

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
            Welcome back
          </h1>
          <p className="mt-3 text-base text-white/70">
            Taking you to your dashboard…
          </p>
          <img src="/logo.png" alt="RemoAsset" className="mt-8 h-8 w-auto object-contain opacity-70" />
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10 overflow-hidden">
          <div className="splash-progress h-full bg-gradient-to-r from-primary to-accent" style={{ animationDuration: `${duration}ms` }} />
        </div>
      </div>
    );
  }

  // Welcome (first load) – exotic loading
  return (
    <div
      className="splash-wrap fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden bg-splash-dark"
      aria-live="polite"
      aria-label="Loading RemoAsset"
    >
      {/* Animated mesh / gradient background */}
      <div className="splash-mesh-bg" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-30%,hsl(var(--primary)/0.3),transparent_50%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_70%_at_100%_0%,hsl(var(--accent)/0.15),transparent)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_0%_100%,hsl(250_80%_50%/0.12),transparent)]" />

      {/* Grid overlay */}
      <div className="splash-grid" />

      {/* Floating orbs */}
      <div className="splash-orb splash-orb-1" />
      <div className="splash-orb splash-orb-2" />
      <div className="splash-orb splash-orb-3" />
      <div className="splash-orb splash-orb-4" />

      {/* Floating geometric shapes */}
      <div className="splash-shape splash-shape-1" />
      <div className="splash-shape splash-shape-2" />
      <div className="splash-shape splash-shape-3" />

      <div className="relative z-10 flex flex-col items-center justify-center px-6 text-center">
        {/* Logo in glass card with glow */}
        <div className="splash-logo-wrap">
          <div className="splash-logo-glow" />
          <img src="/logo.png" alt="RemoAsset" className="splash-logo-img relative z-10 h-16 w-auto object-contain drop-shadow-lg sm:h-20" />
        </div>

        <h1 className="splash-headline mt-8 font-display text-2xl font-bold tracking-tight sm:text-3xl">
          Remote IT Asset Management
        </h1>
        <p className="splash-tagline mt-3 max-w-md text-sm leading-relaxed text-white/70 sm:text-base">
          Procure, track, manage & recover hardware for distributed teams worldwide.
        </p>

        {/* Icon pills */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4 sm:gap-6">
          {[
            { Icon: Package, label: 'Procure' },
            { Icon: MapPin, label: 'Track' },
            { Icon: Settings, label: 'Manage' },
            { Icon: RefreshCw, label: 'Recover' },
          ].map(({ Icon, label }, i) => (
            <div key={label} className="splash-pill" style={{ animationDelay: `${i * 120}ms` }}>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 backdrop-blur-sm sm:h-12 sm:w-12">
                <Icon className="h-5 w-5 text-primary sm:h-6 sm:w-6" />
              </div>
              <span className="text-xs font-medium text-white/80">{label}</span>
            </div>
          ))}
        </div>

        {/* Custom loader */}
        <div className="mt-12 flex flex-col items-center gap-4">
          <div className="splash-loader-ring">
            <div className="splash-loader-ring-inner" />
          </div>
          <p className="text-xs font-medium uppercase tracking-widest text-white/50">Loading</p>
        </div>
      </div>

      {/* Bottom progress */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10 overflow-hidden">
        <div className="splash-progress h-full bg-gradient-to-r from-primary via-accent to-primary" style={{ animationDuration: `${duration}ms` }} />
      </div>
    </div>
  );
}
