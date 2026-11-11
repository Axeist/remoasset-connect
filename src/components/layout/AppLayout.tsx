import { ReactNode, createContext, useContext, useState, useEffect } from 'react';
import { AppSidebar, MobileTabBar } from './AppSidebar';
import { useIsMobile } from '@/hooks/use-mobile';
import { AppHeader } from './AppHeader';
import { useMailNotificationPoller } from '@/hooks/useMailNotificationPoller';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { AlertTriangle, X } from 'lucide-react';
import { CommandPalette } from '@/components/CommandPalette';
import { StackedTables } from '@/components/StackedTables';

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
    <div className="flex items-center justify-between gap-3 bg-warning/10 border-b border-warning/30 px-4 py-2.5 text-sm text-warning-ink">
      <div className="flex items-center gap-2 min-w-0">
        <AlertTriangle className="h-4 w-4 shrink-0 text-warning-ink" />
        <span className="truncate">Your Google session has expired. Gmail and Calendar features are unavailable.</span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button
          size="sm"
          variant="outline"
          className="h-7 border-warning/50 text-warning-ink hover:bg-warning/15"
          onClick={() => { connectGoogleCalendar(); setShow(false); }}
        >
          Reconnect Google
        </Button>
        <button
          onClick={() => setShow(false)}
          className="rounded-sm text-warning-ink hover:text-warning-ink"
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
      <div className="page-bg flex-1 flex flex-col min-h-dvh min-w-0">
        <AppHeader onMenuClick={() => setMobileMenuOpen(true)} />
        <GoogleReconnectBanner />
        <main className={`flex-1 p-4 md:p-6 overflow-auto ${isMobile ? "pb-[calc(5.5rem+env(safe-area-inset-bottom))]" : ""}`}>
          {children}
        </main>
      </div>
      <CommandPalette />
      <StackedTables />
      {isMobile && <MobileTabBar onMore={() => setMobileMenuOpen(true)} />}
    </div>
  );
}
