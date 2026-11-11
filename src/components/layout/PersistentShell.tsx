import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { AppLayout, ShellContext } from './AppLayout';
import { RouteFallback } from './RouteFallback';

/**
 * Layout route: the sidebar, header and notification pollers mount once and stay
 * mounted while only the page content changes.
 */
export function PersistentShell() {
  return (
    <AppLayout>
      <ShellContext.Provider value={true}>
        <Suspense fallback={<RouteFallback />}>
          <Outlet />
        </Suspense>
      </ShellContext.Provider>
    </AppLayout>
  );
}
