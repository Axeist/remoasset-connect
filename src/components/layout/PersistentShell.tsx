import { Suspense } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { m } from 'framer-motion';
import { AppLayout, ShellContext } from './AppLayout';
import { RouteFallback } from './RouteFallback';

/**
 * Layout route: the sidebar, header and notification pollers mount once and stay
 * mounted while only the page content glides in (fade + rise, children stagger via CSS).
 */
export function PersistentShell() {
  const { pathname } = useLocation();
  return (
    <AppLayout>
      <ShellContext.Provider value={true}>
        <Suspense fallback={<RouteFallback />}>
          <m.div
            key={pathname}
            className="page-in"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
          >
            <Outlet />
          </m.div>
        </Suspense>
      </ShellContext.Provider>
    </AppLayout>
  );
}
