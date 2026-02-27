import { useState, useEffect, useRef } from 'react';
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
import { ArrowLeft, Phone, Mail, Calendar, FileText, User, Building2, Link as LinkIcon, Paperclip, Trash2, FileUp, ExternalLink, Loader2, AlertTriangle, MessageCircle, ShieldCheck, Linkedin, Pencil, Check, X, Video, ChevronDown, Clock, Users } from 'lucide-react';
import { MeetingActivityCard, hasMeetingData, extractMeetingMeta } from '@/components/leads/MeetingActivityCard';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Lead } from '@/types/lead';
import { useToast } from '@/hooks/use-toast';
import { MoveCommentDialog, getTransitionMode, type TransitionMode, type StageTransitionResult } from '@/components/pipeline/MoveCommentDialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { safeFormat } from '@/lib/date';
import { useSyncGoogleMeetingActivities } from '@/hooks/useSyncGoogleMeetingActivities';
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
  whatsapp: { icon: MessageCircle, label: 'WhatsApp', color: 'bg-green-500/10 text-green-600', score: 5 },
  linkedin: { icon: Linkedin, label: 'LinkedIn', color: 'bg-sky-500/10 text-sky-600', score: 4 },
  nda: { icon: ShieldCheck, label: 'NDA', color: 'bg-blue-500/10 text-blue-600', score: 8 },
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
  google_calendar_event_id?: string | null;
  profile?: { full_name: string | null };
  attachments?: { type: string; url: string; name?: string }[];
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
  const [statusOptions, setStatusOptions] = useState<{ id: string; name: string; color: string }[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [changingStatus, setChangingStatus] = useState(false);
  const googleSyncDoneRef = useRef<string | null>(null);
  const { syncActivities } = useSyncGoogleMeetingActivities();

  const [pendingStageMove, setPendingStageMove] = useState<{
    newStatusId: string | null;
    fromStatusName: string;
    toStatusName: string;
    transitionMode: TransitionMode;
  } | null>(null);
  const [stageSubmitting, setStageSubmitting] = useState(false);

  const isAdmin = role === 'admin';
  const isOwner = lead?.owner_id === user?.id;
  const canEdit = isAdmin || isOwner;

  useEffect(() => {
    // Fetch statuses for all users
    (async () => {
      const { data } = await supabase.from('lead_statuses').select('id, name, color, sort_order').order('sort_order');
      if (data) setStatusOptions(data);
    })();

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
      .select('id, activity_type, description, created_at, user_id, attachments, google_calendar_event_id')
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
    googleSyncDoneRef.current = null;
    (async () => {
      setLoading(true);
      await Promise.all([fetchLead(), fetchActivities(), fetchTasks(), fetchFollowUps()]);
      setLoading(false);
    })();
  }, [id]);

  // When activities load, sync Google Calendar event info for any with google_calendar_event_id so the activity log displays meeting details
  useEffect(() => {
    if (!id || activities.length === 0) return;
    const needSync = activities.some(
      (a) =>
        a.google_calendar_event_id &&
        !hasMeetingData((a.attachments ?? []) as { type: string; url: string; name?: string }[])
    );
    if (!needSync || googleSyncDoneRef.current === id) return;
    googleSyncDoneRef.current = id;
    syncActivities(activities, () => fetchActivities());
  }, [id, activities, syncActivities]);

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
            {canEdit && (
              <Button variant="outline" onClick={() => setEditOpen(true)}>
                Edit Lead
              </Button>
            )}
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
                {Array.isArray(lead.additional_contacts) && lead.additional_contacts.length > 0 && (
                  <div className="space-y-2 sm:col-span-2">
                    <p className="text-sm text-muted-foreground">Additional Contacts</p>
                    <div className="space-y-2">
                      {lead.additional_contacts.map((c: any, idx: number) => (
                        <div key={idx} className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md border border-border/50 bg-muted/20 px-3 py-2 text-sm">
                          {c.name && <span className="font-medium">{c.name}</span>}
                          {c.designation && <span className="text-muted-foreground">({c.designation})</span>}
                          {c.email && <span className="text-muted-foreground">{c.email}</span>}
                          {c.phone && <span className="text-muted-foreground">{c.phone}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Country</p>
                  <p className="font-medium">
                    {lead.country ? `${lead.country.name} (${lead.country.code})` : '-'}
                  </p>
                </div>
                {((lead as any).vendor_types?.length > 0 || (lead as any).vendor_type) && (
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Vendor Type</p>
                    <p className="font-medium capitalize">
                      {Array.isArray((lead as any).vendor_types) && (lead as any).vendor_types.length > 0
                        ? (lead as any).vendor_types.map((t: string) => t.replace('_', ' ')).join(', ')
                        : (lead as any).vendor_type?.replace('_', ' ') ?? '-'}
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
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Lead Stage</p>
                  <div className="flex items-center gap-2">
                    {lead.status && (
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: lead.status.color }}
                      />
                    )}
                    <select
                      value={lead.status_id ?? ''}
                      disabled={changingStatus || !canEdit}
                      onChange={async (e) => {
                        const newStatusId = e.target.value || null;
                        if (newStatusId === (lead.status_id ?? '')) return;

                        const fromStatus = statusOptions.find((s) => s.id === lead.status_id);
                        const toStatus = statusOptions.find((s) => s.id === newStatusId);

                        const WON_PATTERNS = ['won', 'closed won', 'closed-won'];
                        if (toStatus && WON_PATTERNS.includes(toStatus.name.toLowerCase())) {
                          const missing: string[] = [];
                          if (!lead.contact_name) missing.push('Contact Name');
                          if (!lead.contact_designation) missing.push('Designation');
                          if (!lead.phone) missing.push('Phone');
                          if (!lead.email) missing.push('Email');
                          if (!lead.website) missing.push('Website');
                          if (missing.length > 0) {
                            toast({ variant: 'destructive', title: 'Cannot move to Closed Won', description: `Missing required fields: ${missing.join(', ')}. Edit the lead to fill these in.` });
                            e.target.value = lead.status_id ?? '';
                            return;
                          }

                          const { data: ndaActivities } = await supabase
                            .from('lead_activities')
                            .select('id')
                            .eq('lead_id', lead.id)
                            .eq('activity_type', 'nda')
                            .ilike('description', '%nda received%')
                            .limit(1);

                          if (!ndaActivities || ndaActivities.length === 0) {
                            toast({
                              variant: 'destructive',
                              title: 'Cannot move to Won',
                              description: 'A signed NDA (NDA Received) activity must be logged before moving to Won stage.',
                            });
                            e.target.value = lead.status_id ?? '';
                            return;
                          }
                        }

                        const transitionMode = toStatus ? getTransitionMode(toStatus.name) : 'comment_only' as TransitionMode;

                        setPendingStageMove({
                          newStatusId,
                          fromStatusName: fromStatus?.name ?? 'Unassigned',
                          toStatusName: toStatus?.name ?? 'Unassigned',
                          transitionMode,
                        });
                      }}
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                    >
                      <option value="">Unassigned</option>
                      {statusOptions.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
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
              canEdit={canEdit}
              leadEmail={lead.email}
              leadContactName={lead.contact_name}
              leadCompanyName={lead.company_name}
              leadPhone={lead.phone}
              leadStatusName={lead.status?.name ?? null}
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
              canEdit={canEdit}
            />
          </TabsContent>

          <TabsContent value="followups" className="mt-6">
            <LeadFollowUpsTab leadId={id!} followUps={followUps} onRefresh={fetchFollowUps} onActivityLogged={fetchActivities} canEdit={canEdit} leadCompanyName={lead.company_name} leadContactName={lead.contact_name} leadEmail={lead.email} />
          </TabsContent>

          <TabsContent value="documents" className="mt-6">
            <LeadDocumentsTab leadId={id!} isAdmin={isAdmin} canEdit={canEdit} />
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
        <MoveCommentDialog
          open={!!pendingStageMove}
          leadName={lead.company_name}
          fromStatus={pendingStageMove?.fromStatusName ?? ''}
          toStatus={pendingStageMove?.toStatusName ?? ''}
          transitionMode={pendingStageMove?.transitionMode ?? 'comment_only'}
          submitting={stageSubmitting}
          onCancel={() => {
            setPendingStageMove(null);
            fetchLead();
          }}
          onConfirm={async (result: StageTransitionResult) => {
            if (!pendingStageMove || !user) return;
            setStageSubmitting(true);

            const { newStatusId, fromStatusName, toStatusName } = pendingStageMove;

            const { error } = await supabase
              .from('leads')
              .update({ status_id: newStatusId })
              .eq('id', lead.id);

            if (error) {
              toast({ variant: 'destructive', title: 'Error', description: error.message });
              setStageSubmitting(false);
              setPendingStageMove(null);
              return;
            }

            const stageChangeDesc = result.activityType === 'note'
              ? `Lead stage changed from "${fromStatusName}" to "${toStatusName}" — ${result.comment}`
              : `Lead stage changed from "${fromStatusName}" to "${toStatusName}"`;

            await supabase.from('lead_activities').insert({
              lead_id: lead.id,
              user_id: user.id,
              activity_type: 'note',
              description: stageChangeDesc,
            });

            if (result.activityType !== 'note') {
              const activityDesc = result.ndaSubActivity === 'nda_sent'
                ? `NDA Sent${result.comment ? ': ' + result.comment : ''}`
                : result.comment;

              await supabase.from('lead_activities').insert({
                lead_id: lead.id,
                user_id: user.id,
                activity_type: result.activityType,
                description: activityDesc,
              });
            }

            toast({ title: 'Stage updated', description: `${lead.company_name} → ${toStatusName}` });
            setStageSubmitting(false);
            setPendingStageMove(null);
            fetchLead();
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
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'nda', label: 'NDA' },
  { value: 'note', label: 'Note' },
] as const;

function LeadActivityTab({
  leadId,
  currentLeadScore,
  activities,
  onRefresh,
  onLeadUpdated,
  isAdmin,
  canEdit,
  leadEmail,
  leadContactName,
  leadCompanyName,
  leadPhone,
  leadStatusName,
}: {
  leadId: string;
  currentLeadScore: number;
  activities: LeadActivity[];
  onRefresh: () => void;
  onLeadUpdated: () => void;
  isAdmin?: boolean;
  canEdit?: boolean;
  leadEmail?: string | null;
  leadContactName?: string | null;
  leadCompanyName?: string;
  leadPhone?: string | null;
  leadStatusName?: string | null;
}) {
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

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
          {canEdit && (
            <Button size="sm" onClick={() => setAddDialogOpen(true)}>
              Add activity
            </Button>
          )}
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
                const attachments = (a.attachments ?? []) as { type: string; url: string; name?: string }[];
                const isMeeting = a.activity_type === 'meeting';
                const isMeetingWithCalendar = isMeeting && hasMeetingData(attachments);
                const meetingMeta = isMeeting ? extractMeetingMeta(attachments) : null;
                const nonMetaAttachments = attachments.filter((att) => att.type !== 'meeting_meta' && att.name !== 'Google Meet Link' && att.name !== 'Google Calendar Event');
                const expanded = expandedIds.has(a.id);
                const descriptionPreview = a.description?.length > 120 ? a.description.slice(0, 120) + '…' : a.description;
                const hasMore = (a.description?.length > 120) || nonMetaAttachments.length > 0 || isMeetingWithCalendar;

                return (
                  <div key={a.id} className="relative flex items-start gap-3 group pb-6 last:pb-0">
                    <div
                      className={cn(
                        'absolute left-0 z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-background shadow-sm',
                        isMeeting ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400' : config.color
                      )}
                    >
                      {isMeeting ? <Video className="h-3 w-3" /> : <Icon className="h-3 w-3" />}
                    </div>
                    <div className="flex-1 min-w-0 pl-2">
                      <div
                        className={cn(
                          'rounded-lg border shadow-sm transition-all',
                          isMeeting
                            ? 'border-blue-200/50 bg-gradient-to-r from-blue-50/60 to-white dark:from-blue-950/20 dark:to-card dark:border-blue-800/30'
                            : 'bg-card',
                          hasMore ? 'cursor-pointer hover:shadow-md' : ''
                        )}
                        onClick={() => hasMore && toggleExpand(a.id)}
                      >
                        {/* Collapsed header — always visible */}
                        <div className="p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge className={cn(
                                  'border-0 text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0',
                                  isMeeting
                                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                                    : `${config.color} bg-opacity-20`
                                )}>
                                  {config.label}
                                </Badge>
                                <p className="text-xs text-muted-foreground">
                                  {a.profile?.full_name ?? 'Unknown'} · {safeFormat(a.created_at, 'PPp')}
                                </p>
                              </div>
                              {/* For meetings with calendar (collapsed): show event name, time, attendees, then description */}
                              {!expanded && isMeetingWithCalendar && meetingMeta ? (
                                <div className="space-y-1.5">
                                  {meetingMeta.meetingTitle && (
                                    <p className="text-sm font-medium text-foreground">
                                      {meetingMeta.meetingTitle}
                                    </p>
                                  )}
                                  {meetingMeta.startTime && meetingMeta.endTime && (
                                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                      <Clock className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                                      <span>
                                        {safeFormat(meetingMeta.startTime, 'EEE, MMM d · h:mm a')}
                                        {' – '}
                                        {safeFormat(meetingMeta.endTime, 'h:mm a')}
                                      </span>
                                    </div>
                                  )}
                                  {meetingMeta.attendees && meetingMeta.attendees.length > 0 && (
                                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground flex-wrap">
                                      <Users className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                                      <span className="flex flex-wrap gap-x-1.5 gap-y-0.5">
                                        {meetingMeta.attendees.map((email, i) => (
                                          <span key={i} className="inline-flex items-center rounded-full bg-blue-100/60 dark:bg-blue-900/30 px-2 py-0.5 text-[11px] text-blue-700 dark:text-blue-300">
                                            {email}
                                          </span>
                                        ))}
                                      </span>
                                    </div>
                                  )}
                                  {a.description && (
                                    <p className="text-sm text-muted-foreground line-clamp-2">
                                      {descriptionPreview}
                                    </p>
                                  )}
                                </div>
                              ) : (
                                <p className={cn(
                                  'text-sm text-foreground',
                                  !expanded && 'line-clamp-2'
                                )}>
                                  {expanded ? a.description : descriptionPreview}
                                </p>
                              )}
                              {/* Collapsed inline indicators */}
                              {!expanded && (nonMetaAttachments.length > 0 || isMeetingWithCalendar) && (
                                <div className="flex items-center gap-2 mt-1.5">
                                  {isMeetingWithCalendar && (
                                    <span className="inline-flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400 font-medium">
                                      <Video className="h-3 w-3" />
                                      Google Meet
                                    </span>
                                  )}
                                  {nonMetaAttachments.length > 0 && (
                                    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                                      <Paperclip className="h-3 w-3" />
                                      {nonMetaAttachments.length} attachment{nonMetaAttachments.length !== 1 ? 's' : ''}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <Badge variant="secondary" className="font-semibold tabular-nums text-success border-success/30 bg-success/10">
                                +{getActivityScore(a)}
                              </Badge>
                              {isAdmin && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-70 hover:!opacity-100 hover:text-destructive"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteActivity(a.id);
                                  }}
                                  title="Delete activity"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              {hasMore && (
                                <ChevronDown className={cn(
                                  'h-4 w-4 text-muted-foreground transition-transform duration-200',
                                  expanded && 'rotate-180'
                                )} />
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Expanded content */}
                        {expanded && (
                          <div className="border-t border-border/50 px-3 pb-3 pt-2 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
                            {isMeetingWithCalendar && (
                              <MeetingActivityCard
                                description={a.description}
                                attachments={attachments}
                                createdAt={a.created_at}
                              />
                            )}
                            {isMeeting && !isMeetingWithCalendar && (
                              <p className="text-[11px] text-muted-foreground italic flex items-center gap-1.5">
                                <Calendar className="h-3 w-3" />
                                Not synced to Google Calendar
                              </p>
                            )}
                            {nonMetaAttachments.length > 0 && (
                              <div>
                                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Attachments</p>
                                <div className="flex flex-wrap gap-2">
                                  {nonMetaAttachments.map((att, i) => {
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
                                        onClick={(e) => e.stopPropagation()}
                                        className="inline-flex items-center gap-1.5 rounded-md border bg-muted/50 px-2.5 py-1 text-xs text-foreground hover:bg-muted transition-colors"
                                      >
                                        {att.type === 'file' ? <Paperclip className="h-3 w-3 text-muted-foreground" /> : <LinkIcon className="h-3 w-3 text-muted-foreground" />}
                                        {label}
                                        <ExternalLink className="h-2.5 w-2.5 text-muted-foreground" />
                                      </a>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
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
        leadEmail={leadEmail}
        leadContactName={leadContactName}
        leadCompanyName={leadCompanyName}
        leadPhone={leadPhone}
        leadStatusName={leadStatusName}
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
  canEdit,
}: {
  leadId: string;
  leadName: string;
  tasks: LeadTask[];
  onRefresh: () => void;
  onActivityLogged?: () => void;
  onAddTask?: () => void;
  canEdit?: boolean;
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
        {canEdit && onAddTask && (
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
                    disabled={!canEdit}
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
                    disabled={!canEdit}
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
  canEdit,
  leadCompanyName,
  leadContactName,
  leadEmail,
}: {
  leadId: string;
  followUps: LeadFollowUp[];
  onRefresh: () => void;
  onActivityLogged?: () => void;
  canEdit?: boolean;
  leadCompanyName?: string;
  leadContactName?: string | null;
  leadEmail?: string | null;
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
        {canEdit && (
          <Button size="sm" onClick={() => setAddDialogOpen(true)}>
            Schedule follow-up
          </Button>
        )}
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
                    {canEdit && (
                      <Button size="sm" variant="outline" onClick={() => markDone(f.id)}>
                        Mark done
                      </Button>
                    )}
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
        leadCompanyName={leadCompanyName}
        leadContactName={leadContactName}
        leadEmail={leadEmail}
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

function LeadDocumentsTab({ leadId, isAdmin, canEdit }: { leadId: string; isAdmin?: boolean; canEdit?: boolean }) {
  const { toast } = useToast();
  const [documents, setDocuments] = useState<LeadDocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<LeadDocumentRow | null>(null);
  const [deleting, setDeleting] = useState(false);

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
    if (doc.custom_name) return doc.custom_name;
    return DOCUMENT_TYPE_OPTIONS.find((o) => o.value === doc.document_type)?.label ?? doc.document_type;
  };

  const startEdit = (doc: LeadDocumentRow) => {
    setEditingId(doc.id);
    setEditName(displayName(doc));
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName('');
  };

  const saveEdit = async (docId: string) => {
    const trimmed = editName.trim();
    if (!trimmed) {
      toast({ variant: 'destructive', title: 'Name cannot be empty' });
      return;
    }
    setSavingEdit(true);
    const { error } = await supabase
      .from('lead_documents')
      .update({ custom_name: trimmed })
      .eq('id', docId);
    if (error) {
      toast({ variant: 'destructive', title: 'Failed to rename', description: error.message });
    } else {
      setDocuments((prev) => prev.map((d) => d.id === docId ? { ...d, custom_name: trimmed } : d));
      toast({ title: 'Document renamed' });
    }
    setSavingEdit(false);
    setEditingId(null);
    setEditName('');
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    // Delete from storage first
    const { error: storageErr } = await supabase.storage.from('lead-documents').remove([deleteTarget.file_path]);
    if (storageErr) {
      toast({ variant: 'destructive', title: 'Failed to delete file', description: storageErr.message });
      setDeleting(false);
      return;
    }
    // Delete the DB row
    const { error: dbErr } = await supabase.from('lead_documents').delete().eq('id', deleteTarget.id);
    if (dbErr) {
      toast({ variant: 'destructive', title: 'Failed to delete record', description: dbErr.message });
    } else {
      setDocuments((prev) => prev.filter((d) => d.id !== deleteTarget.id));
      toast({ title: 'Document deleted' });
    }
    setDeleting(false);
    setDeleteTarget(null);
  };

  return (
    <Card className="card-shadow">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <FileUp className="h-5 w-5" />
          Documents
        </CardTitle>
        {canEdit && (
          <Button size="sm" onClick={() => setUploadDialogOpen(true)}>
            Upload document
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-muted-foreground text-sm">Loading documents...</p>
        ) : documents.length === 0 ? (
          <p className="text-muted-foreground text-sm">No documents yet. Upload an NDA, Pricing, or custom document using the button above.</p>
        ) : (
          <ul className="divide-y divide-border">
            {documents.map((doc) => (
              <li key={doc.id} className="py-3 first:pt-0 flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  {editingId === doc.id ? (
                    <div className="flex items-center gap-2">
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveEdit(doc.id);
                          if (e.key === 'Escape') cancelEdit();
                        }}
                        className="h-8 text-sm max-w-[280px]"
                        autoFocus
                        disabled={savingEdit}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-50"
                        onClick={() => saveEdit(doc.id)}
                        disabled={savingEdit}
                      >
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        onClick={cancelEdit}
                        disabled={savingEdit}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <p className="font-medium">{displayName(doc)}</p>
                      <p className="text-xs text-muted-foreground">
                        {doc.file_name}
                        {doc.file_size != null && ` · ${(doc.file_size / 1024).toFixed(1)} KB`}
                        {' · '}
                        {safeFormat(doc.uploaded_at, 'PPp')}
                      </p>
                    </>
                  )}
                </div>
                {editingId !== doc.id && (
                  <div className="flex items-center gap-1 shrink-0">
                    {canEdit && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={() => startEdit(doc)}
                        title="Rename document"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {isAdmin && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => setDeleteTarget(doc)}
                        title="Delete document"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button variant="outline" size="sm" className="gap-1" onClick={() => handleView(doc)}>
                      <ExternalLink className="h-3 w-3" />
                      View
                    </Button>
                  </div>
                )}
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

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete document?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{deleteTarget ? displayName(deleteTarget) : ''}</strong> ({deleteTarget?.file_name}). This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
