import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LeadFormDialog } from '@/components/leads/LeadFormDialog';
import { AddActivityDialog } from '@/components/leads/AddActivityDialog';
import { TaskFormDialog } from '@/components/tasks/TaskFormDialog';
import { ArrowLeft, Phone, Mail, Calendar, FileText, User, Building2, Link as LinkIcon, Paperclip } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Lead } from '@/types/lead';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { safeFormat } from '@/lib/date';

const activityTypeConfig = {
  call: { icon: Phone, label: 'Call', color: 'bg-primary/10 text-primary' },
  email: { icon: Mail, label: 'Email', color: 'bg-accent/10 text-accent' },
  meeting: { icon: Calendar, label: 'Meeting', color: 'bg-success/10 text-success' },
  note: { icon: FileText, label: 'Note', color: 'bg-warning/10 text-warning' },
};

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
      .order('created_at', { ascending: false });
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
          <Button variant="outline" onClick={() => setEditOpen(true)}>
            Edit Lead
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-grid">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
            <TabsTrigger value="tasks">Tasks</TabsTrigger>
            <TabsTrigger value="followups">Follow-ups</TabsTrigger>
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
            />
          </TabsContent>

          <TabsContent value="tasks" className="mt-6">
            <LeadTasksTab
              leadId={id!}
              leadName={lead.company_name}
              tasks={tasks}
              onRefresh={fetchTasks}
              onAddTask={() => setTaskFormOpen(true)}
            />
          </TabsContent>

          <TabsContent value="followups" className="mt-6">
            <LeadFollowUpsTab leadId={id!} followUps={followUps} onRefresh={fetchFollowUps} />
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
          onSuccess={fetchTasks}
        />
      </div>
    </AppLayout>
  );
}

function LeadActivityTab({
  leadId,
  currentLeadScore,
  activities,
  onRefresh,
  onLeadUpdated,
}: {
  leadId: string;
  currentLeadScore: number;
  activities: LeadActivity[];
  onRefresh: () => void;
  onLeadUpdated: () => void;
}) {
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  return (
    <Card className="card-shadow">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Activity log</CardTitle>
        <Button size="sm" onClick={() => setAddDialogOpen(true)}>
          Add activity
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {activities.length === 0 ? (
            <p className="text-muted-foreground text-sm">No activities yet.</p>
          ) : (
            activities.map((a) => {
              const config = activityTypeConfig[a.activity_type as keyof typeof activityTypeConfig] ?? activityTypeConfig.note;
              const Icon = config.icon;
              const attachments = (a.attachments ?? []) as { type: 'url' | 'file'; url: string; name?: string }[];
              return (
                <div key={a.id} className="flex items-start gap-3">
                  <div className={cn('p-2 rounded-lg shrink-0', config.color)}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{a.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {a.profile?.full_name ?? 'Unknown'} • {safeFormat(a.created_at, 'PPp')}
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
                </div>
              );
            })
          )}
        </div>
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
  onAddTask,
}: {
  leadId: string;
  leadName: string;
  tasks: LeadTask[];
  onRefresh: () => void;
  onAddTask?: () => void;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const pending = tasks.filter((t) => !t.is_completed);
  const completed = tasks.filter((t) => t.is_completed);

  const toggleTask = async (taskId: string, is_completed: boolean) => {
    await supabase.from('tasks').update({ is_completed }).eq('id', taskId);
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
                  <div className="flex-1">
                    <p className="font-medium">{t.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {t.due_date ? safeFormat(t.due_date, 'PP') : 'No due date'} • {t.priority}
                    </p>
                  </div>
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
                  <div className="flex-1">
                    <p className="font-medium line-through">{t.title}</p>
                    <p className="text-xs text-muted-foreground">{t.priority}</p>
                  </div>
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
}: {
  leadId: string;
  followUps: LeadFollowUp[];
  onRefresh: () => void;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [scheduledAt, setScheduledAt] = useState('');
  const [reminderType, setReminderType] = useState<'one-time' | 'recurring'>('one-time');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const upcoming = followUps.filter((f) => !f.is_completed);
  const past = followUps.filter((f) => f.is_completed);

  const markDone = async (followUpId: string) => {
    await supabase.from('follow_ups').update({ is_completed: true }).eq('id', followUpId);
    onRefresh();
  };

  const scheduleFollowUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheduledAt) {
      toast({ variant: 'destructive', title: 'Select date and time' });
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from('follow_ups').insert({
      lead_id: leadId,
      user_id: user!.id,
      scheduled_at: new Date(scheduledAt).toISOString(),
      reminder_type: reminderType,
      notes: notes.trim() || null,
    });
    setSubmitting(false);
    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
      return;
    }
    toast({ title: 'Follow-up scheduled' });
    setScheduledAt('');
    setNotes('');
    onRefresh();
  };

  return (
    <Card className="card-shadow">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4">
        <CardTitle>Follow-ups</CardTitle>
        <form onSubmit={scheduleFollowUp} className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Date & time</label>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Type</label>
            <select
              value={reminderType}
              onChange={(e) => setReminderType(e.target.value as 'one-time' | 'recurring')}
              className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
            >
              <option value="one-time">One-time</option>
              <option value="recurring">Recurring</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Notes</label>
            <input
              type="text"
              placeholder="Notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm min-w-[120px]"
            />
          </div>
          <Button type="submit" size="sm" disabled={!scheduledAt || submitting}>
            Schedule
          </Button>
        </form>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {followUps.length === 0 ? (
            <p className="text-muted-foreground text-sm">No follow-ups scheduled. Use the form above to add one.</p>
          ) : (
            <>
              {upcoming.map((f) => (
                <div key={f.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                  <div>
                    <p className="font-medium">{safeFormat(f.scheduled_at, 'PPp')}</p>
                    <p className="text-xs text-muted-foreground">{f.reminder_type}</p>
                    {f.notes && <p className="text-sm text-muted-foreground mt-1">{f.notes}</p>}
                  </div>
                  <Button size="sm" variant="outline" onClick={() => markDone(f.id)}>
                    Mark done
                  </Button>
                </div>
              ))}
              {past.map((f) => (
                <div key={f.id} className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30 opacity-70">
                  <div>
                    <p className="font-medium line-through">{safeFormat(f.scheduled_at, 'PPp')}</p>
                    <p className="text-xs text-muted-foreground">{f.reminder_type}</p>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
