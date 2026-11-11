import { cn } from '@/lib/utils';

interface BrandLogoProps {
  /** `onDark`: always light text (dark brand surfaces). `adaptive`: follows the theme. */
  tone?: 'onDark' | 'adaptive';
  /** Height of the mark in px; the text scales with it. */
  size?: number;
  /** false = mark only (collapsed rails, favicons). */
  showWord?: boolean;
  /** true (default) = "Connect  by Remoasset" lockup; false = plain "Remoasset" wordmark. */
  lockup?: boolean;
  className?: string;
}

/**
 * Connect by RemoAsset. The mark is the RemoAsset mark (transparent PNG); the type is live text in the
 * same geometric face as the logo, so it follows light/dark mode.
 */
export function BrandLogo({ tone = 'adaptive', size = 36, showWord = true, lockup = true, className }: BrandLogoProps) {
  const main = tone === 'onDark' ? 'text-white' : 'text-foreground';
  const sub = tone === 'onDark' ? 'text-white/60' : 'text-muted-foreground';
  return (
    <span className={cn('inline-flex items-center gap-2.5 select-none', className)}>
      <img
        src="/brand-mark.png"
        alt={showWord ? '' : 'Connect by RemoAsset'}
        width={size}
        height={size}
        style={{ width: size, height: size }}
        className="shrink-0 object-contain"
        draggable={false}
      />
      {showWord && (lockup ? (
        <span className="flex flex-col justify-center leading-none">
          <span className={cn('font-display font-semibold tracking-tight', main)} style={{ fontSize: size * 0.7 }}>Connect</span>
          <span className={cn('font-display font-medium tracking-wide', sub)} style={{ fontSize: Math.max(10, size * 0.3), marginTop: size * 0.08 }}>
            by <span className={cn('font-semibold', tone === 'onDark' ? 'text-white/85' : 'text-foreground/80')}>Remoasset</span>
          </span>
        </span>
      ) : (
        <span className={cn('font-display font-semibold tracking-tight leading-none', main)} style={{ fontSize: size * 0.72 }}>Remoasset</span>
      ))}
    </span>
  );
}
