import { useState, useEffect } from 'react';
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

function playNotificationSound() {
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
  metadata?: { threadId?: string; leadId?: string } | null;
}

export function AppHeader({ onMenuClick }: { onMenuClick?: () => void }) {
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  useEffect(() => {
    if (!user) return;
    const fetchNotifications = async () => {
      const { data } = await supabase
        .from('notifications')
        .select('id, title, message, type, is_read, created_at, metadata')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);
      setNotifications((data as AppNotification[]) ?? []);
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
          fetchNotifications();
          if (payload.eventType === 'INSERT') playNotificationSound();
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;
  const isMobile = useIsMobile();

  const markAsRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
  };

  const deleteNotification = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    await supabase.from('notifications').delete().eq('id', id).eq('user_id', user!.id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
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
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="relative h-9 w-9"
        >
          <Sun className="h-[19px] w-[19px] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-[19px] w-[19px] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>
        <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="relative h-9 w-9">
            <Bell className="h-[19px] w-[19px]" />
            {unreadCount > 0 && (
              <Badge 
                className="absolute -top-0.5 -right-0.5 h-4 w-4 p-0 flex items-center justify-center text-[10px] gradient-accent border-0"
              >
                {unreadCount}
              </Badge>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-80">
          <div className="p-2 border-b border-border">
            <h4 className="font-semibold text-sm">Notifications</h4>
          </div>
          {notifications.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">No notifications</div>
          ) : (
            notifications.map((notification) => {
              const meta = notification.metadata as { threadId?: string; leadId?: string } | undefined;
              const inboxLink = notification.type === 'email' && meta?.leadId
                ? `/leads/${meta.leadId}?tab=emails${meta.threadId ? `&thread=${meta.threadId}` : ''}`
                : null;
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
        </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
