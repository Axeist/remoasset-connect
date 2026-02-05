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
  Activity,
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
  { title: 'Team Activity', url: '/admin/team-activity', icon: Activity, roles: ['admin'] },
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
          <div className="mb-3 rounded-xl bg-gradient-to-br from-sidebar-primary/10 via-sidebar-accent/30 to-sidebar-accent/10 p-3.5 border border-sidebar-border/40 shadow-lg">
            <div className="flex items-start gap-3 mb-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sidebar-primary to-sidebar-primary/80 shadow-md">
                <User className="h-5 w-5 text-white" />
              </div>
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
        <SheetContent side="left" className="w-[270px] p-0 bg-sidebar text-sidebar-foreground border-sidebar-border">
          <div className="relative px-4 py-5 border-b border-sidebar-border/40 overflow-hidden">
            {/* Decorative background elements */}
            <div className="absolute inset-0 bg-gradient-to-br from-sidebar-primary/5 via-transparent to-sidebar-accent/5" />
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-sidebar-primary/5 rounded-full blur-2xl" />
            <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-sidebar-accent/5 rounded-full blur-2xl" />
            
            <div className="relative z-10">
              <img src="/logo.png" alt="RemoAsset" className="h-9 w-auto object-contain mb-2 drop-shadow-sm" />
              <div className="flex items-center gap-1.5">
                <div className="h-[1px] w-6 bg-gradient-to-r from-sidebar-primary/40 to-transparent" />
                <p className="text-[11px] text-sidebar-foreground/75 font-medium tracking-wider uppercase">
                  Vendor Resource Management
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
      className={cn(
        'h-screen bg-sidebar text-sidebar-foreground flex flex-col transition-all duration-300 sticky top-0 border-r border-sidebar-border/30',
        collapsed ? 'w-16' : 'w-[270px]'
      )}
    >
      <div className="relative flex items-center justify-between px-4 py-5 border-b border-sidebar-border/40 overflow-hidden">
        {/* Decorative background elements */}
        <div className="absolute inset-0 bg-gradient-to-br from-sidebar-primary/5 via-transparent to-sidebar-accent/5" />
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-sidebar-primary/5 rounded-full blur-2xl" />
        <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-sidebar-accent/5 rounded-full blur-2xl" />
        
        {collapsed ? (
          <img src="/favicon.png" alt="RemoAsset" className="h-9 w-9 object-contain flex-shrink-0 relative z-10" />
        ) : (
          <div className="flex-1 min-w-0 relative z-10">
            <img src="/logo.png" alt="RemoAsset" className="h-9 w-auto object-contain mb-2 drop-shadow-sm" />
            <div className="flex items-center gap-1.5">
              <div className="h-[1px] w-6 bg-gradient-to-r from-sidebar-primary/40 to-transparent" />
              <p className="text-[11px] text-sidebar-foreground/75 font-medium tracking-wider uppercase">
                Vendor Resource Management
              </p>
            </div>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(!collapsed)}
          className="h-7 w-7 shrink-0 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 rounded-md transition-all relative z-10"
        >
          {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
        </Button>
      </div>
      <SidebarNav collapsed={collapsed} />
    </aside>
  );
}
