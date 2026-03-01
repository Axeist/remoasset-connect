import { useState, useEffect, useRef } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  CheckSquare,
  CalendarCheck,
  Bell,
  BarChart3,
  HelpCircle,
  LogOut,
  Settings,
  Shield,
  Activity,
  Kanban,
  Globe2,
  Inbox,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useCurrentUserProfile } from '@/hooks/useCurrentUserProfile';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';

const navItems = [
  { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard, roles: ['admin', 'employee'] },
  { title: 'Inbox', url: '/inbox', icon: Inbox, roles: ['admin', 'employee'] },
  { title: 'Leads', url: '/leads', icon: Users, roles: ['admin', 'employee'] },
  { title: 'Vendors', url: '/vendors', icon: Globe2, roles: ['admin', 'employee'] },
  { title: 'My Pipeline', url: '/pipeline', icon: Kanban, roles: ['employee'] },
  { title: 'Pipeline Overview', url: '/admin/pipeline', icon: Kanban, roles: ['admin'] },
  { title: 'My Tasks', url: '/tasks', icon: CheckSquare, roles: ['admin', 'employee'] },
  { title: 'Follow-ups', url: '/follow-ups', icon: CalendarCheck, roles: ['admin', 'employee'] },
  { title: 'Activity Monitor', url: '/admin/team-activity', icon: Activity, roles: ['admin'] },
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
  const { fullName, designation, avatarUrl } = useCurrentUserProfile();
  const filteredNav = navItems.filter((item) => item.roles.includes(role || 'employee'));
  const isAdmin = role === 'admin';
  const initials = (fullName || user?.email || 'U').slice(0, 2).toUpperCase();

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <nav className="flex-1 min-h-0 py-4 px-2.5 space-y-1 overflow-y-auto overflow-x-hidden">
        {filteredNav.map((item) => {
          // For /admin, only match exact path, not sub-paths like /admin/team-activity
          const isActive = item.url === '/admin'
            ? location.pathname === item.url
            : location.pathname === item.url || location.pathname.startsWith(item.url + '/');
          return (
            <NavLink
              key={item.title}
              to={item.url}
              onClick={onNavigate}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-[10px] transition-all duration-200 group',
                isActive
                  ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                  : 'text-[#9DA2B3] hover:text-[#FAFBFF] hover:bg-sidebar-accent/50'
              )}
            >
              <item.icon className={cn('h-[19px] w-[19px] shrink-0', isActive && 'text-sidebar-primary-foreground')} />
              <span
                className={cn(
                  'text-sm font-medium whitespace-nowrap overflow-hidden transition-all duration-200',
                  collapsed ? 'opacity-0 w-0 max-w-0' : 'opacity-100 w-auto max-w-[200px] delay-100'
                )}
              >
                {item.title}
              </span>
            </NavLink>
          );
        })}
      </nav>
      <div className="shrink-0 p-3 border-t border-sidebar-border/50 mt-auto">
        {!collapsed && user && (
          <div className="mb-3 rounded-xl bg-gradient-to-br from-sidebar-primary/10 via-sidebar-accent/30 to-sidebar-accent/10 p-3.5 border border-sidebar-border/40 shadow-lg">
            <div className="flex items-start gap-3 mb-3">
              <Avatar className="h-10 w-10 shrink-0 rounded-full shadow-md ring-2 ring-sidebar-border/40">
                <AvatarImage src={avatarUrl || undefined} alt={fullName || undefined} className="rounded-full" />
                <AvatarFallback className="rounded-full bg-gradient-to-br from-sidebar-primary to-sidebar-primary/80 text-white text-sm font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-sidebar-foreground truncate mb-0.5">
                  {fullName || 'User'}
                </p>
                {designation && (
                  <p className="text-xs text-sidebar-foreground/70 truncate font-medium">
                    {designation}
                  </p>
                )}
              </div>
            </div>
            <Badge
              variant={isAdmin ? 'default' : 'secondary'}
              className={cn(
                'h-6 px-3 text-[11px] font-bold capitalize tracking-wider shadow-sm',
                isAdmin && 'bg-gradient-to-r from-sidebar-primary to-sidebar-primary/90 text-white border-0'
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
            'w-full rounded-lg text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground font-medium transition-all duration-200 text-sm',
            collapsed ? 'px-0 justify-center h-9' : 'justify-start gap-2 h-9'
          )}
        >
          <LogOut className="h-[19px] w-[19px] shrink-0" />
          {!collapsed && <span>Sign Out</span>}
        </Button>
      </div>
    </div>
  );
}

