import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LeadFormDialog } from '@/components/leads/LeadFormDialog';
import { AddActivityDialog } from '@/components/leads/AddActivityDialog';
import { AddFollowUpDialog } from '@/components/leads/AddFollowUpDialog';
import { UploadDocumentDialog } from '@/components/leads/UploadDocumentDialog';
import { TaskFormDialog } from '@/components/tasks/TaskFormDialog';
import { ArrowLeft, Phone, Mail, Calendar, FileText, User, Building2, Link as LinkIcon, Paperclip, Trash2, FileUp, ExternalLink, Loader2, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Lead } from '@/types/lead';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { safeFormat } from '@/lib/date';
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

const activityTypeConfig = {
  call: { icon: Phone, label: 'Call', color: 'bg-primary/10 text-primary', score: 6 },
  email: { icon: Mail, label: 'Email', color: 'bg-accent/10 text-accent', score: 3 },
  meeting: { icon: Calendar, label: 'Meeting', color: 'bg-success/10 text-success', score: 5 },
  note: { icon: FileText, label: 'Note', color: 'bg-warning/10 text-warning', score: 2 },
};

/** Lead score points for activity types. Notes get score from description (Task/Follow-up/Lead updated). */
function getActivityScore(activity: LeadActivity): number {
  const config = activityTypeConfig[activity.activity_type as keyof typeof activityTypeConfig] ?? activityTypeConfig.note;
  if (activity.activity_type === 'note' && activity.description) {
    if (activity.description.startsWith('Task completed:') || activity.description.startsWith('Follow-up completed')) return 5;
    if (activity.description.startsWith('Task created:') || activity.description.startsWith('Task reopened:')) return 3;
    if (activity.description.startsWith('Lead updated:')) return 1;
  }
  return config.score;
}

interface LeadActivity {
  id: string;
  activity_type: string;
  description: string;
  created_at: string;
  user_id: string;
  profile?: { full_name: string | null };
  attachments?: { type: 'url' | 'file'; url: string; name?: string }[];
}

interface LeadTask {
  id: string;
  title: string;
  due_date: string | null;
  priority: string;
  is_completed: boolean;
}

interface LeadFollowUp {
  id: string;
  scheduled_at: string;
  reminder_type: string;
  notes: string | null;
  is_completed: boolean;
}

