import { useState, useEffect, useLayoutEffect, useCallback, useRef, useMemo } from 'react';
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
  Wrench,
  ChevronsDownUp,
  ChevronsUpDown,
  PanelLeftClose,
  Menu,
  Crown,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { hasPreferencesConsent } from '@/lib/cookie-consent';
import { useAuth } from '@/contexts/AuthContext';
import { useCurrentUserProfile } from '@/hooks/useCurrentUserProfile';
import { useDeveloperMode } from '@/hooks/useDeveloperMode';
import { roleLabel, type Permission } from '@/lib/permissions';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { BrandLogo } from '@/components/BrandLogo';
import { prefetchRoute } from '@/lib/prefetch';

const PIN_KEY = 'sidebar.pinned';
function loadPinned(): boolean {
  try { return localStorage.getItem(PIN_KEY) === '1'; } catch { return false; }
}
function savePinned(v: boolean) {
  try { if (hasPreferencesConsent()) localStorage.setItem(PIN_KEY, v ? '1' : '0'); } catch { /* ignore */ }
}

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
  icon: React.ElementType;
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
    icon: Kanban,
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
    icon: Globe2,
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
    icon: MapPinned,
    items: [
      { title: 'CSM Home', url: '/csm', icon: MapPinned, permission: 'csm.workspace' },
      { title: 'Country coverage', url: '/csm/coverage', icon: Globe2, permission: 'coverage.view' },
    ],
  },
  {
    id: 'team',
    title: 'Team',
    icon: Activity,
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
    icon: Wrench,
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
    icon: Shield,
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
  try {
    if (!hasPreferencesConsent()) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

interface SidebarNavProps {
  collapsed?: boolean;
  /** Larger touch targets (phone drawer). */
  touch?: boolean;
  onNavigate?: () => void;
  onNavClick?: () => void;
}

function NavLinkRow({
  item,
  collapsed,
  touch,
  pathname,
  onClick,
}: {
  item: NavItem;
  collapsed?: boolean;
  touch?: boolean;
  pathname: string;
  onClick: () => void;
}) {
  const isActive = pathActive(pathname, item.url);
  return (
    <NavLink
      to={item.url}
      onClick={onClick}
      onMouseEnter={() => prefetchRoute(item.url)}
      onFocus={() => prefetchRoute(item.url)}
      onTouchStart={() => prefetchRoute(item.url)}
      title={collapsed ? item.title : undefined}
      data-nav-active={isActive ? 'true' : undefined}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'group relative z-10 flex w-full min-w-0 items-center gap-3 rounded-[11px] px-3 outline-none',
        touch ? 'py-3' : 'py-2',
        'transition-[color,background-color,transform] duration-200 active:scale-[.98]',
        'focus-visible:ring-2 focus-visible:ring-sidebar-primary/70',
        isActive
          ? 'text-sidebar-primary-foreground'
          : 'text-sidebar-foreground/60 hover:bg-sidebar-accent/45 hover:text-sidebar-foreground',
      )}
    >
      <item.icon className="h-[19px] w-[19px] shrink-0 transition-transform duration-200 group-hover:scale-110" />
      <span
        className={cn(
          'overflow-hidden whitespace-nowrap text-sm font-medium transition-all duration-200',
          collapsed ? 'w-0 max-w-0 opacity-0' : 'w-auto max-w-[200px] opacity-100 delay-100',
        )}
      >
        {item.title}
      </span>
    </NavLink>
  );
}

