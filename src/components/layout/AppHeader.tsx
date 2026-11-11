import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTheme } from 'next-themes';
import { Bell, Search, Sun, Moon, Menu, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { toggleThemeWithReveal } from '@/lib/theme-transition';
import { openCommandPalette } from '@/components/CommandPalette';

type NotifPrefs = {
  sound?: boolean;
};

function loadNotifPrefs(): NotifPrefs {
  try {
    const raw = localStorage.getItem('remoasset_notif_prefs');
    return raw ? (JSON.parse(raw) as NotifPrefs) : {};
  } catch {
    return {};
  }
}

function playNotificationSound() {
  const prefs = loadNotifPrefs();
  if (!(prefs.sound ?? true)) return;
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.2);
  } catch {
    // ignore
  }
}

interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
  metadata?: { threadId?: string; leadId?: string; rfqId?: string; taskId?: string; followUpId?: string } | null;
}

export function AppHeader({ onMenuClick }: { onMenuClick?: () => void }) {
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();
  const { resolvedTheme, setTheme } = useTheme();
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [ringing, setRinging] = useState(false);
  const ringTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!user) return;
    const fetchNotifications = async () => {
      const [{ data }, { count }] = await Promise.all([
        supabase
          .from('notifications')
          .select('id, title, message, type, is_read, created_at, metadata')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(20),
        supabase
          .from('notifications')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('is_read', false),
      ]);
      setNotifications((data as AppNotification[]) ?? []);
      setUnreadCount(count ?? 0);
    };
    fetchNotifications();
    const channel = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const n = payload.new as AppNotification;
            // Apply the new row directly instead of refetching the whole list.
            setNotifications((prev) => (prev.some((x) => x.id === n.id) ? prev : [n, ...prev].slice(0, 20)));
            setUnreadCount((c) => c + 1);
            setRinging(true);
            clearTimeout(ringTimer.current);
            ringTimer.current = setTimeout(() => setRinging(false), 900);
            playNotificationSound();
            toast(n.title, { description: n.message, duration: 5000 });
          } else {
            fetchNotifications();
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const isMobile = useIsMobile();

  const markAsRead = async (id: string) => {
    const target = notifications.find((n) => n.id === id);
    if (!target || target.is_read) return;
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    setUnreadCount((c) => Math.max(0, c - 1));
    const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    if (error) {
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: false } : n)));
      setUnreadCount((c) => c + 1);
      toast.error('Could not mark notification as read');
    }
  };

  const markAllRead = async () => {
    if (!user || unreadCount === 0) return;
    const before = notifications;
    const beforeCount = unreadCount;
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false);
    if (error) {
      setNotifications(before);
      setUnreadCount(beforeCount);
      toast.error('Could not mark all as read');
    }
  };

  const notificationLink = useCallback((n: AppNotification): string | null => {
    const meta = n.metadata ?? undefined;
    if (n.type === 'email' && meta?.leadId) {
      return `/leads/${meta.leadId}?tab=emails${meta.threadId ? `&thread=${meta.threadId}` : ''}`;
    }
    if (meta?.rfqId) return `/rfq/${meta.rfqId}?tab=bids`;
    if (meta?.followUpId) return '/follow-ups';
    if (meta?.taskId) return '/tasks';
    if (meta?.leadId) return `/leads/${meta.leadId}`;
    return null;
  }, []);

  const deleteNotification = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    const removed = notifications.find((n) => n.id === id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    if (removed && !removed.is_read) setUnreadCount((c) => Math.max(0, c - 1));
    const { error } = await supabase.from('notifications').delete().eq('id', id).eq('user_id', user!.id);
    if (error && removed) {
      setNotifications((prev) => [removed, ...prev].sort((a, b) => b.created_at.localeCompare(a.created_at)));
      if (!removed.is_read) setUnreadCount((c) => c + 1);
      toast.error('Could not delete notification');
    }
  };

  return (
    <header className="h-14 border-b border-border/50 bg-card px-4 md:px-5 flex items-center justify-between gap-2 md:gap-3">
      {onMenuClick && isMobile && (
        <Button variant="ghost" size="icon" onClick={onMenuClick} className="shrink-0 h-9 w-9">
          <Menu className="h-[19px] w-[19px]" />
          <span className="sr-only">Open menu</span>
        </Button>
      )}
      {/* Search */}
      <div className="relative flex-1 max-w-md min-w-0">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search leads, tasks..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && searchQuery.trim()) {
              navigate(`/leads?search=${encodeURIComponent(searchQuery.trim())}`);
            }
          }}
          className="pl-10 h-9 text-sm bg-background"
        />
      </div>

      {/* Theme + Notifications */}
      <div className="flex items-center gap-1 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          onClick={openCommandPalette}
          className="relative h-9 w-9"
          aria-label="Search and jump to (command palette)"
          title="Search ⌘K"
        >
          <Search className="h-[19px] w-[19px]" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => toggleThemeWithReveal(resolvedTheme, setTheme, e)}
          className="relative h-9 w-9"
          aria-label="Toggle light and dark theme"
        >
          <Sun className="h-[19px] w-[19px] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-[19px] w-[19px] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>
        <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="relative h-9 w-9"
            aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
          >
            <Bell className={`h-[19px] w-[19px] ${ringing ? 'animate-bell-ring' : ''}`} />
            {unreadCount > 0 && (
              <Badge
                key={unreadCount}
                className={`absolute -top-1 -right-1 h-4 min-w-4 px-1 flex items-center justify-center text-[11px] gradient-accent border-0 ${ringing ? 'animate-badge-pulse' : ''}`}
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </Badge>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-80">
          <div className="p-2 border-b border-border flex items-center justify-between">
            <h4 className="font-semibold text-sm">Notifications</h4>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="text-xs text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary rounded"
              >
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-[60dvh] overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">No notifications</div>
          ) : (
            notifications.map((notification) => {
              const meta = notification.metadata as { threadId?: string; leadId?: string; rfqId?: string } | undefined;
              const inboxLink = notificationLink(notification);
              return (
                <DropdownMenuItem
                  key={notification.id}
                  className="flex flex-col items-start p-3 cursor-pointer relative pr-8"
                  onClick={() => markAsRead(notification.id)}
                >
                  <div className="w-full">
                    <button
                      type="button"
                      onClick={(e) => deleteNotification(e, notification.id)}
                      className="absolute right-2 top-2 p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                      aria-label="Delete notification"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                    <div className="flex items-center gap-2 w-full">
                      <span className="font-medium text-sm">{notification.title}</span>
                      {!notification.is_read && (
                        <span className="h-2 w-2 rounded-full bg-primary ml-auto" />
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">{notification.message}</span>
                    {inboxLink && (
                      <Link
                        to={inboxLink}
                        className="text-xs text-primary hover:underline mt-1 inline-block"
                        onClick={(e) => e.stopPropagation()}
                      >
                        View in app →
                      </Link>
                    )}
                    <span className="text-xs text-muted-foreground/80 mt-0.5 block">
                      {format(new Date(notification.created_at), 'MMM d, HH:mm')}
                    </span>
                  </div>
                </DropdownMenuItem>
              );
            })
          )}
          </div>
          <div className="border-t border-border p-1">
            <DropdownMenuItem asChild className="justify-center text-sm text-primary cursor-pointer">
              <Link to="/notifications">View all notifications</Link>
            </DropdownMenuItem>
          </div>
        </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