export default function LeadDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const { toast } = useToast();
  const [lead, setLead] = useState<Lead | null>(null);
  const [activities, setActivities] = useState<LeadActivity[]>([]);
  const [tasks, setTasks] = useState<LeadTask[]>([]);
  const [followUps, setFollowUps] = useState<LeadFollowUp[]>([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [ownerOptions, setOwnerOptions] = useState<{ id: string; full_name: string | null }[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isAdmin = role === 'admin';

  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      const { data: roles } = await supabase.from('user_roles').select('user_id');
      if (roles?.length) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', roles.map((r) => r.user_id));
        setOwnerOptions((profiles ?? []).map((p) => ({ id: p.user_id, full_name: p.full_name })));
      }
    })();
  }, [isAdmin]);

  const fetchLead = async () => {
    if (!id) return;
    const { data, error } = await supabase
      .from('leads')
      .select(`
        *,
        status:lead_statuses(name, color),
        country:countries(name, code)
      `)
      .eq('id', id)
      .single();

    if (error || !data) {
      toast({ variant: 'destructive', title: 'Error', description: 'Lead not found' });
      navigate('/leads');
      return;
    }
    setLead(data as unknown as Lead);
  };

  const fetchActivities = async () => {
    if (!id) return;
    const { data } = await supabase
      .from('lead_activities')
      .select('id, activity_type, description, created_at, user_id, attachments')
      .eq('lead_id', id)
      .order('created_at', { ascending: true });
    if (data?.length) {
      const userIds = [...new Set(data.map((a) => a.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', userIds);
      const profileMap = (profiles ?? []).reduce(
        (acc, p) => {
          acc[p.user_id] = p;
          return acc;
        },
        {} as Record<string, { full_name: string | null }>
      );
      setActivities(
        data.map((a) => ({
          ...a,
          profile: profileMap[a.user_id] ? { full_name: profileMap[a.user_id].full_name } : undefined,
        }))
      );
    } else {
      setActivities([]);
    }
  };

  const fetchTasks = async () => {
    if (!id) return;
    const { data } = await supabase
      .from('tasks')
      .select('id, title, due_date, priority, is_completed')
      .eq('lead_id', id)
      .order('due_date', { ascending: true });
    setTasks((data as LeadTask[]) ?? []);
  };

  const fetchFollowUps = async () => {
    if (!id) return;
    const { data } = await supabase
      .from('follow_ups')
      .select('id, scheduled_at, reminder_type, notes, is_completed')
      .eq('lead_id', id)
      .order('scheduled_at', { ascending: true });
    setFollowUps((data as LeadFollowUp[]) ?? []);
  };

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      await Promise.all([fetchLead(), fetchActivities(), fetchTasks(), fetchFollowUps()]);
      setLoading(false);
    })();
  }, [id]);

  const refreshAll = () => {
    fetchLead();
    fetchActivities();
    fetchTasks();
    fetchFollowUps();
  };

  const handleDelete = async () => {
    if (!id || !isAdmin) return;
    setDeleting(true);
    const { error } = await supabase.from('leads').delete().eq('id', id);
    setDeleting(false);
    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
      return;
    }
    toast({ title: 'Lead deleted', description: 'Lead has been removed successfully.' });
    navigate('/leads');
  };

  if (loading || !lead) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64 w-full" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/leads')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
                <Building2 className="h-6 w-6 text-muted-foreground" />
                {lead.company_name}
              </h1>
              <p className="text-muted-foreground mt-1">
                {lead.contact_name && `${lead.contact_name}`}
                {lead.status && (
                  <Badge
                    className="ml-2 border-0"
                    style={{ backgroundColor: lead.status.color, color: 'white' }}
                  >
                    {lead.status.name}
                  </Badge>
                )}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              Edit Lead
            </Button>
            {isAdmin && (
              <Button variant="outline" className="text-destructive hover:text-destructive" onClick={() => setDeleteDialogOpen(true)}>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            )}
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-6 lg:w-auto lg:inline-grid">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
            <TabsTrigger value="tasks">Tasks</TabsTrigger>
            <TabsTrigger value="followups">Follow-ups</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="notes">Notes</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6">
            <Card className="card-shadow">
              <CardHeader>
                <CardTitle>Lead information</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Company</p>
                  <p className="font-medium">{lead.company_name}</p>
                </div>
                {lead.website && (
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Website</p>
                    <a
                      href={lead.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-primary hover:underline"
                    >
                      {lead.website}
                    </a>
                  </div>
                )}
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium">{lead.email ?? '-'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Phone</p>
                  <p className="font-medium">{lead.phone ?? '-'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Contact</p>
                  <p className="font-medium">{lead.contact_name ?? '-'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Designation</p>
                  <p className="font-medium">{lead.contact_designation ?? '-'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Country</p>
                  <p className="font-medium">
                    {lead.country ? `${lead.country.name} (${lead.country.code})` : '-'}
                  </p>
                </div>
                {(lead as any).vendor_type && (
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Vendor Type</p>
                    <p className="font-medium capitalize">
                      {(lead as any).vendor_type?.replace('_', ' ') ?? '-'}
                    </p>
                  </div>
                )}
                {(lead as any).warehouse_available && (
                  <>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Warehouse Location</p>
                      <p className="font-medium">{(lead as any).warehouse_location ?? '-'}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Warehouse Price</p>
                      <p className="font-medium">
                        {(lead as any).warehouse_price 
                          ? `${(lead as any).warehouse_currency || 'USD'} ${parseFloat((lead as any).warehouse_price).toFixed(2)}`
                          : '-'}
                      </p>
                    </div>
                    {(lead as any).warehouse_notes && (
                      <div className="space-y-1 sm:col-span-2">
                        <p className="text-sm text-muted-foreground">Warehouse Notes</p>
                        <p className="font-medium">{(lead as any).warehouse_notes}</p>
                      </div>
                    )}
                  </>
                )}
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Lead score</p>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full gradient-primary"
                        style={{ width: `${lead.lead_score ?? 0}%` }}
                      />
                    </div>
                    <span className="font-medium">{lead.lead_score ?? 0}</span>
                  </div>
                </div>
                {isAdmin && (
                  <div className="space-y-1 sm:col-span-2">
                    <p className="text-sm text-muted-foreground">Owner</p>
                    <select
                      value={lead.owner_id ?? ''}
                      onChange={async (e) => {
                        const ownerId = e.target.value || null;
                        if (ownerId === (lead.owner_id ?? '')) return;
                        const previousName = lead.owner_id
                          ? (ownerOptions.find((o) => o.id === lead.owner_id)?.full_name ?? 'Unknown')
                          : 'Unassigned';
                        const newName = ownerId
                          ? (ownerOptions.find((o) => o.id === ownerId)?.full_name ?? 'Unknown')
                          : 'Unassigned';
                        const { error } = await supabase
                          .from('leads')
                          .update({ owner_id: ownerId })
                          .eq('id', lead.id);
                        if (error) {
                          toast({ variant: 'destructive', title: 'Error', description: error.message });
                          return;
                        }
                        await supabase.from('lead_activities').insert({
                          lead_id: lead.id,
                          user_id: user!.id,
                          activity_type: 'note',
                          description: `Lead reassigned from ${previousName} to ${newName}.`,
                        });
                        if (ownerId) {
                          await supabase.from('notifications').insert({
                            user_id: ownerId,
                            title: 'Lead assigned to you',
                            message: `${lead.company_name} has been assigned to you.`,
                            type: 'lead',
                          });
                        }
                        toast({ title: 'Owner updated' });
                        fetchLead();
                        fetchActivities();
                      }}
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                    >
                      <option value="">Unassigned</option>
                      {ownerOptions.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.full_name || o.id}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="space-y-1 sm:col-span-2">
                  <p className="text-sm text-muted-foreground">Last updated</p>
                  <p className="font-medium">{safeFormat(lead.updated_at, 'PPp')}</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="activity" className="mt-6">
            <LeadActivityTab
              leadId={id!}
              currentLeadScore={lead.lead_score ?? 50}
              activities={activities}
              onRefresh={fetchActivities}
              onLeadUpdated={fetchLead}
              isAdmin={isAdmin}
            />
          </TabsContent>

          <TabsContent value="tasks" className="mt-6">
            <LeadTasksTab
              leadId={id!}
              leadName={lead.company_name}
              tasks={tasks}
              onRefresh={fetchTasks}
              onActivityLogged={fetchActivities}
              onAddTask={() => setTaskFormOpen(true)}
            />
          </TabsContent>

          <TabsContent value="followups" className="mt-6">
            <LeadFollowUpsTab leadId={id!} followUps={followUps} onRefresh={fetchFollowUps} onActivityLogged={fetchActivities} />
          </TabsContent>

          <TabsContent value="documents" className="mt-6">
            <LeadDocumentsTab leadId={id!} />
          </TabsContent>

          <TabsContent value="notes" className="mt-6">
            <Card className="card-shadow">
              <CardHeader>
                <CardTitle>Notes</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {lead.updated_at && `Last updated ${safeFormat(lead.updated_at, 'PP')}`}
                </p>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground whitespace-pre-wrap">
                  {lead.notes || 'No notes yet. Edit the lead to add notes.'}
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <LeadFormDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          lead={lead}
          onSuccess={refreshAll}
        />
        <TaskFormDialog
          open={taskFormOpen}
          onOpenChange={setTaskFormOpen}
          defaultLeadId={id}
          onSuccess={() => {
            fetchTasks();
            fetchActivities();
          }}
        />
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                Delete lead?
              </AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete "<strong>{lead.company_name}</strong>" and all associated activities, tasks, follow-ups, and documents. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={deleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Deleting...
                  </>
                ) : (
                  'Delete permanently'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
}

const activityTypeFilterOptions = [
  { value: 'all', label: 'All' },
  { value: 'call', label: 'Call' },
  { value: 'email', label: 'Email' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'note', label: 'Note' },
] as const;

function LeadActivityTab({
  leadId,
  currentLeadScore,
  activities,
  onRefresh,
  onLeadUpdated,
  isAdmin,
}: {
  leadId: string;
  currentLeadScore: number;
  activities: LeadActivity[];
  onRefresh: () => void;
  onLeadUpdated: () => void;
  isAdmin?: boolean;
}) {
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const { toast } = useToast();

  const filteredActivities =
    typeFilter === 'all'
      ? activities
      : activities.filter((a) => a.activity_type === typeFilter);

  const handleDeleteActivity = async (activityId: string) => {
    const { error } = await supabase.from('lead_activities').delete().eq('id', activityId);
    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
      return;
    }
    toast({ title: 'Activity removed' });
    onRefresh();
  };

  return (
    <Card className="card-shadow">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <CardTitle>Activity log</CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
          >
            {activityTypeFilterOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <Button size="sm" onClick={() => setAddDialogOpen(true)}>
            Add activity
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {filteredActivities.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            {activities.length === 0 ? 'No activities yet.' : `No ${typeFilter} activities.`}
          </p>
        ) : (
          <div className="relative pl-6">
            {/* Timeline vertical line */}
            <div className="absolute left-[11px] top-2 bottom-2 w-px bg-border" />
            <div className="space-y-0">
              {filteredActivities.map((a) => {
                const config = activityTypeConfig[a.activity_type as keyof typeof activityTypeConfig] ?? activityTypeConfig.note;
                const Icon = config.icon;
                const attachments = (a.attachments ?? []) as { type: 'url' | 'file'; url: string; name?: string }[];
                return (
                  <div key={a.id} className="relative flex items-start gap-3 group pb-6 last:pb-0">
                    {/* Timeline dot */}
                    <div
                      className={cn(
                        'absolute left-0 z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-background shadow-sm',
                        config.color
                      )}
                    >
                      <Icon className="h-3 w-3" />
                    </div>
                    <div className="flex-1 min-w-0 pl-2">
                      <div className="rounded-lg border bg-card p-3 shadow-sm transition-shadow hover:shadow-md">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-foreground">{a.description}</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {a.profile?.full_name ?? 'Unknown'} · {safeFormat(a.created_at, 'PPp')}
                            </p>
                            {attachments.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-2">
                                {attachments.map((att, i) => {
                                  let label = att.name ?? (att.type === 'file' ? 'Attachment' : 'Link');
                                  if (att.type === 'url' && !att.name) {
                                    try { label = new URL(att.url).hostname; } catch { /* keep Link */ }
                                  }
                                  return (
                                    <a
                                      key={i}
                                      href={att.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                                    >
                                      {att.type === 'file' ? <Paperclip className="h-3 w-3" /> : <LinkIcon className="h-3 w-3" />}
                                      {label}
                                    </a>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge variant="secondary" className="font-semibold tabular-nums text-success border-success/30 bg-success/10">
                              +{getActivityScore(a)}
                            </Badge>
                            {isAdmin && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 shrink-0 opacity-70 hover:opacity-100 hover:text-destructive"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteActivity(a.id);
                                }}
                                title="Delete activity"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
      <AddActivityDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        leadId={leadId}
        currentLeadScore={currentLeadScore}
        onSuccess={() => {
          onRefresh();
          onLeadUpdated();
        }}
      />
    </Card>
  );
}

function LeadTasksTab({
  leadId,
  leadName,
  tasks,
  onRefresh,
  onActivityLogged,
  onAddTask,
}: {
  leadId: string;
  leadName: string;
  tasks: LeadTask[];
  onRefresh: () => void;
  onActivityLogged?: () => void;
  onAddTask?: () => void;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const pending = tasks.filter((t) => !t.is_completed);
  const completed = tasks.filter((t) => t.is_completed);

  const toggleTask = async (taskId: string, is_completed: boolean) => {
    const task = tasks.find((t) => t.id === taskId);
    const { error } = await supabase.from('tasks').update({ is_completed }).eq('id', taskId);
    if (!error && task && user?.id && leadId) {
      await supabase.from('lead_activities').insert({
        lead_id: leadId,
        user_id: user.id,
        activity_type: 'note',
        description: is_completed ? `Task completed: ${task.title}` : `Task reopened: ${task.title}`,
      });
      onActivityLogged?.();
    }
    onRefresh();
  };

  return (
    <Card className="card-shadow">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Tasks for this lead</CardTitle>
        {onAddTask && (
          <Button size="sm" className="gap-2 gradient-primary" onClick={onAddTask}>
            Add task
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {tasks.length === 0 ? (
            <p className="text-muted-foreground text-sm">No tasks linked. Create one from My Tasks and link to this lead.</p>
          ) : (
            <>
              {pending.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center gap-3 p-3 rounded-lg border bg-card"
                >
                  <input
                    type="checkbox"
                    checked={false}
                    onChange={() => toggleTask(t.id, true)}
                    className="rounded"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{t.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {t.due_date ? safeFormat(t.due_date, 'PP') : 'No due date'} • {t.priority}
                    </p>
                  </div>
                  <Badge variant="secondary" className="shrink-0 font-semibold tabular-nums text-success border-success/30 bg-success/10">
                    +3
                  </Badge>
                </div>
              ))}
              {completed.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30 opacity-70"
                >
                  <input
                    type="checkbox"
                    checked
                    onChange={() => toggleTask(t.id, false)}
                    className="rounded"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium line-through">{t.title}</p>
                    <p className="text-xs text-muted-foreground">{t.priority}</p>
                  </div>
                  <Badge variant="secondary" className="shrink-0 font-semibold tabular-nums text-success border-success/30 bg-success/10">
                    +5
                  </Badge>
                </div>
              ))}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function LeadFollowUpsTab({
  leadId,
  followUps,
  onRefresh,
  onActivityLogged,
}: {
  leadId: string;
  followUps: LeadFollowUp[];
  onRefresh: () => void;
  onActivityLogged?: () => void;
}) {
  const { user } = useAuth();
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  const upcoming = followUps.filter((f) => !f.is_completed);
  const past = followUps.filter((f) => f.is_completed);

  const markDone = async (followUpId: string) => {
    const fu = followUps.find((f) => f.id === followUpId);
    const { error } = await supabase.from('follow_ups').update({ is_completed: true }).eq('id', followUpId);
    if (!error && fu && user?.id) {
      await supabase.from('lead_activities').insert({
        lead_id: leadId,
        user_id: user.id,
        activity_type: 'note',
        description: `Follow-up completed (scheduled for ${safeFormat(fu.scheduled_at, 'PPp')})`,
      });
      onActivityLogged?.();
    }
    onRefresh();
  };

  return (
    <Card className="card-shadow">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Follow-ups</CardTitle>
        <Button size="sm" onClick={() => setAddDialogOpen(true)}>
          Schedule follow-up
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {followUps.length === 0 ? (
            <p className="text-muted-foreground text-sm">No follow-ups scheduled. Schedule one using the button above.</p>
          ) : (
            <>
              {upcoming.map((f) => (
                <div key={f.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border bg-card">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{safeFormat(f.scheduled_at, 'PPp')}</p>
                    <p className="text-xs text-muted-foreground">{f.reminder_type}</p>
                    {f.notes && <p className="text-sm text-muted-foreground mt-1">{f.notes}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="secondary" className="font-semibold tabular-nums text-success border-success/30 bg-success/10">
                      +2
                    </Badge>
                    <Button size="sm" variant="outline" onClick={() => markDone(f.id)}>
                      Mark done
                    </Button>
                  </div>
                </div>
              ))}
              {past.map((f) => (
                <div key={f.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border bg-muted/30 opacity-70">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium line-through">{safeFormat(f.scheduled_at, 'PPp')}</p>
                    <p className="text-xs text-muted-foreground">{f.reminder_type}</p>
                  </div>
                  <Badge variant="secondary" className="shrink-0 font-semibold tabular-nums text-success border-success/30 bg-success/10">
                    +5
                  </Badge>
                </div>
              ))}
            </>
          )}
        </div>
      </CardContent>
      <AddFollowUpDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        leadId={leadId}
        onSuccess={() => {
          onRefresh();
          onActivityLogged?.();
        }}
      />
    </Card>
  );
}

interface LeadDocumentRow {
  id: string;
  lead_id: string;
  document_type: string;
  custom_name: string | null;
  file_path: string;
  file_name: string;
  file_size: number | null;
  uploaded_at: string;
  uploaded_by: string;
}

const DOCUMENT_TYPE_OPTIONS = [
  { value: 'nda', label: 'NDA' },
  { value: 'pricing', label: 'Pricing' },
  { value: 'custom', label: 'Custom' },
] as const;

function LeadDocumentsTab({ leadId }: { leadId: string }) {
  const { toast } = useToast();
  const [documents, setDocuments] = useState<LeadDocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);

  const fetchDocuments = async () => {
    const { data, error } = await supabase
      .from('lead_documents')
      .select('id, lead_id, document_type, custom_name, file_path, file_name, file_size, uploaded_at, uploaded_by')
      .eq('lead_id', leadId)
      .order('uploaded_at', { ascending: false });
    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
      setDocuments([]);
    } else {
      setDocuments((data as LeadDocumentRow[]) ?? []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchDocuments();
  }, [leadId]);

  const handleView = async (doc: LeadDocumentRow) => {
    const { data, error } = await supabase.storage.from('lead-documents').createSignedUrl(doc.file_path, 60);
    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
      return;
    }
    window.open(data.signedUrl, '_blank', 'noopener');
  };

  const displayName = (doc: LeadDocumentRow) => {
    if (doc.document_type === 'custom' && doc.custom_name) return doc.custom_name;
    return DOCUMENT_TYPE_OPTIONS.find((o) => o.value === doc.document_type)?.label ?? doc.document_type;
  };

  return (
    <Card className="card-shadow">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <FileUp className="h-5 w-5" />
          Documents
        </CardTitle>
        <Button size="sm" onClick={() => setUploadDialogOpen(true)}>
          Upload document
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-muted-foreground text-sm">Loading documents...</p>
        ) : documents.length === 0 ? (
          <p className="text-muted-foreground text-sm">No documents yet. Upload an NDA, Pricing, or custom document using the button above.</p>
        ) : (
          <ul className="divide-y divide-border">
            {documents.map((doc) => (
              <li key={doc.id} className="py-3 first:pt-0 flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium">{displayName(doc)}</p>
                  <p className="text-xs text-muted-foreground">
                    {doc.file_name}
                    {doc.file_size != null && ` · ${(doc.file_size / 1024).toFixed(1)} KB`}
                    {' · '}
                    {safeFormat(doc.uploaded_at, 'PPp')}
                  </p>
                </div>
                <Button variant="outline" size="sm" className="gap-1" onClick={() => handleView(doc)}>
                  <ExternalLink className="h-3 w-3" />
                  View
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      <UploadDocumentDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        leadId={leadId}
        onSuccess={fetchDocuments}
      />
    </Card>
  );
}
