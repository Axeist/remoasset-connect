/**
 * Route chunk prefetching: start downloading a page's code before the user clicks.
 * Called on hover/focus/touch of navigation links and, shortly after first paint, for the busiest pages.
 */
const loaders: Record<string, () => Promise<unknown>> = {
  '/dashboard': () => import('@/pages/Dashboard'),
  '/leads': () => import('@/pages/Leads'),
  '/pipeline': () => import('@/pages/Pipeline'),
  '/admin/pipeline': () => import('@/pages/Pipeline'),
  '/tasks': () => import('@/pages/Tasks'),
  '/follow-ups': () => import('@/pages/FollowUps'),
  '/inbox': () => import('@/pages/Inbox'),
  '/vendors': () => import('@/pages/Vendors'),
  '/clients': () => import('@/pages/Clients'),
  '/rfq': () => import('@/pages/RfqHub'),
  '/reports': () => import('@/pages/Reports'),
  '/notifications': () => import('@/pages/Notifications'),
  '/settings': () => import('@/pages/Settings'),
  '/admin': () => import('@/pages/Admin'),
  '/help': () => import('@/pages/Help'),
  '/mrp-lookup': () => import('@/pages/MrpLookup'),
};

const started = new Set<string>();

export function prefetchRoute(url: string) {
  const path = url.split('?')[0];
  const key = loaders[path] ? path : Object.keys(loaders).find((k) => k !== '/admin' && path.startsWith(k + '/'));
  if (!key || started.has(key)) return;
  started.add(key);
  loaders[key]().catch(() => started.delete(key));
}

/** After first paint, quietly fetch the pages people open most. */
export function prefetchCommonRoutes() {
  const run = () => ['/dashboard', '/leads', '/pipeline', '/tasks'].forEach(prefetchRoute);
  const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
  if (w.requestIdleCallback) w.requestIdleCallback(run, { timeout: 4000 });
  else setTimeout(run, 2500);
}
