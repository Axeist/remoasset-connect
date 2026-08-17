import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { safeFormat } from '@/lib/date';
import { Bell, CheckCheck, Loader2, Mail, ExternalLink, AlertTriangle } from 'lucide-react';
import { useActionables, type ActionableItem } from '@/hooks/useActionables';
import { DraftFollowUpDialog, type DraftFollowUpLead } from '@/components/leads/DraftFollowUpDialog';
import { cn } from '@/lib/utils';

interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
}

export default function Notifications() {
  const { user } = useAuth();
  const { toast } = useToast();
  const actionables = useActionables();
  const [tab, setTab] = useState('actionables');
  const [filter, setFilter] = useState<'all' | 'breach' | 'soon'>('breach');
  const [ownerFilter, setOwnerFilter] = useState<'all' | 'mine' | string>('all');
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [inboxLoading, setInboxLoading] = useState(false);
  const [draftLead, setDraftLead] = useState<DraftFollowUpLead | null>(null);
  const [draftOpen, setDraftOpen] = useState(false);

  const loadInbox = async () => {
    if (!user) return;
    setInboxLoading(true);
    const { data } = await supabase
      .from('notifications')
      .select('id, title, message, type, is_read, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100);
    setNotifications((data as AppNotification[]) ?? []);
    setInboxLoading(false);
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const markAsRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
  };

  const markAllRead = async () => {
    const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id);
    if (unreadIds.length === 0) return;
    await supabase.from('notifications').update({ is_read: true }).in('id', unreadIds);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    toast({ title: 'All marked as read' });
  };

  const visible = useMemo(() => {
    let rows = actionables.items;
    if (filter === 'breach') rows = rows.filter((i) => i.kind === 'sla_breach');
    else if (filter === 'soon') rows = rows.filter((i) => i.kind === 'sla_warning');
    if (actionables.isAdmin) {
      if (ownerFilter === 'mine') rows = rows.filter((i) => i.ownerId === user?.id);
      else if (ownerFilter !== 'all') rows = rows.filter((i) => i.ownerId === ownerFilter);
    }
    return rows;
  }, [actionables.items, actionables.isAdmin, filter, ownerFilter, user?.id]);

  const nowItems = visible.filter((i) => i.kind === 'sla_breach' || i.kind === 'overdue_followup' || i.kind === 'overdue_task');
  const soonItems = visible.filter((i) => i.kind === 'sla_warning');

  const openDraft = (item: ActionableItem) => {
    if (!item.leadId) return;
    setDraftLead({
      id: item.leadId,
      company_name: item.companyName ?? item.title,
      email: item.email ?? null,
      status: item.statusName ? { name: item.statusName } : null,
    });
    setDraftOpen(true);
  };

  const renderGroup = (title: string, rows: ActionableItem[]) => (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground px-1">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground px-1 py-4">Nothing here.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((item) => (
            <li
              key={item.id}
              tabIndex={0}
              onFocus={() => setFocusedId(item.id)}
              onClick={() => setFocusedId(item.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (item.email && item.leadId) openDraft(item);
                }
              }}
              className={cn(
                'rounded-xl border border-border/80 bg-card p-3 flex flex-col sm:flex-row sm:items-center gap-3 outline-none',
                item.kind === 'sla_breach' && 'border-l-2 border-l-amber-500 bg-amber-500/5',
                focusedId === item.id && 'ring-2 ring-primary/40'
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm truncate">{item.title}</span>
                  {item.statusName && (
                    <Badge
                      className="text-white border-0 text-[10px]"
                      style={{ backgroundColor: item.statusColor ?? undefined }}
                    >
                      {item.statusName}
                    </Badge>
                  )}
                  {item.sla?.badge && (
                    <Badge variant={item.sla.breached ? 'destructive' : 'secondary'} className="text-[10px]">
                      {item.sla.badge}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">{item.subtitle}</p>
                {actionables.isAdmin && item.ownerName && (
                  <p className="text-[11px] text-muted-foreground mt-0.5">{item.ownerName}</p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {item.leadId && (
                  <Button variant="ghost" size="sm" asChild>
                    <Link to={`/leads/${item.leadId}`} className="gap-1">
                      <ExternalLink className="h-3.5 w-3.5" />
                      Open
                    </Link>
                  </Button>
                )}
                <Button
                  size="sm"
                  className="gradient-primary gap-1"
                  disabled={!item.email || !item.leadId}
                  title={!item.email ? 'Add an email on the lead first' : 'Draft follow-up'}
                  onClick={() => openDraft(item)}
                >
                  <Mail className="h-3.5 w-3.5" />
                  Draft follow-up
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <AppLayout>
      <div className="space-y-8">
        <div className="animate-fade-in-up flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground tracking-tight">Alerts</h1>
            <p className="text-muted-foreground mt-1.5">
              {actionables.slaBreachCount > 0
                ? `${actionables.slaBreachCount} SLA breach${actionables.slaBreachCount === 1 ? '' : 'es'} need a follow-up`
                : 'No SLA breaches — nice.'}
            </p>
          </div>
        </div>

        <Tabs
          value={tab}
          onValueChange={(v) => {
            setTab(v);
            if (v === 'inbox') void loadInbox();
          }}
        >
          <TabsList>
            <TabsTrigger value="actionables" className="gap-1.5">
              <AlertTriangle className="h-4 w-4" />
              Actionables
              {actionables.count > 0 && (
                <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{actionables.count}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="inbox" className="gap-1.5">
              <Bell className="h-4 w-4" />
              Inbox
            </TabsTrigger>
          </TabsList>

          <TabsContent value="actionables" className="mt-6 space-y-5">
            <div className="flex flex-wrap gap-2">
              {([
                { id: 'breach' as const, label: 'SLA breached' },
                { id: 'soon' as const, label: 'Due soon' },
                { id: 'all' as const, label: actionables.isAdmin ? 'All team' : 'All mine' },
              ]).map((c) => (
                <Button
                  key={c.id}
                  size="sm"
                  variant={filter === c.id ? 'default' : 'outline'}
                  className={cn('h-8 rounded-full', filter === c.id && 'gradient-primary')}
                  onClick={() => setFilter(c.id)}
                >
                  {c.label}
                </Button>
              ))}
            </div>
            {actionables.isAdmin && (
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant={ownerFilter === 'all' ? 'default' : 'outline'}
                  className={cn('h-8 rounded-full', ownerFilter === 'all' && 'gradient-primary')}
                  onClick={() => setOwnerFilter('all')}
                >
                  All
                </Button>
                <Button
                  size="sm"
                  variant={ownerFilter === 'mine' ? 'default' : 'outline'}
                  className={cn('h-8 rounded-full', ownerFilter === 'mine' && 'gradient-primary')}
                  onClick={() => setOwnerFilter('mine')}
                >
                  Mine
                </Button>
                {actionables.owners.map((o) => (
                  <Button
                    key={o.id}
                    size="sm"
                    variant={ownerFilter === o.id ? 'default' : 'outline'}
                    className={cn('h-8 rounded-full', ownerFilter === o.id && 'gradient-primary')}
                    onClick={() => setOwnerFilter(o.id)}
                  >
                    {o.name}
                  </Button>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">Press Enter on a focused row to draft the follow-up.</p>

            {actionables.loading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
              </div>
            ) : filter === 'all' ? (
              <div className="space-y-8">
                {renderGroup('Needs you now', nowItems)}
                {renderGroup('Due soon', soonItems)}
              </div>
            ) : visible.length === 0 ? (
              <Card className="card-shadow rounded-xl">
                <CardContent className="py-12 text-center text-sm text-muted-foreground">
                  {filter === 'breach' ? 'No SLA breaches.' : 'No leads approaching SLA.'}
                </CardContent>
              </Card>
            ) : (
              renderGroup(filter === 'breach' ? 'Needs you now' : 'Due soon', visible)
            )}
          </TabsContent>

          <TabsContent value="inbox" className="mt-6">
            <Card className="card-shadow rounded-xl border-border/80">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg font-display">
                  <Bell className="h-5 w-5" />
                  Inbox
                </CardTitle>
                {unreadCount > 0 && (
                  <Button variant="outline" size="sm" onClick={markAllRead} className="gap-2">
                    <CheckCheck className="h-4 w-4" />
                    Mark all as read
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {inboxLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : notifications.length === 0 ? (
                  <p className="text-muted-foreground text-sm py-8 text-center">No notifications yet.</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {notifications.map((n) => (
                      <li key={n.id} className={`py-4 first:pt-0 ${!n.is_read ? 'bg-primary/5 -mx-2 px-2 rounded-lg' : ''}`}>
                        <div className="flex items-start justify-between gap-2">
                          <button className="min-w-0 flex-1 text-left" onClick={() => !n.is_read && markAsRead(n.id)}>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">{n.title}</span>
                              {!n.is_read && <Badge variant="secondary" className="text-xs">New</Badge>}
                            </div>
                            <p className="text-sm text-muted-foreground mt-0.5">{n.message}</p>
                            <p className="text-xs text-muted-foreground/80 mt-1">{safeFormat(n.created_at, 'PPp')}</p>
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
      <DraftFollowUpDialog
        open={draftOpen}
        onOpenChange={setDraftOpen}
        lead={draftLead}
        onSent={() => void actionables.refresh()}
      />
    </AppLayout>
  );
}
