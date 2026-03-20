import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { safeFormat } from '@/lib/date';
import { cn } from '@/lib/utils';
import { AddFollowUpDialog } from '@/components/leads/AddFollowUpDialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Calendar,
  Check,
  AlertCircle,
  Plus,
  List,
  LayoutGrid,
  Clock,
  RefreshCw,
  Trash2,
  ExternalLink,
} from 'lucide-react';
import { isBefore, isAfter, startOfDay, endOfDay, isWithinInterval } from 'date-fns';

interface FollowUpRow {
  id: string;
  lead_id: string;
  user_id: string;
  scheduled_at: string;
  reminder_type: string;
  notes: string | null;
  is_completed: boolean;
  created_at: string;
  lead?: { company_name: string } | null;
  profile?: { full_name: string | null } | null;
}

type DueFilter = 'all' | 'overdue' | 'today' | 'week';
type TypeFilter = 'all' | 'one-time' | 'recurring';

export default function FollowUps() {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [followUps, setFollowUps] = useState<FollowUpRow[]>([]);
  const [leads, setLeads] = useState<{ id: string; company_name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<FollowUpRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [filters, setFilters] = useState<{
    due: DueFilter;
    type: TypeFilter;
    lead_id: string;
  }>({ due: 'all', type: 'all', lead_id: 'all' });

  const fetchFollowUps = async () => {
    if (!user) return;
    const query = supabase
      .from('follow_ups')
      .select(`id, lead_id, user_id, scheduled_at, reminder_type, notes, is_completed, created_at, lead:leads(company_name)`)
      .order('scheduled_at', { ascending: true });
    if (!isAdmin) query.eq('user_id', user.id);
    const { data, error } = await query;
    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
      setLoading(false);
      return;
    }
    let list = (data as FollowUpRow[]) ?? [];
    if (isAdmin && list.length > 0) {
      const userIds = [...new Set(list.map((f) => f.user_id))];
      const { data: profiles } = await supabase.from('profiles').select('user_id, full_name').in('user_id', userIds);
      const profileMap = (profiles ?? []).reduce((acc, p) => { acc[p.user_id] = { full_name: p.full_name }; return acc; }, {} as Record<string, { full_name: string | null }>);
      list = list.map((f) => ({ ...f, profile: profileMap[f.user_id] ?? null }));
    }
    setFollowUps(list);
    setLoading(false);
  };

  useEffect(() => {
    if (user) {
      fetchFollowUps();
      const leadsQuery = supabase.from('leads').select('id, company_name').order('company_name');
      if (!isAdmin) leadsQuery.eq('owner_id', user.id);
      leadsQuery.then(({ data }) => setLeads(data ?? []));
    }
  }, [user?.id, isAdmin]);

  const markDone = async (fu: FollowUpRow) => {
    const { error } = await supabase.from('follow_ups').update({ is_completed: true }).eq('id', fu.id);
    if (error) { toast({ variant: 'destructive', title: 'Error', description: error.message }); return; }
    await supabase.from('lead_activities').insert({
      lead_id: fu.lead_id,
      user_id: user!.id,
      activity_type: 'note',
      description: `Follow-up completed (scheduled for ${safeFormat(fu.scheduled_at, 'PPp')})`,
    });
    toast({ title: 'Marked as done' });
    setFollowUps((prev) => prev.map((f) => (f.id === fu.id ? { ...f, is_completed: true } : f)));
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase.from('follow_ups').delete().eq('id', deleteTarget.id);
    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } else {
      toast({ title: 'Follow-up deleted' });
      setFollowUps((prev) => prev.filter((f) => f.id !== deleteTarget.id));
    }
    setDeleting(false);
    setDeleteTarget(null);
  };

  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const weekEnd = endOfDay(new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000));

  const applyFilters = (list: FollowUpRow[]) => {
    let out = list;
    if (filters.due === 'overdue') out = out.filter((f) => !f.is_completed && isBefore(new Date(f.scheduled_at), todayStart));
    else if (filters.due === 'today') out = out.filter((f) => isWithinInterval(new Date(f.scheduled_at), { start: todayStart, end: todayEnd }));
    else if (filters.due === 'week') out = out.filter((f) => isWithinInterval(new Date(f.scheduled_at), { start: todayStart, end: weekEnd }));
    if (filters.type !== 'all') out = out.filter((f) => f.reminder_type === filters.type);
    if (filters.lead_id !== 'all') out = out.filter((f) => f.lead_id === filters.lead_id);
    return out;
  };

  const filtered = applyFilters(followUps);
  const overdue = filtered.filter((f) => !f.is_completed && isBefore(new Date(f.scheduled_at), now));
  const upcoming = filtered.filter((f) => !f.is_completed && !isBefore(new Date(f.scheduled_at), now));
  const completed = filtered.filter((f) => f.is_completed);

  return (
    <AppLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="animate-fade-in-up flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground tracking-tight">Follow-ups</h1>
            <p className="text-muted-foreground mt-1.5">
              {isAdmin ? 'All team follow-ups' : 'Your scheduled lead follow-ups'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setViewMode('list')} className={cn(viewMode === 'list' && 'bg-muted')} title="List view">
              <List className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={() => setViewMode('kanban')} className={cn(viewMode === 'kanban' && 'bg-muted')} title="Kanban view">
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button className="gap-2 gradient-primary" onClick={() => setScheduleOpen(true)}>
              <Plus className="h-4 w-4" />
              Schedule follow-up
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card className="card-shadow rounded-xl border-border/80">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-4">
              <Select value={filters.due} onValueChange={(v) => setFilters((f) => ({ ...f, due: v as DueFilter }))}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Due" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All dates</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">This week</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filters.type} onValueChange={(v) => setFilters((f) => ({ ...f, type: v as TypeFilter }))}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  <SelectItem value="one-time">One-time</SelectItem>
                  <SelectItem value="recurring">Recurring</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filters.lead_id} onValueChange={(v) => setFilters((f) => ({ ...f, lead_id: v }))}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Lead" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All leads</SelectItem>
                  {leads.map((l) => (
                    <SelectItem key={l.id} value={l.id}>{l.company_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="ml-auto flex items-center gap-3 text-sm text-muted-foreground">
                {overdue.length > 0 && (
                  <span className="flex items-center gap-1 text-destructive font-medium">
                    <AlertCircle className="h-3.5 w-3.5" />
                    {overdue.length} overdue
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {upcoming.length} upcoming
                </span>
                <span className="flex items-center gap-1">
                  <Check className="h-3.5 w-3.5" />
                  {completed.length} done
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <Skeleton className="h-64 w-full rounded-xl" />
        ) : viewMode === 'kanban' ? (
          /* ── Kanban view ── */
          <div className="grid gap-6 md:grid-cols-3">
            {/* Overdue */}
            <Card className="card-shadow rounded-xl border-destructive/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  Overdue
                  <Badge variant="destructive" className="ml-auto">{overdue.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 min-h-[120px]">
                  {overdue.length === 0 ? (
                    <p className="text-muted-foreground text-sm">No overdue follow-ups</p>
                  ) : overdue.map((f) => (
                    <FollowUpCard key={f.id} fu={f} onMarkDone={markDone} onNavigate={(id) => navigate(`/leads/${id}`)} onDelete={setDeleteTarget} isAdmin={!!isAdmin} />
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Upcoming */}
            <Card className="card-shadow rounded-xl border-border/80">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" />
                  Upcoming
                  <Badge variant="secondary" className="ml-auto">{upcoming.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 min-h-[120px]">
                  {upcoming.length === 0 ? (
                    <p className="text-muted-foreground text-sm">No upcoming follow-ups</p>
                  ) : upcoming.map((f) => (
                    <FollowUpCard key={f.id} fu={f} onMarkDone={markDone} onNavigate={(id) => navigate(`/leads/${id}`)} onDelete={setDeleteTarget} isAdmin={!!isAdmin} />
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Completed */}
            <Card className="card-shadow rounded-xl border-border/80 opacity-80">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-success" />
                  Completed
                  <Badge variant="secondary" className="ml-auto">{completed.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 min-h-[120px]">
                  {completed.length === 0 ? (
                    <p className="text-muted-foreground text-sm">No completed follow-ups</p>
                  ) : completed.map((f) => (
                    <FollowUpCard key={f.id} fu={f} onMarkDone={markDone} onNavigate={(id) => navigate(`/leads/${id}`)} onDelete={setDeleteTarget} isAdmin={!!isAdmin} />
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          /* ── List view ── */
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Active (overdue + upcoming) */}
            <Card className="card-shadow rounded-xl border-border/80">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Active
                  <Badge variant="secondary">{overdue.length + upcoming.length}</Badge>
                  {overdue.length > 0 && (
                    <Badge variant="destructive" className="gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {overdue.length} overdue
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {overdue.length + upcoming.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8 text-sm">No active follow-ups. You're all caught up!</p>
                ) : (
                  <div className="space-y-2">
                    {[...overdue, ...upcoming].map((f) => (
                      <FollowUpItem key={f.id} fu={f} onMarkDone={markDone} onNavigate={(id) => navigate(`/leads/${id}`)} onDelete={setDeleteTarget} isAdmin={!!isAdmin} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Completed */}
            <Card className="card-shadow rounded-xl border-border/80">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Completed
                  <Badge variant="secondary">{completed.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {completed.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8 text-sm">No completed follow-ups yet.</p>
                ) : (
                  <div className="space-y-2">
                    {completed.map((f) => (
                      <FollowUpItem key={f.id} fu={f} onMarkDone={markDone} onNavigate={(id) => navigate(`/leads/${id}`)} onDelete={setDeleteTarget} isAdmin={!!isAdmin} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        <AddFollowUpDialog
          open={scheduleOpen}
          onOpenChange={setScheduleOpen}
          onSuccess={fetchFollowUps}
          leads={leads}
        />

        <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete follow-up?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete the follow-up scheduled for{' '}
                <strong>{deleteTarget ? safeFormat(deleteTarget.scheduled_at, 'PPp') : ''}</strong>
                {deleteTarget?.lead?.company_name ? ` for ${deleteTarget.lead.company_name}` : ''}.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={deleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
}

function FollowUpItem({
  fu,
  onMarkDone,
  onNavigate,
  onDelete,
  isAdmin,
}: {
  fu: FollowUpRow;
  onMarkDone: (fu: FollowUpRow) => void;
  onNavigate: (leadId: string) => void;
  onDelete: (fu: FollowUpRow) => void;
  isAdmin: boolean;
}) {
  const now = new Date();
  const isOverdue = !fu.is_completed && isBefore(new Date(fu.scheduled_at), now);

  return (
    <div
      className={cn(
        'flex items-start gap-3 p-3 rounded-lg border transition-all',
        fu.is_completed ? 'bg-muted/30 opacity-60' : isOverdue ? 'bg-destructive/5 border-destructive/30 hover:shadow-sm' : 'bg-card hover:shadow-sm'
      )}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => onNavigate(fu.lead_id)}
            className="font-medium text-primary hover:underline text-sm text-left"
          >
            {fu.lead?.company_name ?? 'Unknown lead'}
          </button>
          {isAdmin && fu.profile?.full_name && (
            <Badge variant="outline" className="text-xs">{fu.profile.full_name}</Badge>
          )}
        </div>
        <p className={cn('text-xs mt-0.5', isOverdue ? 'text-destructive font-medium' : 'text-muted-foreground')}>
          {safeFormat(fu.scheduled_at, 'PPp')}
          {fu.notes && ` · ${fu.notes}`}
        </p>
        <div className="flex gap-1.5 mt-1.5 flex-wrap">
          <Badge variant="outline" className="text-xs capitalize">
            {fu.reminder_type === 'recurring' ? <RefreshCw className="h-2.5 w-2.5 mr-1" /> : null}
            {fu.reminder_type}
          </Badge>
          {isOverdue && (
            <Badge variant="destructive" className="text-xs gap-1">
              <AlertCircle className="h-3 w-3" />
              Overdue
            </Badge>
          )}
          {fu.is_completed && (
            <Badge variant="secondary" className="text-xs gap-1">
              <Check className="h-3 w-3" />
              Done
            </Badge>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => onNavigate(fu.lead_id)} title="View lead">
          <ExternalLink className="h-3.5 w-3.5" />
        </Button>
        {!fu.is_completed && (
          <Button variant="outline" size="sm" onClick={() => onMarkDone(fu)} className="text-xs h-7">
            Mark done
          </Button>
        )}
        {(isAdmin || !fu.is_completed) && (
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => onDelete(fu)} title="Delete">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

function FollowUpCard({
  fu,
  onMarkDone,
  onNavigate,
  onDelete,
  isAdmin,
}: {
  fu: FollowUpRow;
  onMarkDone: (fu: FollowUpRow) => void;
  onNavigate: (leadId: string) => void;
  onDelete: (fu: FollowUpRow) => void;
  isAdmin: boolean;
}) {
  const now = new Date();
  const isOverdue = !fu.is_completed && isBefore(new Date(fu.scheduled_at), now);

  return (
    <div
      className={cn(
        'p-3 rounded-lg border transition-all',
        fu.is_completed ? 'bg-muted/30 opacity-70' : isOverdue ? 'bg-destructive/5 border-destructive/30' : 'bg-card hover:shadow-sm'
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <button
          type="button"
          onClick={() => onNavigate(fu.lead_id)}
          className="font-medium text-primary hover:underline text-sm text-left leading-tight"
        >
          {fu.lead?.company_name ?? 'Unknown lead'}
        </button>
        <div className="flex items-center gap-1 shrink-0">
          <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => onDelete(fu)} title="Delete">
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
      {fu.notes && (
        <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{fu.notes}</p>
      )}
      <p className={cn('text-xs mb-2', isOverdue ? 'text-destructive font-medium' : 'text-muted-foreground')}>
        {safeFormat(fu.scheduled_at, 'MMM d, h:mm a')}
      </p>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex gap-1 flex-wrap">
          <Badge variant="outline" className="text-xs capitalize">
            {fu.reminder_type === 'recurring' ? <RefreshCw className="h-2.5 w-2.5 mr-1" /> : null}
            {fu.reminder_type}
          </Badge>
          {isAdmin && fu.profile?.full_name && (
            <Badge variant="outline" className="text-xs">{fu.profile.full_name}</Badge>
          )}
        </div>
        {!fu.is_completed && (
          <Button variant="outline" size="sm" className="text-xs h-6 px-2" onClick={() => onMarkDone(fu)}>
            <Check className="h-3 w-3 mr-1" />
            Done
          </Button>
        )}
        {fu.is_completed && (
          <Badge variant="secondary" className="text-xs gap-1">
            <Check className="h-3 w-3" />
            Completed
          </Badge>
        )}
      </div>
    </div>
  );
}
