import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  CheckSquare,
  CalendarCheck,
  Bell,
  BarChart3,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Settings,
  Shield,
  Mail,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';
import { Badge } from '@/components/ui/badge';

const navItems = [
  { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard, roles: ['admin', 'employee'] },
  { title: 'Leads', url: '/leads', icon: Users, roles: ['admin', 'employee'] },
  { title: 'My Tasks', url: '/tasks', icon: CheckSquare, roles: ['admin', 'employee'] },
  { title: 'Follow-ups', url: '/follow-ups', icon: CalendarCheck, roles: ['admin', 'employee'] },
  { title: 'Notifications', url: '/notifications', icon: Bell, roles: ['admin', 'employee'] },
  { title: 'Reports', url: '/reports', icon: BarChart3, roles: ['admin', 'employee'] },
  { title: 'Help', url: '/help', icon: HelpCircle, roles: ['admin', 'employee'] },
  { title: 'Settings', url: '/settings', icon: Settings, roles: ['employee'] },
  { title: 'Admin Panel', url: '/admin', icon: Shield, roles: ['admin'] },
];

interface SidebarNavProps {
  collapsed?: boolean;
  onNavigate?: () => void;
}

function SidebarNav({ collapsed = false, onNavigate }: SidebarNavProps) {
  const location = useLocation();
  const { role, signOut, user } = useAuth();
  const filteredNav = navItems.filter((item) => item.roles.includes(role || 'employee'));
  const isAdmin = role === 'admin';

  return (
    <>
      <nav className="flex-1 py-4 px-2 space-y-1">
        {filteredNav.map((item) => {
          const isActive =
            location.pathname === item.url || location.pathname.startsWith(item.url + '/');
          return (
            <NavLink
              key={item.title}
              to={item.url}
              onClick={onNavigate}
              className={cn(
                'flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200',
                isActive
                  ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-lg'
                  : 'text-sidebar-foreground/85 hover:bg-sidebar-accent hover:text-sidebar-foreground'
              )}
            >
              <span
                className={cn(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors',
                  isActive ? 'bg-white/20' : 'bg-sidebar-accent/50'
                )}
              >
                <item.icon className="h-5 w-5" />
              </span>
              {!collapsed && <span className="font-medium">{item.title}</span>}
            </NavLink>
          );
        })}
      </nav>
      <div className="p-3 border-t border-sidebar-border">
        {!collapsed && user && (
          <div className="mb-3 rounded-xl bg-sidebar-accent/60 p-3 border border-sidebar-border/50">
            <div className="flex items-center gap-2 text-sidebar-foreground/90 mb-2">
              <Mail className="h-4 w-4 shrink-0 text-sidebar-foreground/70" />
              <p className="text-sm font-medium truncate">{user.email}</p>
            </div>
            <Badge
              variant={isAdmin ? 'default' : 'secondary'}
              className={cn(
                'w-fit text-xs font-medium capitalize',
                isAdmin && 'bg-sidebar-primary text-sidebar-primary-foreground border-0'
              )}
            >
              {role ?? 'Employee'}
            </Badge>
          </div>
        )}
        <Button
          variant="ghost"
          onClick={signOut}
          className={cn(
            'w-full rounded-xl text-sidebar-foreground/90 hover:bg-sidebar-accent hover:text-sidebar-foreground font-medium transition-all duration-200',
            collapsed ? 'px-0 justify-center h-10' : 'justify-start gap-2 h-10'
          )}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Sign Out</span>}
        </Button>
      </div>
    </>
  );
}

export function AppSidebar({
  mobileOpen,
  onMobileOpenChange,
}: {
  mobileOpen?: boolean;
  onMobileOpenChange?: (open: boolean) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Sheet open={mobileOpen} onOpenChange={onMobileOpenChange}>
        <SheetContent side="left" className="w-64 p-0 bg-sidebar text-sidebar-foreground border-sidebar-border">
          <div className="h-16 flex items-center px-4 border-b border-sidebar-border bg-sidebar-accent/20">
            <img src="/logo.png" alt="RemoAsset" className="h-8 w-auto object-contain" />
          </div>
          <SidebarNav onNavigate={() => onMobileOpenChange?.(false)} />
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <aside
      className={cn(
        'h-screen bg-sidebar text-sidebar-foreground flex flex-col transition-all duration-300 sticky top-0',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      <div className="h-16 flex items-center justify-between px-4 border-b border-sidebar-border bg-sidebar-accent/10">
        {collapsed ? (
          <img src="/favicon.png" alt="RemoAsset" className="h-8 w-8 object-contain flex-shrink-0" />
        ) : (
          <img src="/logo.png" alt="RemoAsset" className="h-8 w-auto object-contain" />
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(!collapsed)}
          className="text-sidebar-foreground hover:bg-sidebar-accent rounded-lg transition-colors"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>
      <SidebarNav collapsed={collapsed} />
    </aside>
  );
}
