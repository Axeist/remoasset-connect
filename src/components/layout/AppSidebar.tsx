import { useState, useEffect } from 'react';
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
  User,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';

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
  const [fullName, setFullName] = useState<string>('');
  const [designation, setDesignation] = useState<string>('');

  useEffect(() => {
    if (user) {
      supabase
        .from('profiles')
        .select('full_name, designation')
        .eq('user_id', user.id)
        .single()
        .then(({ data }) => {
          if (data?.full_name) setFullName(data.full_name);
          if (data?.designation) setDesignation(data.designation);
        });
    }
  }, [user]);

  return (
    <>
      <nav className="flex-1 py-4 px-2.5 space-y-1">
        {filteredNav.map((item) => {
          const isActive =
            location.pathname === item.url || location.pathname.startsWith(item.url + '/');
          return (
            <NavLink
              key={item.title}
              to={item.url}
              onClick={onNavigate}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group',
                isActive
                  ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                  : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
              )}
            >
              <item.icon className={cn('h-[19px] w-[19px] shrink-0', isActive && 'text-sidebar-primary-foreground')} />
              {!collapsed && <span className="text-sm font-medium">{item.title}</span>}
            </NavLink>
          );
        })}
      </nav>
      <div className="p-3 border-t border-sidebar-border/50">
        {!collapsed && user && (
          <div className="mb-3 rounded-lg bg-gradient-to-br from-sidebar-accent/40 to-sidebar-accent/20 p-3 border border-sidebar-border/30">
            <div className="flex items-center gap-2.5 mb-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sidebar-primary/15">
                <User className="h-4 w-4 text-sidebar-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-sidebar-foreground truncate">
                  {fullName || 'User'}
                </p>
                {designation && (
                  <p className="text-xs text-sidebar-foreground/60 truncate">
                    {designation}
                  </p>
                )}
              </div>
            </div>
            <Badge
              variant={isAdmin ? 'default' : 'secondary'}
              className={cn(
                'h-5 px-2.5 text-[10px] font-semibold capitalize tracking-wide',
                isAdmin && 'bg-sidebar-primary text-sidebar-primary-foreground border-0 shadow-sm'
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
        <SheetContent side="left" className="w-72 p-0 bg-sidebar text-sidebar-foreground border-sidebar-border">
          <div className="px-4 py-3 border-b border-sidebar-border/50 bg-sidebar-accent/10">
            <img src="/logo.png" alt="RemoAsset" className="h-7 w-auto object-contain mb-1" />
            <p className="text-[10px] text-sidebar-foreground/60 font-medium tracking-wide">
              Vendor Resource Management
            </p>
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
        collapsed ? 'w-16' : 'w-72'
      )}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-sidebar-border/50 bg-sidebar-accent/10">
        {collapsed ? (
          <img src="/favicon.png" alt="RemoAsset" className="h-8 w-8 object-contain flex-shrink-0" />
        ) : (
          <div className="flex-1 min-w-0">
            <img src="/logo.png" alt="RemoAsset" className="h-7 w-auto object-contain mb-1" />
            <p className="text-[10px] text-sidebar-foreground/60 font-medium tracking-wide">
              Vendor Resource Management
            </p>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(!collapsed)}
          className="h-7 w-7 shrink-0 text-sidebar-foreground hover:bg-sidebar-accent/50 rounded-md transition-colors"
        >
          {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
        </Button>
      </div>
      <SidebarNav collapsed={collapsed} />
    </aside>
  );
}
