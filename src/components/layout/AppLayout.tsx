import { ReactNode, createContext, useContext, useState, useEffect } from 'react';
import { AppSidebar, MobileTabBar } from './AppSidebar';
import { useIsMobile } from '@/hooks/use-mobile';
import { AppHeader } from './AppHeader';
import { useMailNotificationPoller } from '@/hooks/useMailNotificationPoller';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { AlertTriangle, X } from 'lucide-react';

interface AppLayoutProps {
  children: ReactNode;
}

function GoogleReconnectBanner() {
  const { connectGoogleCalendar } = useAuth();
  const [show, setShow] = useState(false);

  useEffect(() => {
    const handler = () => setShow(true);
    window.addEventListener('google:token-expired', handler);
    return () => window.removeEventListener('google:token-expired', handler);
  }, []);

  if (!show) return null;

  return (
    <div className="flex items-center justify-between gap-3 bg-amber-50 border-b border-amber-200 px-4 py-2.5 text-sm text-amber-900 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-200">
      <div className="flex items-center gap-2 min-w-0">
        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <span className="truncate">Your Google session has expired. Gmail and Calendar features are unavailable.</span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button
          size="sm"
          variant="outline"
          className="h-7 border-amber-400 text-amber-900 hover:bg-amber-100 dark:border-amber-600 dark:text-amber-200 dark:hover:bg-amber-900/50"
          onClick={() => { connectGoogleCalendar(); setShow(false); }}
        >
          Reconnect Google
        </Button>
        <button
          onClick={() => setShow(false)}
          className="rounded-sm text-amber-600 hover:text-amber-900 dark:text-amber-400 dark:hover:text-amber-100"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/** True for pages rendered inside the persistent shell (see PersistentShell). */
export const ShellContext = createContext(false);

export function AppLayout({ children }: AppLayoutProps) {
  const insideShell = useContext(ShellContext);
  // Already inside the persistent shell: render only the page content.
  if (insideShell) return <>{children}</>;
  return <AppLayoutShell>{children}</AppLayoutShell>;
}

function AppLayoutShell({ children }: AppLayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isMobile = useIsMobile();
  useMailNotificationPoller();
  // Task/follow-up reminders are now created server-side (send_due_reminders, every minute).
  return (
    <div className="min-h-dvh flex w-full bg-background">
      <AppSidebar mobileOpen={mobileMenuOpen} onMobileOpenChange={setMobileMenuOpen} />
      <div className="flex-1 flex flex-col min-h-dvh min-w-0">
        <AppHeader onMenuClick={() => setMobileMenuOpen(true)} />
        <GoogleReconnectBanner />
        <main className={`flex-1 p-4 md:p-6 overflow-auto page-bg ${isMobile ? "pb-[calc(5.5rem+env(safe-area-inset-bottom))]" : ""}`}>
          {children}
        </main>
      </div>
      {isMobile && <MobileTabBar onMore={() => setMobileMenuOpen(true)} />}
    </div>
  );
}
