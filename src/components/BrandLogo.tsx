import { cn } from '@/lib/utils';

interface BrandLogoProps {
  /** `onDark`: always light wordmark (for dark brand surfaces). `adaptive`: follows the theme. */
  tone?: 'onDark' | 'adaptive';
  /** Height of the mark in px; the wordmark scales with it. */
  size?: number;
  showWord?: boolean;
  className?: string;
}

/**
 * RemoAsset mark + live wordmark. The mark is a transparent PNG that reads on any surface;
 * the wordmark is text so it can follow light/dark mode (the old single raster logo could not).
 */
export function BrandLogo({ tone = 'adaptive', size = 36, showWord = true, className }: BrandLogoProps) {
  return (
    <span className={cn('inline-flex items-center gap-2.5 select-none', className)}>
      <img
        src="/brand-mark.png"
        alt={showWord ? '' : 'RemoAsset'}
        width={size}
        height={size}
        style={{ width: size, height: size }}
        className="shrink-0 object-contain"
        draggable={false}
      />
      {showWord && (
        <span
          className={cn(
            'font-display font-semibold tracking-tight leading-none',
            tone === 'onDark' ? 'text-white' : 'text-foreground',
          )}
          style={{ fontSize: size * 0.72 }}
        >
          Remoasset
        </span>
      )}
    </span>
  );
}
