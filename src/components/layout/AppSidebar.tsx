import { useState, useEffect, useRef, useMemo } from 'react';
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
  Terminal,
  Sparkles,
  Building2,
  ArrowRightLeft,
  Megaphone,
  Tag,
  ChevronDown,
  MapPinned,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useCurrentUserProfile } from '@/hooks/useCurrentUserProfile';
import { useDeveloperMode } from '@/hooks/useDeveloperMode';
import { roleLabel, type Permission } from '@/lib/permissions';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

const STORAGE_KEY = 'sidebar.groups';

type NavItem = {
  title: string;
  url: string;
  icon: React.ElementType;
  permission?: Permission;
  anyOf?: Permission[];
  show?: (ctx: { can: (p: Permission) => boolean; developerMode: boolean; isAdmin: boolean }) => boolean;
};

type NavGroup = {
  id: string;
  title: string;
  items: NavItem[];
};

const pinnedItems: NavItem[] = [
  { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard },
  { title: 'Inbox', url: '/inbox', icon: Inbox },
];

const navGroups: NavGroup[] = [
  {
    id: 'pipeline',
    title: 'Pipeline',
    items: [
      { title: 'Leads', url: '/leads', icon: Users, anyOf: ['leads.own', 'leads.all'] },
      { title: 'My Pipeline', url: '/pipeline', icon: Kanban, permission: 'pipeline.own' },
      { title: 'Pipeline Overview', url: '/admin/pipeline', icon: Kanban, permission: 'pipeline.team' },
      { title: 'My Tasks', url: '/tasks', icon: CheckSquare },
      { title: 'Follow-ups', url: '/follow-ups', icon: CalendarCheck },
    ],
  },
  {
    id: 'partners',
    title: 'Partners',
    items: [
      { title: 'Vendors', url: '/vendors', icon: Globe2, permission: 'vendors.use' },
      { title: 'Clients', url: '/clients', icon: Building2, permission: 'clients.use' },
      { title: 'RFQ', url: '/rfq', icon: Megaphone, permission: 'rfq.use' },
      { title: 'Price Lookup', url: '/mrp-lookup', icon: Tag },
      { title: 'Vendor Agent', url: '/vendor-agent', icon: Sparkles, permission: 'admin.panel' },
    ],
  },
  {
    id: 'coverage',
    title: 'Coverage',
    items: [
      { title: 'CSM Home', url: '/csm', icon: MapPinned, permission: 'csm.workspace' },
      { title: 'Country coverage', url: '/csm/coverage', icon: Globe2, permission: 'coverage.view' },
    ],
  },
  {
    id: 'team',
    title: 'Team',
    items: [
      { title: 'Activity Monitor', url: '/admin/team-activity', icon: Activity, permission: 'pipeline.team' },
      { title: 'Transfer Log', url: '/admin/transfer-log', icon: ArrowRightLeft, permission: 'pipeline.team' },
      { title: 'Reports', url: '/reports', icon: BarChart3 },
      { title: 'Notifications', url: '/notifications', icon: Bell },
    ],
  },
  {
    id: 'tools',
    title: 'Tools',
    items: [
      {
        title: 'Developer',
        url: '/developer',
        icon: Terminal,
        show: ({ can, developerMode }) => can('developer.tools') || developerMode,
      },
      { title: 'Help', url: '/help', icon: HelpCircle },
      { title: 'Settings', url: '/settings', icon: Settings },
    ],
  },
  {
    id: 'admin',
    title: 'Admin',
    items: [
      { title: 'Admin Panel', url: '/admin', icon: Shield, permission: 'admin.panel' },
    ],
  },
];

function itemVisible(
  item: NavItem,
  ctx: { can: (p: Permission) => boolean; developerMode: boolean; isAdmin: boolean },
) {
  if (item.show) return item.show(ctx);
  if (item.permission) return ctx.can(item.permission);
  if (item.anyOf) return item.anyOf.some((p) => ctx.can(p));
  return true;
}

function pathActive(pathname: string, url: string) {
  if (url === '/admin') return pathname === url;
  return pathname === url || pathname.startsWith(url + '/');
}

function loadGroupState(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Record<string, boolean>;
  } catch { /* ignore */ }
  return {};
}

