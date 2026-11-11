import { Skeleton } from '@/components/ui/skeleton';

/** Shown while a lazily loaded page chunk downloads: thin progress bar (after a short delay) plus page-shaped skeletons. */
export function RouteFallback() {
  return (
    <div className="space-y-4" role="status" aria-label="Loading page">
      <div className="top-progress" aria-hidden="true" />
      <Skeleton className="h-8 w-56" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
      </div>
      <Skeleton className="h-72 rounded-xl" />
    </div>
  );
}
