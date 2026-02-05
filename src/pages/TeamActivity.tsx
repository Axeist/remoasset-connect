import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { safeFormat } from '@/lib/date';
import { Calendar, CheckSquare, AlertCircle, Check, ExternalLink } from 'lucide-react';
import { format, isBefore } from 'date-fns';

interface FollowUpWithDetails {
  id: string;
  lead_id: string;
  user_id: string;
  scheduled_at: string;
  reminder_type: string;
  notes: string | null;
  is_completed: boolean;
  created_at: string;
  lead?: { company_name: string } | null;
  profile?: { full_name: string } | null;
}

interface TaskWithDetails {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  priority: string;
  is_completed: boolean;
  lead_id: string | null;
  assignee_id: string;
  lead?: { company_name: string } | null;
  assignee?: { full_name: string } | null;
}

const priorityColors: Record<string, string> = {
  low: 'bg-muted text-muted-foreground',
  medium: 'bg-primary/10 text-primary',
  high: 'bg-warning/10 text-warning',
  urgent: 'bg-destructive/10 text-destructive',
};

export default function TeamActivity() {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [followUps, setFollowUps] = useState<FollowUpWithDetails[]>([]);
  const [tasks, setTasks] = useState<TaskWithDetails[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAdmin) {
      navigate('/dashboard');
      return;
    }
    if (user) {
      fetchData();
    }
  }, [user, isAdmin, navigate]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch all follow-ups
      const { data: followUpsData, error: followUpsError } = await supabase
        .from('follow_ups')
        .select(`
          id,
          lead_id,
          user_id,
          scheduled_at,
          reminder_type,
          notes,
          is_completed,
          created_at,
          lead:leads(company_name)
        `)
        .order('scheduled_at', { ascending: true });

      if (followUpsError) {
        toast({ variant: 'destructive', title: 'Error fetching follow-ups', description: followUpsError.message });
      }

      // Fetch all tasks
      const { data: tasksData, error: tasksError } = await supabase
        .from('tasks')
        .select(`
          id,
          title,
          description,
          due_date,
          priority,
          is_completed,
          lead_id,
          assignee_id,
          lead:leads(company_name)
        `)
        .order('due_date', { ascending: true });

      if (tasksError) {
        toast({ variant: 'destructive', title: 'Error fetching tasks', description: tasksError.message });
      }

      // Fetch user profiles
      const userIds = new Set<string>();
      (followUpsData || []).forEach(f => userIds.add(f.user_id));
      (tasksData || []).forEach(t => userIds.add(t.assignee_id));

      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', Array.from(userIds));

      const profileMap = (profiles || []).reduce((acc, p) => {
        acc[p.user_id] = { full_name: p.full_name };
        return acc;
      }, {} as Record<string, { full_name: string }>);

      // Enrich data with profiles
      const enrichedFollowUps = (followUpsData || []).map(f => ({
        ...f,
        profile: profileMap[f.user_id] || null
      }));

      const enrichedTasks = (tasksData || []).map(t => ({
        ...t,
        assignee: profileMap[t.assignee_id] || null
      }));

      setFollowUps(enrichedFollowUps);
      setTasks(enrichedTasks);
    } catch (error) {
      toast({ 
        variant: 'destructive', 
        title: 'Error', 
        description: error instanceof Error ? error.message : 'Failed to fetch data' 
      });
    }
    setLoading(false);
  };

  const now = new Date();

  // Categorize follow-ups
  const overdueFollowUps = followUps.filter(f => !f.is_completed && new Date(f.scheduled_at) < now);
  const upcomingFollowUps = followUps.filter(f => !f.is_completed && new Date(f.scheduled_at) >= now);
  const completedFollowUps = followUps.filter(f => f.is_completed);

  // Categorize tasks
  const overdueTasks = tasks.filter(t => t.due_date && !t.is_completed && isBefore(new Date(t.due_date), now));
  const upcomingTasks = tasks.filter(t => (!t.due_date || !isBefore(new Date(t.due_date), now)) && !t.is_completed);
  const completedTasks = tasks.filter(t => t.is_completed);

  return (
    <AppLayout>
      <div className="space-y-8">
        <div className="animate-fade-in-up">
          <h1 className="text-2xl font-display font-bold text-foreground tracking-tight">Team Activity</h1>
          <p className="text-muted-foreground mt-1.5">Monitor all team tasks and follow-ups</p>
        </div>

        {loading ? (
          <Skeleton className="h-96 w-full" />
        ) : (
          <Tabs defaultValue="follow-ups" className="space-y-6">
            <TabsList>
              <TabsTrigger value="follow-ups" className="gap-2">
                <Calendar className="h-4 w-4" />
                Follow-ups
                <Badge variant="secondary" className="ml-1">{followUps.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="tasks" className="gap-2">
                <CheckSquare className="h-4 w-4" />
                Tasks
                <Badge variant="secondary" className="ml-1">{tasks.length}</Badge>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="follow-ups" className="space-y-6">
              {/* Overdue Follow-ups */}
              {overdueFollowUps.length > 0 && (
                <Card className="card-shadow rounded-xl border-destructive/50 bg-destructive/5">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-destructive">
                      <AlertCircle className="h-5 w-5" />
                      Overdue Follow-ups
                      <Badge variant="destructive">{overdueFollowUps.length}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {overdueFollowUps.map(f => (
                        <FollowUpItem key={f.id} followUp={f} isOverdue navigate={navigate} />
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Upcoming Follow-ups */}
              <Card className="card-shadow rounded-xl border-border/80">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Upcoming Follow-ups
                    <Badge variant="secondary">{upcomingFollowUps.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {upcomingFollowUps.length === 0 ? (
                    <p className="text-muted-foreground text-sm py-8 text-center">No upcoming follow-ups</p>
                  ) : (
                    <div className="space-y-3">
                      {upcomingFollowUps.map(f => (
                        <FollowUpItem key={f.id} followUp={f} navigate={navigate} />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Completed Follow-ups */}
              <Card className="card-shadow rounded-xl border-border/80">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Check className="h-5 w-5" />
                    Completed Follow-ups
                    <Badge variant="secondary">{completedFollowUps.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {completedFollowUps.length === 0 ? (
                    <p className="text-muted-foreground text-sm py-8 text-center">No completed follow-ups</p>
                  ) : (
                    <div className="space-y-3">
                      {completedFollowUps.slice(0, 10).map(f => (
                        <FollowUpItem key={f.id} followUp={f} navigate={navigate} />
                      ))}
                      {completedFollowUps.length > 10 && (
                        <p className="text-sm text-muted-foreground text-center pt-2">
                          And {completedFollowUps.length - 10} more...
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="tasks" className="space-y-6">
              {/* Overdue Tasks */}
              {overdueTasks.length > 0 && (
                <Card className="card-shadow rounded-xl border-destructive/50 bg-destructive/5">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-destructive">
                      <AlertCircle className="h-5 w-5" />
                      Overdue Tasks
                      <Badge variant="destructive">{overdueTasks.length}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {overdueTasks.map(t => (
                        <TaskItem key={t.id} task={t} isOverdue navigate={navigate} />
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Upcoming Tasks */}
              <Card className="card-shadow rounded-xl border-border/80">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckSquare className="h-5 w-5" />
                    Pending Tasks
                    <Badge variant="secondary">{upcomingTasks.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {upcomingTasks.length === 0 ? (
                    <p className="text-muted-foreground text-sm py-8 text-center">No pending tasks</p>
                  ) : (
                    <div className="space-y-3">
                      {upcomingTasks.map(t => (
                        <TaskItem key={t.id} task={t} navigate={navigate} />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Completed Tasks */}
              <Card className="card-shadow rounded-xl border-border/80">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Check className="h-5 w-5" />
                    Completed Tasks
                    <Badge variant="secondary">{completedTasks.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {completedTasks.length === 0 ? (
                    <p className="text-muted-foreground text-sm py-8 text-center">No completed tasks</p>
                  ) : (
                    <div className="space-y-3">
                      {completedTasks.slice(0, 10).map(t => (
                        <TaskItem key={t.id} task={t} navigate={navigate} />
                      ))}
                      {completedTasks.length > 10 && (
                        <p className="text-sm text-muted-foreground text-center pt-2">
                          And {completedTasks.length - 10} more...
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </AppLayout>
  );
}

function FollowUpItem({ 
  followUp, 
  isOverdue = false,
  navigate 
}: { 
  followUp: FollowUpWithDetails; 
  isOverdue?: boolean;
  navigate: (path: string) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 p-4 rounded-lg border bg-card hover:shadow-sm transition-all">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-2">
          {followUp.profile?.full_name && (
            <Badge variant="outline" className="font-semibold">
              {followUp.profile.full_name}
            </Badge>
          )}
          {followUp.lead?.company_name && (
            <button
              onClick={() => navigate(`/leads/${followUp.lead_id}`)}
              className="text-sm font-medium text-primary hover:underline flex items-center gap-1"
            >
              {followUp.lead.company_name}
              <ExternalLink className="h-3 w-3" />
            </button>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          {safeFormat(followUp.scheduled_at, 'PPp')}
        </p>
        {followUp.notes && (
          <p className="text-sm mt-1">{followUp.notes}</p>
        )}
        <div className="flex gap-2 mt-2 flex-wrap">
          <Badge variant="outline" className="text-xs">
            {followUp.reminder_type}
          </Badge>
          {isOverdue && (
            <Badge variant="destructive" className="text-xs gap-1">
              <AlertCircle className="h-3 w-3" />
              Overdue
            </Badge>
          )}
          {followUp.is_completed && (
            <Badge variant="secondary" className="text-xs gap-1">
              <Check className="h-3 w-3" />
              Done
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}

function TaskItem({ 
  task, 
  isOverdue = false,
  navigate 
}: { 
  task: TaskWithDetails; 
  isOverdue?: boolean;
  navigate: (path: string) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 p-4 rounded-lg border bg-card hover:shadow-sm transition-all">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-2">
          {task.assignee?.full_name && (
            <Badge variant="outline" className="font-semibold">
              {task.assignee.full_name}
            </Badge>
          )}
          {task.lead?.company_name && (
            <button
              onClick={() => navigate(`/leads/${task.lead_id}`)}
              className="text-sm font-medium text-primary hover:underline flex items-center gap-1"
            >
              {task.lead.company_name}
              <ExternalLink className="h-3 w-3" />
            </button>
          )}
        </div>
        <p className="font-medium">{task.title}</p>
        {task.description && (
          <p className="text-sm text-muted-foreground mt-1">{task.description}</p>
        )}
        <div className="flex gap-2 mt-2 flex-wrap">
          <Badge className={priorityColors[task.priority] ?? 'bg-muted'}>
            {task.priority}
          </Badge>
          {task.due_date && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {format(new Date(task.due_date), 'MMM d, yyyy')}
            </span>
          )}
          {isOverdue && (
            <Badge variant="destructive" className="text-xs gap-1">
              <AlertCircle className="h-3 w-3" />
              Overdue
            </Badge>
          )}
          {task.is_completed && (
            <Badge variant="secondary" className="text-xs gap-1">
              <Check className="h-3 w-3" />
              Done
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}