function saveGroupState(state: Record<string, boolean>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

interface SidebarNavProps {
  collapsed?: boolean;
  onNavigate?: () => void;
  onNavClick?: () => void;
}

function NavLinkRow({
  item,
  collapsed,
  pathname,
  onClick,
}: {
  item: NavItem;
  collapsed?: boolean;
  pathname: string;
  onClick: () => void;
}) {
  const isActive = pathActive(pathname, item.url);
  return (
    <NavLink
      to={item.url}
      onClick={onClick}
      title={collapsed ? item.title : undefined}
      className={cn(
        'flex items-center gap-3 w-full min-w-0 px-3 py-2 rounded-[10px] transition-all duration-200 group',
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
}

function SidebarNav({ collapsed = false, onNavigate, onNavClick }: SidebarNavProps) {
  const location = useLocation();
  const { role, signOut, user, can, isAdmin } = useAuth();
  const { fullName, designation, avatarUrl } = useCurrentUserProfile();
  const developerModeEnabled = useDeveloperMode();
  const [groupOpen, setGroupOpen] = useState<Record<string, boolean>>(loadGroupState);

  const ctx = { can, developerMode: developerModeEnabled, isAdmin };
  const visibleGroups = useMemo(
    () =>
      navGroups
        .map((g) => ({ ...g, items: g.items.filter((item) => itemVisible(item, ctx)) }))
        .filter((g) => g.items.length > 0),
    [can, developerModeEnabled, isAdmin],
  );

  useEffect(() => {
    const next = { ...groupOpen };
    let changed = false;
    for (const g of visibleGroups) {
      if (g.items.some((item) => pathActive(location.pathname, item.url)) && next[g.id] !== true) {
        next[g.id] = true;
        changed = true;
      }
    }
    if (changed) {
      setGroupOpen(next);
      saveGroupState(next);
    }
  }, [location.pathname, visibleGroups]);

  const toggleGroup = (id: string) => {
    setGroupOpen((prev) => {
      const next = { ...prev, [id]: !(prev[id] ?? false) };
      saveGroupState(next);
      return next;
    });
  };

  const handleClick = () => {
    onNavClick?.();
    onNavigate?.();
  };

  const initials = (fullName || user?.email || 'U').slice(0, 2).toUpperCase();

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <nav className="flex-1 min-h-0 py-4 px-2.5 space-y-1 overflow-y-auto overflow-x-hidden w-full">
        {pinnedItems.map((item) => (
          <NavLinkRow
            key={item.title}
            item={item}
            collapsed={collapsed}
            pathname={location.pathname}
            onClick={handleClick}
          />
        ))}

        {visibleGroups.map((group) => {
          const open = collapsed ? false : (groupOpen[group.id] ?? false);
          if (collapsed) {
            return (
              <div key={group.id} className="pt-2 space-y-1">
                {group.items.map((item) => (
                  <NavLinkRow
                    key={item.title}
                    item={item}
                    collapsed
                    pathname={location.pathname}
                    onClick={handleClick}
                  />
                ))}
              </div>
            );
          }
          return (
            <Collapsible key={group.id} open={open} onOpenChange={() => toggleGroup(group.id)}>
              <CollapsibleTrigger className="flex w-full items-center justify-between px-3 py-2 mt-2 rounded-[10px] text-[11px] font-semibold uppercase tracking-wider text-[#9DA2B3] hover:text-[#FAFBFF] hover:bg-sidebar-accent/40">
                <span>{group.title}</span>
                <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} />
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-0.5">
                {group.items.map((item) => (
                  <NavLinkRow
                    key={item.title}
                    item={item}
                    pathname={location.pathname}
                    onClick={handleClick}
                  />
                ))}
              </CollapsibleContent>
            </Collapsible>
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
                'h-6 px-3 text-[11px] font-bold tracking-wider shadow-sm',
                isAdmin && 'bg-gradient-to-r from-sidebar-primary to-sidebar-primary/90 text-white border-0'
              )}
            >
              {roleLabel(role)}
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
  const lastClickInSidebarRef = useRef(0);

  const handleMouseEnter = () => {
    if (collapseTimeoutRef.current) {
      clearTimeout(collapseTimeoutRef.current);
      collapseTimeoutRef.current = null;
    }
    setCollapsed(false);
  };

  const handleMouseLeave = () => {
    collapseTimeoutRef.current = setTimeout(() => {
      if (Date.now() - lastClickInSidebarRef.current < 800) return;
      setCollapsed(true);
    }, 250);
  };

  const handleNavClick = () => {
    lastClickInSidebarRef.current = Date.now();
  };

  const { pathname } = useLocation();
  useEffect(() => {
    lastClickInSidebarRef.current = Date.now();
  }, [pathname]);

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
            <div className="absolute inset-0 bg-gradient-to-br from-sidebar-primary/5 via-transparent to-sidebar-accent/5" />
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
      onMouseDown={handleNavClick}
      className={cn(
        'h-screen bg-sidebar text-sidebar-foreground flex flex-col sticky top-0 border-r border-sidebar-border/30 overflow-hidden',
        'transition-[width] duration-300 ease-in-out',
        collapsed ? 'w-16' : 'w-[270px]'
      )}
    >
      <div className="relative flex items-center justify-between min-w-0 px-4 py-5 border-b border-sidebar-border/40 overflow-hidden shrink-0">
        <div className="absolute inset-0 bg-gradient-to-br from-sidebar-primary/5 via-transparent to-sidebar-accent/5" />
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
        <SidebarNav collapsed={collapsed} onNavClick={handleNavClick} />
      </div>
    </aside>
  );
}