function SidebarNav({ collapsed = false, touch = false, onNavigate, onNavClick }: SidebarNavProps) {
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

  // Sliding highlight: one pill that glides to whichever row is active.
  const navRef = useRef<HTMLElement>(null);
  const [ind, setInd] = useState({ top: 0, height: 0, visible: false });
  const measure = useCallback(() => {
    const nav = navRef.current;
    if (!nav) return;
    const el = nav.querySelector<HTMLElement>('[data-nav-active="true"]');
    if (!el) {
      setInd((i) => (i.visible ? { ...i, visible: false } : i));
      return;
    }
    const nr = nav.getBoundingClientRect();
    const er = el.getBoundingClientRect();
    const top = er.top - nr.top + nav.scrollTop;
    setInd((i) => (i.visible && Math.abs(i.top - top) < 0.5 && Math.abs(i.height - er.height) < 0.5 ? i : { top, height: er.height, visible: true }));
  }, []);
  const measureFor = useCallback((ms: number) => {
    const t0 = performance.now();
    let raf = 0;
    const loop = () => {
      measure();
      if (performance.now() - t0 < ms) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [measure]);
  useLayoutEffect(() => {
    measure();
    return measureFor(480);
  }, [location.pathname, collapsed, groupOpen, visibleGroups, measure, measureFor]);
  useEffect(() => {
    const nav = navRef.current;
    if (!nav || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(nav);
    return () => ro.disconnect();
  }, [measure]);

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

  const allExpanded =
    visibleGroups.length > 0 && visibleGroups.every((g) => groupOpen[g.id] === true);

  const setAllGroups = (open: boolean) => {
    const next = Object.fromEntries(visibleGroups.map((g) => [g.id, open]));
    setGroupOpen(next);
    saveGroupState(next);
  };

  const handleClick = () => {
    onNavClick?.();
    onNavigate?.();
  };

  const initials = (fullName || user?.email || 'U').slice(0, 2).toUpperCase();

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <nav
        ref={navRef}
        className={cn(
          'sb-scroll relative w-full flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-2.5',
          collapsed ? 'space-y-0.5 py-2' : 'space-y-0.5 py-3',
        )}
      >
        <span
          aria-hidden="true"
          className="sb-indicator pointer-events-none absolute left-2.5 right-2.5 top-0 z-0 rounded-[11px] will-change-transform"
          style={{
            height: ind.height,
            transform: `translate3d(0, ${ind.top}px, 0)`,
            opacity: ind.visible ? 1 : 0,
            transition: 'transform .38s cubic-bezier(.34,1.35,.64,1), height .25s ease, opacity .2s',
          }}
        />

        {pinnedItems.map((item) => (
          <NavLinkRow
            key={item.title}
            item={item}
            collapsed={collapsed}
            touch={touch}
            pathname={location.pathname}
            onClick={handleClick}
          />
        ))}

        {visibleGroups.length > 0 && !collapsed && (
          <button
            type="button"
            onClick={() => setAllGroups(!allExpanded)}
            className="relative z-10 mt-1 flex w-full items-center gap-2 rounded-[10px] px-3 py-1.5 text-[11px] font-medium text-sidebar-foreground/55 transition-colors hover:bg-sidebar-accent/40 hover:text-sidebar-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-sidebar-primary"
          >
            {allExpanded ? (
              <ChevronsDownUp className="h-3.5 w-3.5 shrink-0" />
            ) : (
              <ChevronsUpDown className="h-3.5 w-3.5 shrink-0" />
            )}
            <span>{allExpanded ? 'Collapse all' : 'Expand all'}</span>
          </button>
        )}

        {visibleGroups.map((group) => {
          const hasActive = group.items.some((item) => pathActive(location.pathname, item.url));
          const open = collapsed ? false : (groupOpen[group.id] ?? false);

          if (collapsed) {
            return (
              <button
                key={group.id}
                type="button"
                title={group.title}
                data-nav-active={hasActive ? 'true' : undefined}
                onClick={() => {
                  setGroupOpen((prev) => {
                    const next = { ...prev, [group.id]: true };
                    saveGroupState(next);
                    return next;
                  });
                }}
                className={cn(
                  'relative z-10 flex w-full min-w-0 items-center justify-center rounded-[11px] px-3 py-2 outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-sidebar-primary/70',
                  hasActive
                    ? 'text-sidebar-primary-foreground'
                    : 'text-sidebar-foreground/60 hover:bg-sidebar-accent/45 hover:text-sidebar-foreground',
                )}
              >
                <group.icon className="h-[19px] w-[19px] shrink-0" />
              </button>
            );
          }

          return (
            <Collapsible key={group.id} open={open} onOpenChange={() => toggleGroup(group.id)}>
              <CollapsibleTrigger className="relative z-10 mt-1 flex w-full items-center justify-between rounded-[10px] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/55 transition-colors hover:bg-sidebar-accent/40 hover:text-sidebar-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-sidebar-primary">
                <span className="flex min-w-0 items-center gap-2">
                  <span>{group.title}</span>
                  {hasActive && !open && (
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-sidebar-primary" />
                  )}
                </span>
                <ChevronDown className={cn('h-3.5 w-3.5 transition-transform duration-300', open && 'rotate-180')} />
              </CollapsibleTrigger>
              <CollapsibleContent className="sb-collapsible space-y-0.5 overflow-hidden">
                {group.items.map((item) => (
                  <NavLinkRow
                    key={item.title}
                    item={item}
                    touch={touch}
                    pathname={location.pathname}
                    onClick={handleClick}
                  />
                ))}
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </nav>

      <div className="mt-auto shrink-0 border-t border-sidebar-border/50 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {user && (
          <NavLink
            to="/settings"
            onClick={handleClick}
            title={[fullName || 'User', roleLabel(role), designation].filter(Boolean).join(' · ')}
            aria-label={`${fullName || 'Your profile'}, ${roleLabel(role)}. Open settings`}
            className={cn(
              'group mb-2 flex items-center rounded-full border border-white/15 bg-white/[0.09] shadow-[inset_0_1px_0_rgba(255,255,255,0.10)] outline-none transition-all duration-200',
              'hover:border-white/25 hover:bg-white/[0.14] focus-visible:ring-2 focus-visible:ring-sidebar-primary/70',
              collapsed ? 'mx-auto h-11 w-11 justify-center' : 'gap-3 py-1.5 pl-1.5 pr-4',
            )}
          >
            <span className="relative shrink-0">
              <Avatar className={cn('rounded-full ring-2 ring-sidebar-primary/50', collapsed ? 'h-9 w-9' : 'h-10 w-10')}>
                <AvatarImage src={avatarUrl || undefined} alt="" className="rounded-full object-cover" />
                <AvatarFallback className="rounded-full bg-sidebar-primary/80 text-sm font-semibold text-white">{initials}</AvatarFallback>
              </Avatar>
              <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-sidebar bg-success" aria-hidden="true" />
            </span>
            {!collapsed && (
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block truncate text-sm font-semibold text-sidebar-foreground">{fullName || 'User'}</span>
                <span className="mt-0.5 flex items-center gap-1 text-[11px] font-medium text-sidebar-foreground/70">
                  {isAdmin ? <Crown className="h-3 w-3 shrink-0 text-sidebar-primary" /> : role === 'csm' ? <ShieldCheck className="h-3 w-3 shrink-0" /> : <UserRound className="h-3 w-3 shrink-0" />}
                  <span className="truncate">{roleLabel(role)}</span>
                </span>
              </span>
            )}
          </NavLink>
        )}
        <Button
          variant="ghost"
          onClick={signOut}
          className={cn(
            'w-full rounded-lg text-sm font-medium text-sidebar-foreground/75 transition-all duration-200 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground',
            touch ? 'h-11' : 'h-9',
            collapsed ? 'justify-center px-0' : 'justify-start gap-2',
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
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(loadPinned);
  const isMobile = useIsMobile();
  const collapseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastClickInSidebarRef = useRef(0);
  const canHover = typeof window !== 'undefined' && window.matchMedia('(hover: hover)').matches;
  const collapsed = !pinned && !hovered;

  const handleMouseEnter = () => {
    if (!canHover) return;
    if (collapseTimeoutRef.current) {
      clearTimeout(collapseTimeoutRef.current);
      collapseTimeoutRef.current = null;
    }
    setHovered(true);
  };

  const handleMouseLeave = () => {
    if (!canHover) return;
    collapseTimeoutRef.current = setTimeout(() => {
      if (Date.now() - lastClickInSidebarRef.current < 800) return;
      setHovered(false);
    }, 250);
  };

  const handleNavClick = () => {
    lastClickInSidebarRef.current = Date.now();
  };

  const togglePin = () => {
    setPinned((p) => {
      savePinned(!p);
      return !p;
    });
    if (pinned) setHovered(false);
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
        <SheetContent side="left" className="w-[min(310px,86vw)] border-sidebar-border bg-sidebar p-0 text-sidebar-foreground">
          <div className="relative overflow-hidden border-b border-sidebar-border/40 px-5 pb-5 pt-[max(1.25rem,env(safe-area-inset-top))]">
            <div className="absolute inset-0 bg-gradient-to-br from-sidebar-primary/15 via-transparent to-sidebar-accent/10" />
            <div className="relative z-10 space-y-1">
              <BrandLogo tone="onDark" size={34} />
              <p className="pl-[44px] text-xs font-medium uppercase tracking-[0.14em] text-sidebar-foreground/50">Connect</p>
            </div>
          </div>
          <SidebarNav touch onNavigate={() => onMobileOpenChange?.(false)} />
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
        'sticky top-0 z-20 flex h-screen flex-col overflow-hidden border-r border-sidebar-border/30 bg-sidebar text-sidebar-foreground',
        'transition-[width,box-shadow] duration-300 ease-[cubic-bezier(.22,1,.36,1)]',
        collapsed ? 'w-16' : 'w-[270px]',
        !collapsed && !pinned && 'shadow-2xl shadow-black/30',
      )}
    >
      <div className="relative flex shrink-0 min-w-0 items-center justify-between overflow-hidden border-b border-sidebar-border/40 px-3.5 py-4">
        <div className="absolute inset-0 bg-gradient-to-br from-sidebar-primary/10 via-transparent to-sidebar-accent/5" />
        <button
          type="button"
          onClick={togglePin}
          className="relative z-10 flex min-w-0 items-center rounded-xl p-1 outline-none transition-transform active:scale-95 focus-visible:ring-2 focus-visible:ring-sidebar-primary/70"
          aria-label={pinned ? 'Unpin sidebar' : 'Pin sidebar open'}
          title={pinned ? 'Unpin sidebar' : 'Pin sidebar open'}
        >
          <BrandLogo tone="onDark" size={34} showWord={!collapsed} />
        </button>
        {!collapsed && (
          <button
            type="button"
            onClick={togglePin}
            className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-sidebar-primary"
            aria-label={pinned ? 'Collapse sidebar' : 'Pin sidebar open'}
            aria-pressed={pinned}
          >
            <PanelLeftClose className={cn('h-[18px] w-[18px] transition-transform duration-300', !pinned && 'rotate-180')} />
          </button>
        )}
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <SidebarNav collapsed={collapsed} onNavClick={handleNavClick} />
      </div>
    </aside>
  );
}

/** Phone bottom navigation: the four most-used destinations plus "More" for the full menu. */
export function MobileTabBar({ onMore }: { onMore: () => void }) {
  const { can, isAdmin } = useAuth();
  const developerMode = useDeveloperMode();
  const { pathname } = useLocation();
  const ctx = { can, developerMode, isAdmin };
  const items = (
    [
      { title: 'Home', url: '/dashboard', icon: LayoutDashboard },
      { title: 'Leads', url: '/leads', icon: Users, anyOf: ['leads.own', 'leads.all'] },
      { title: 'Pipeline', url: '/pipeline', icon: Kanban, permission: 'pipeline.own' },
      { title: 'Tasks', url: '/tasks', icon: CheckSquare },
    ] as NavItem[]
  ).filter((i) => itemVisible(i, ctx));
  const cols = items.length + 1;
  const activeIdx = items.findIndex((i) => pathActive(pathname, i.url));
  const idx = activeIdx === -1 ? items.length : activeIdx;

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-card/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl supports-[backdrop-filter]:bg-card/75"
    >
      <div className="relative mx-auto grid max-w-md px-2 py-1.5" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        <span
          aria-hidden="true"
          className="absolute bottom-1.5 left-2 top-1.5 rounded-2xl bg-primary/15"
          style={{
            width: `calc((100% - 1rem) / ${cols})`,
            transform: `translateX(${idx * 100}%)`,
            transition: 'transform .4s cubic-bezier(.34,1.4,.64,1)',
          }}
        />
        {items.map((item, i) => {
          const active = i === activeIdx;
          return (
            <NavLink
              key={item.url}
              to={item.url}
              onTouchStart={() => prefetchRoute(item.url)}
              onMouseEnter={() => prefetchRoute(item.url)}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'relative z-10 flex min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-2xl text-[11px] font-semibold outline-none transition-colors active:scale-95 focus-visible:ring-2 focus-visible:ring-primary',
                active ? 'text-primary' : 'text-muted-foreground',
              )}
            >
              <item.icon className={cn('h-[22px] w-[22px] transition-transform duration-300', active && '-translate-y-0.5 scale-110')} />
              {item.title}
            </NavLink>
          );
        })}
        <button
          type="button"
          onClick={onMore}
          aria-current={activeIdx === -1 ? 'page' : undefined}
          className={cn(
            'relative z-10 flex min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-2xl text-[11px] font-semibold outline-none transition-colors active:scale-95 focus-visible:ring-2 focus-visible:ring-primary',
            activeIdx === -1 ? 'text-primary' : 'text-muted-foreground',
          )}
        >
          <Menu className="h-[22px] w-[22px]" />
          More
        </button>
      </div>
    </nav>
  );
}
