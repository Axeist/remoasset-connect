import { cn } from '@/lib/utils';

/**
 * The RemoAsset "R" mark itself as the loader: it breathes while a soft ring orbits it.
 * Used for page loads, pull-to-refresh and the first-load splash.
 */
export function BrandLoader({ size = 56, className, label = 'Loading' }: { size?: number; className?: string; label?: string }) {
  return (
    <span role="img" aria-label={label} className={cn('r-loader relative inline-flex items-center justify-center', className)} style={{ width: size, height: size }}>
      <span className="r-loader-glow" aria-hidden="true" />
      <span className="r-loader-ring" aria-hidden="true" />
      <img src="/brand-mark.png" alt="" draggable={false} className="r-loader-mark relative h-[62%] w-[62%] select-none object-contain" />
    </span>
  );
}