export function AppSidebar({
  mobileOpen,
  onMobileOpenChange,
}: {
  mobileOpen?: boolean;
  onMobileOpenChange?: (open: boolean) => void;
}) {
  const [collapsed, setCollapsed] = useState(true);
  const isMobile = useIsMobile();
  const collapseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = () => {
    if (collapseTimeoutRef.current) {
      clearTimeout(collapseTimeoutRef.current);
      collapseTimeoutRef.current = null;
    }
    setCollapsed(false);
  };

  const handleMouseLeave = () => {
    collapseTimeoutRef.current = setTimeout(() => setCollapsed(true), 200);
  };

  useEffect(() => {
    return () => {
      if (collapseTimeoutRef.current) clearTimeout(collapseTimeoutRef.current);
    };
  }, []);

  if (isMobile) {
    return (
      <Sheet open={mobileOpen} onOpenChange={onMobileOpenChange}>
        <SheetContent side="left" className="w-[270px] p-0 bg-sidebar text-sidebar-foreground border-sidebar-border">
          <div className="relative px-4 py-5 border-b border-sidebar-border/40 overflow-hidden">
            {/* Decorative background elements */}
            <div className="absolute inset-0 bg-gradient-to-br from-sidebar-primary/5 via-transparent to-sidebar-accent/5" />
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-sidebar-primary/5 rounded-full blur-2xl" />
            <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-sidebar-accent/5 rounded-full blur-2xl" />
            
            <div className="relative z-10">
              <img src="/logo.png" alt="RemoAsset Connect" className="h-9 w-auto object-contain mb-2 drop-shadow-sm" />
              <div className="flex items-center gap-1.5">
                <div className="h-[1px] w-6 bg-gradient-to-r from-sidebar-primary/40 to-transparent" />
                <p className="font-display text-xl font-bold text-sidebar-foreground tracking-tight">
                  Connect
                </p>
              </div>
            </div>
          </div>
          <SidebarNav onNavigate={() => onMobileOpenChange?.(false)} />
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <aside
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={cn(
        'h-screen bg-sidebar text-sidebar-foreground flex flex-col sticky top-0 border-r border-sidebar-border/30 overflow-hidden',
        'transition-[width] duration-300 ease-in-out',
        collapsed ? 'w-16' : 'w-[270px]'
      )}
    >
      <div className="relative flex items-center justify-between min-w-0 px-4 py-5 border-b border-sidebar-border/40 overflow-hidden shrink-0">
        {/* Decorative background elements */}
        <div className="absolute inset-0 bg-gradient-to-br from-sidebar-primary/5 via-transparent to-sidebar-accent/5" />
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-sidebar-primary/5 rounded-full blur-2xl" />
        <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-sidebar-accent/5 rounded-full blur-2xl" />
        
        {collapsed ? (
          <img src="/favicon.png" alt="RemoAsset Connect" className="h-9 w-9 object-contain flex-shrink-0 relative z-10" />
        ) : (
          <div className="flex-1 min-w-0 relative z-10">
            <img src="/logo.png" alt="RemoAsset Connect" className="h-9 w-auto object-contain mb-2 drop-shadow-sm" />
            <div className="flex items-center gap-1.5">
              <div className="h-[1px] w-6 bg-gradient-to-r from-sidebar-primary/40 to-transparent" />
              <p className="font-display text-xl font-bold text-sidebar-foreground tracking-tight whitespace-nowrap">
                Connect
              </p>
            </div>
          </div>
        )}
      </div>
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        <SidebarNav collapsed={collapsed} />
      </div>
    </aside>
  );
}
