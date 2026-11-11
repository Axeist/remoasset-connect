import { cn } from '@/lib/utils';

/** The RemoAsset mark drawing itself, used wherever a page or panel is loading. */
export function BrandLoader({ size = 56, className, label = 'Loading' }: { size?: number; className?: string; label?: string }) {
  return (
    <svg
      className={cn('brand-loader', className)}
      width={size}
      height={size}
      viewBox="0 0 56 56"
      role="img"
      aria-label={label}
    >
      <rect x="4" y="4" width="21" height="21" rx="6" />
      <rect x="31" y="4" width="21" height="21" rx="6" />
      <rect x="4" y="31" width="21" height="21" rx="6" />
      <rect x="31" y="31" width="21" height="21" rx="6" />
    </svg>
  );
}
