import { useEffect } from 'react';
import { Package, MapPin, Settings, RefreshCw, Globe } from 'lucide-react';

type SplashVariant = 'welcome' | 'success';

interface SplashScreenProps {
  variant: SplashVariant;
  onComplete?: () => void;
  duration?: number;
}

const iconClass = 'w-8 h-8 sm:w-10 sm:h-10 text-primary/90';

export function SplashScreen({ variant, onComplete, duration = 2500 }: SplashScreenProps) {
  useEffect(() => {
    const t = setTimeout(() => onComplete?.(), duration);
    return () => clearTimeout(t);
  }, [onComplete, duration]);

  if (variant === 'success') {
    return (
      <div
        className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background overflow-hidden"
        aria-live="polite"
        aria-label="Login successful"
      >
        {/* Subtle gradient orbs */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,hsl(var(--primary)/0.12),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_80%_80%,hsl(var(--success)/0.08),transparent)]" />

        <div className="relative z-10 flex flex-col items-center justify-center px-6 text-center">
          {/* Success checkmark circle */}
          <div className="splash-success-ring mb-8 flex h-24 w-24 sm:h-28 sm:w-28 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/80 text-white shadow-lg shadow-primary/30">
            <svg
              className="splash-check h-12 w-12 sm:h-14 sm:w-14"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
            Welcome back
          </h1>
          <p className="mt-2 text-muted-foreground text-sm sm:text-base max-w-xs">
            Taking you to your dashboard…
          </p>
          <img
            src="/logo.png"
            alt="RemoAsset"
            className="mt-8 h-8 w-auto object-contain opacity-60"
          />
        </div>

        {/* Loading bar */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-muted overflow-hidden">
          <div
            className="h-full bg-primary rounded-r-full splash-progress"
            style={{ animationDuration: `${duration}ms` }}
          />
        </div>
      </div>
    );
  }

  // Welcome (first load)
  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background overflow-hidden"
      aria-live="polite"
      aria-label="Loading RemoAsset"
    >
      {/* Background gradients */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,hsl(var(--primary)/0.15),transparent_50%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_70%_at_100%_0%,hsl(var(--accent)/0.08),transparent)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_50%_at_0%_100%,hsl(var(--primary)/0.06),transparent)]" />

      <div className="relative z-10 flex flex-col items-center justify-center px-6 text-center">
        {/* Logo with gentle pulse */}
        <div className="splash-logo-pulse mb-8">
          <img
            src="/logo.png"
            alt="RemoAsset"
            className="h-14 w-auto object-contain drop-shadow-md sm:h-16"
          />
        </div>

        <h1 className="font-display text-xl sm:text-2xl font-bold text-foreground tracking-tight">
          Remote IT Asset Management
        </h1>
        <p className="mt-2 text-muted-foreground text-sm sm:text-base max-w-sm leading-relaxed">
          Procure, track, manage, and recover hardware for distributed teams worldwide.
        </p>

        {/* Theme icons: procure, track, manage, recover */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-6 sm:gap-8 text-muted-foreground/80">
          <div className="splash-icon-float flex flex-col items-center gap-2" style={{ animationDelay: '0ms' }}>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <Package className={iconClass} />
            </div>
            <span className="text-xs font-medium">Procure</span>
          </div>
          <div className="splash-icon-float flex flex-col items-center gap-2" style={{ animationDelay: '150ms' }}>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <MapPin className={iconClass} />
            </div>
            <span className="text-xs font-medium">Track</span>
          </div>
          <div className="splash-icon-float flex flex-col items-center gap-2" style={{ animationDelay: '300ms' }}>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <Settings className={iconClass} />
            </div>
            <span className="text-xs font-medium">Manage</span>
          </div>
          <div className="splash-icon-float flex flex-col items-center gap-2" style={{ animationDelay: '450ms' }}>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <RefreshCw className={iconClass} />
            </div>
            <span className="text-xs font-medium">Recover</span>
          </div>
        </div>

        <div className="mt-8 flex items-center gap-2 text-muted-foreground/60 text-xs">
          <Globe className="h-3.5 w-3.5" />
          <span>Built for distributed teams</span>
        </div>
      </div>

      {/* Bottom loading bar */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-muted overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-primary to-accent rounded-r-full splash-progress"
          style={{ animationDuration: `${duration}ms` }}
        />
      </div>
    </div>
  );
}
