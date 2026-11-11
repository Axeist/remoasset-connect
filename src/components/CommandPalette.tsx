import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from 'next-themes';
import {
  LayoutDashboard, Users, Kanban, CheckSquare, CalendarCheck, Inbox, Globe2, Building2, Megaphone, Tag,
  BarChart3, Bell, Settings, HelpCircle, Sun, LogOut, Search, Loader2,
} from 'lucide-react';
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator,
} from '@/components/ui/command';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toggleThemeWithReveal } from '@/lib/theme-transition';
import type { Permission } from '@/lib/permissions';

export const OPEN_PALETTE_EVENT = 'remoasset:open-palette';
export const openCommandPalette = () => window.dispatchEvent(new Event(OPEN_PALETTE_EVENT));

type Dest = { title: string; url: string; icon: React.ElementType; permission?: Permission; anyOf?: Permission[]; keywords?: string };
const DESTINATIONS: Dest[] = [
  { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard, keywords: 'home overview' },
  { title: 'Leads', url: '/leads', icon: Users, anyOf: ['leads.own', 'leads.all'], keywords: 'vendors contacts' },
  { title: 'My Pipeline', url: '/pipeline', icon: Kanban, permission: 'pipeline.own', keywords: 'kanban stages' },
  { title: 'My Tasks', url: '/tasks', icon: CheckSquare, keywords: 'todo' },
  { title: 'Follow-ups', url: '/follow-ups', icon: CalendarCheck, keywords: 'reminders' },
  { title: 'Inbox', url: '/inbox', icon: Inbox, keywords: 'email gmail' },
  { title: 'Vendors', url: '/vendors', icon: Globe2, permission: 'vendors.use', keywords: 'pricing directory' },
  { title: 'Clients', url: '/clients', icon: Building2, permission: 'clients.use', keywords: 'requests' },
  { title: 'RFQ', url: '/rfq', icon: Megaphone, permission: 'rfq.use', keywords: 'quotes campaign' },
  { title: 'Price Lookup', url: '/mrp-lookup', icon: Tag, keywords: 'mrp' },
  { title: 'Reports', url: '/reports', icon: BarChart3, keywords: 'analytics' },
  { title: 'Notifications', url: '/notifications', icon: Bell },
  { title: 'Settings', url: '/settings', icon: Settings, keywords: 'profile account' },
  { title: 'Help', url: '/help', icon: HelpCircle, keywords: 'docs support' },
];

const GO_KEYS: Record<string, string> = { d: '/dashboard', l: '/leads', p: '/pipeline', t: '/tasks', f: '/follow-ups', i: '/inbox', r: '/rfq' };

function isTyping(el: EventTarget | null) {
  const t = el as HTMLElement | null;
  if (!t) return false;
  return t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName);
}

/** ⌘K / Ctrl+K (or "/") opens search and navigation; "g" then d/l/p/t/f/i/r jumps to a page. */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [leads, setLeads] = useState<{ id: string; company_name: string }[]>([]);
  const [searching, setSearching] = useState(false);
  const navigate = useNavigate();
  const { can, signOut } = useAuth();
  const { resolvedTheme, setTheme } = useTheme();
  const gPending = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reqId = useRef(0);

  const go = useCallback((url: string) => {
    setOpen(false);
    navigate(url);
  }, [navigate]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
        return;
      }
      if (isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === '/') {
        e.preventDefault();
        setOpen(true);
        return;
      }
      if (gPending.current) {
        const dest = GO_KEYS[e.key.toLowerCase()];
        clearTimeout(gPending.current);
        gPending.current = null;
        if (dest) { e.preventDefault(); navigate(dest); }
        return;
      }
      if (e.key.toLowerCase() === 'g') {
        gPending.current = setTimeout(() => { gPending.current = null; }, 900);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener('keydown', onKey);
    window.addEventListener(OPEN_PALETTE_EVENT, onOpen);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener(OPEN_PALETTE_EVENT, onOpen);
    };
  }, [navigate]);

  // Live lead search (RLS already limits results to leads the user may see).
  useEffect(() => {
    const q = query.trim();
    if (!open || q.length < 2) { setLeads([]); setSearching(false); return; }
    const id = ++reqId.current;
    setSearching(true);
    const t = setTimeout(async () => {
      const safe = q.replace(/[%,()]/g, ' ');
      const { data } = await supabase.from('leads').select('id, company_name').ilike('company_name', `%${safe}%`).limit(6);
      if (id !== reqId.current) return;
      setLeads((data as { id: string; company_name: string }[]) ?? []);
      setSearching(false);
    }, 200);
    return () => clearTimeout(t);
  }, [query, open]);

  useEffect(() => { if (!open) setQuery(''); }, [open]);

  const visible = useMemo(
    () => DESTINATIONS.filter((d) => (d.permission ? can(d.permission) : d.anyOf ? d.anyOf.some((p) => can(p)) : true)),
    [can],
  );

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search leads, jump to a page…" value={query} onValueChange={setQuery} autoFocus />
      <CommandList className="max-h-[min(60dvh,420px)]">
        <CommandEmpty>
          <span className="flex items-center justify-center gap-2 text-muted-foreground">
            {searching ? <><Loader2 className="h-4 w-4 animate-spin" /> Searching…</> : <><Search className="h-4 w-4" /> No results</>}
          </span>
        </CommandEmpty>
        {leads.length > 0 && (
          <>
            <CommandGroup heading="Leads">
              {leads.map((l) => (
                <CommandItem key={l.id} value={`lead ${l.company_name} ${l.id}`} onSelect={() => go(`/leads/${l.id}`)}>
                  <Users className="mr-2 h-4 w-4" /> {l.company_name}
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}
        {query.trim().length >= 2 && (
          <>
            <CommandGroup heading="Search">
              <CommandItem value={`search all leads for ${query}`} onSelect={() => go(`/leads?search=${encodeURIComponent(query.trim())}`)}>
                <Search className="mr-2 h-4 w-4" /> Search all leads for “{query.trim()}”
              </CommandItem>
            </CommandGroup>
            <CommandSeparator />
          </>
        )}
        <CommandGroup heading="Go to">
          {visible.map((d) => (
            <CommandItem key={d.url} value={`${d.title} ${d.keywords ?? ''}`} onSelect={() => go(d.url)}>
              <d.icon className="mr-2 h-4 w-4" /> {d.title}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Actions">
          <CommandItem value="toggle theme dark light" onSelect={() => { setOpen(false); setTimeout(() => toggleThemeWithReveal(resolvedTheme, setTheme), 120); }}>
            <Sun className="mr-2 h-4 w-4" /> Switch light / dark theme
          </CommandItem>
          <CommandItem value="sign out log out" onSelect={() => { setOpen(false); void signOut(); }}>
            <LogOut className="mr-2 h-4 w-4" /> Sign out
          </CommandItem>
        </CommandGroup>
      </CommandList>
      <div className="hidden items-center justify-between border-t border-border px-3 py-2 text-[11px] text-muted-foreground sm:flex">
        <span>↑↓ to move · ↵ to open · esc to close</span>
        <span>Tip: press <kbd className="rounded border px-1">g</kbd> then <kbd className="rounded border px-1">l</kbd> for Leads</span>
      </div>
    </CommandDialog>
  );
}
