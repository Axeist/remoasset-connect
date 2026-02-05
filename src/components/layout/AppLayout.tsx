import { ReactNode, useState } from 'react';
import { AppSidebar } from './AppSidebar';
import { AppHeader } from './AppHeader';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  return (
    <div className="min-h-screen flex w-full bg-background">
      <AppSidebar mobileOpen={mobileMenuOpen} onMobileOpenChange={setMobileMenuOpen} />
      <div className="flex-1 flex flex-col min-h-screen min-w-0">
        <AppHeader onMenuClick={() => setMobileMenuOpen(true)} />
        <main className="flex-1 p-4 md:p-6 overflow-auto page-bg">
          {children}
        </main>
      </div>
    </div>
  );
}
