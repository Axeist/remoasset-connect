import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { safeFormat } from '@/lib/date';
import { Calendar, CheckSquare, AlertCircle, Check, ExternalLink, Filter, X } from 'lucide-react';
import { format, isBefore, isAfter, startOfDay, endOfDay } from 'date-fns';

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
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [followUps, setFollowUps] = useState<FollowUpWithDetails[]>([]);
  const [tasks, setTasks] = useState<TaskWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<{ user_id: string; full_name: string }[]>([]);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'overdue' | 'upcoming' | 'completed'>('all');
  const [employeeFilter, setEmployeeFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  
  const isAdmin = role === 'admin';

  useEffect(() => {
    if (user) {
      fetchData();
      if (isAdmin) {
        fetchEmployees();
      }
    }
  }, [user, isAdmin]);

  const fetchEmployees = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('user_id, full_name')
      .order('full_name');
    if (data) {
      setEmployees(data);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      // Build queries based on admin status
      const followUpsQuery = supabase
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

      const tasksQuery = supabase
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

      // Filter by user if not admin
      if (!isAdmin && user) {
        followUpsQuery.eq('user_id', user.id);
        tasksQuery.eq('assignee_id', user.id);
      }

      const [followUpsRes, tasksRes] = await Promise.all([
        followUpsQuery,
        tasksQuery
      ]);

      if (followUpsRes.error) {
        toast({ variant: 'destructive', title: 'Error fetching follow-ups', description: followUpsRes.error.message });
      }

      if (tasksRes.error) {
        toast({ variant: 'destructive', title: 'Error fetching tasks', description: tasksRes.error.message });
      }

      // Fetch user profiles
      const userIds = new Set<string>();
      (followUpsRes.data || []).forEach(f => userIds.add(f.user_id));
      (tasksRes.data || []).forEach(t => userIds.add(t.assignee_id));

      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', Array.from(userIds));

      const profileMap = (profiles || []).reduce((acc, p) => {
        acc[p.user_id] = { full_name: p.full_name };
        return acc;
      }, {} as Record<string, { full_name: string }>);

      // Enrich data with profiles
      const enrichedFollowUps = (followUpsRes.data || []).map(f => ({
        ...f,
        profile: profileMap[f.user_id] || null
      }));

      const enrichedTasks = (tasksRes.data || []).map(t => ({
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

  // Apply filters
  const filterFollowUps = (items: FollowUpWithDetails[]) => {
    return items.filter(item => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch = 
          item.lead?.company_name?.toLowerCase().includes(query) ||
          item.notes?.toLowerCase().includes(query) ||
          item.profile?.full_name?.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }
      
      // Employee filter (admin only)
      if (isAdmin && employeeFilter !== 'all' && item.user_id !== employeeFilter) {
        return false;
      }
      
      return true;
    });
  };

  const filterTasks = (items: TaskWithDetails[]) => {
    return items.filter(item => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch = 
          item.title?.toLowerCase().includes(query) ||
          item.description?.toLowerCase().includes(query) ||
          item.lead?.company_name?.toLowerCase().includes(query) ||
          item.assignee?.full_name?.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }
      
      // Employee filter (admin only)
      if (isAdmin && employeeFilter !== 'all' && item.assignee_id !== employeeFilter) {
        return false;
      }
      
      // Priority filter
      if (priorityFilter !== 'all' && item.priority !== priorityFilter) {
        return false;
      }
      
      return true;
    });
  };

  const filteredFollowUps = filterFollowUps(followUps);
  const filteredTasks = filterTasks(tasks);

  // Categorize follow-ups
  const overdueFollowUps = filteredFollowUps.filter(f => !f.is_completed && new Date(f.scheduled_at) < now);
  const upcomingFollowUps = filteredFollowUps.filter(f => !f.is_completed && new Date(f.scheduled_at) >= now);
  const completedFollowUps = filteredFollowUps.filter(f => f.is_completed);

  // Categorize tasks
  const overdueTasks = filteredTasks.filter(t => t.due_date && !t.is_completed && isBefore(new Date(t.due_date), now));
  const upcomingTasks = filteredTasks.filter(t => (!t.due_date || !isBefore(new Date(t.due_date), now)) && !t.is_completed);
  const completedTasks = filteredTasks.filter(t => t.is_completed);

  // Apply status filter
  const getFilteredFollowUpsByStatus = () => {
    switch (statusFilter) {
      case 'overdue': return overdueFollowUps;
      case 'upcoming': return upcomingFollowUps;
      case 'completed': return completedFollowUps;
      default: return filteredFollowUps;
    }
  };

  const getFilteredTasksByStatus = () => {
    switch (statusFilter) {
      case 'overdue': return overdueTasks;
      case 'upcoming': return upcomingTasks;
      case 'completed': return completedTasks;
      default: return filteredTasks;
    }
  };

  const displayFollowUps = getFilteredFollowUpsByStatus();
  const displayTasks = getFilteredTasksByStatus();

  const resetFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setEmployeeFilter('all');
    setPriorityFilter('all');
  };

  const hasActiveFilters = searchQuery || statusFilter !== 'all' || employeeFilter !== 'all' || priorityFilter !== 'all';

  // Calculate insights (using original unfiltered data for KPIs)
  const totalFollowUps = followUps.length;
  const totalTasks = tasks.length;
  const allCompletedTasks = tasks.filter(t => t.is_completed);
  const allCompletedFollowUps = followUps.filter(f => f.is_completed);
  const allOverdueFollowUps = followUps.filter(f => !f.is_completed && new Date(f.scheduled_at) < now);
  const allOverdueTasks = tasks.filter(t => t.due_date && !t.is_completed && isBefore(new Date(t.due_date), now));
  
  const completionRate = totalTasks > 0 
    ? Math.round((allCompletedTasks.length / totalTasks) * 100) 
    : 0;
  const followUpCompletionRate = totalFollowUps > 0
    ? Math.round((allCompletedFollowUps.length / totalFollowUps) * 100)
    : 0;

  return (
    <AppLayout>
      <div className="space-y-8">
        <div className="animate-fade-in-up flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground tracking-tight">
              {isAdmin ? 'Team Activity' : 'My Activity'}
            </h1>
            <p className="text-muted-foreground mt-1.5">
              {isAdmin ? 'Monitor all team tasks and follow-ups' : 'Track your tasks and follow-ups'}
            </p>
          </div>
          <Button
            variant={showFilters ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="gap-2"
          >
            <Filter className="h-4 w-4" />
            Filters
            {hasActiveFilters && (
              <Badge variant="secondary" className="ml-1 h-5 w-5 rounded-full p-0 flex items-center justify-center">
                !
              </Badge>
            )}
          </Button>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <Card className="card-shadow animate-fade-in-up">
            <CardContent className="pt-6">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Search</label>
                  <Input
                    placeholder="Search by name, lead, notes..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                
                <div>
                  <label className="text-sm font-medium mb-2 block">Status</label>
                  <Select value={statusFilter} onValueChange={(value: any) => setStatusFilter(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="overdue">Overdue</SelectItem>
                      <SelectItem value="upcoming">Upcoming</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {isAdmin && (
                  <div>
                    <label className="text-sm font-medium mb-2 block">Employee</label>
                    <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Employees</SelectItem>
                        {employees.map(emp => (
                          <SelectItem key={emp.user_id} value={emp.user_id}>
                            {emp.full_name || 'Unknown'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div>
                  <label className="text-sm font-medium mb-2 block">Priority</label>
                  <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Priorities</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {hasActiveFilters && (
                <div className="mt-4 flex justify-end">
                  <Button variant="ghost" size="sm" onClick={resetFilters} className="gap-2">
                    <X className="h-4 w-4" />
                    Clear Filters
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {loading ? (
          <Skeleton className="h-96 w-full" />
        ) : (
          <>
            {/* Key Insights */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 animate-fade-in-up">
              <Card className="card-shadow">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Overdue Follow-ups</p>
                      <p className="text-2xl font-bold text-destructive mt-1">{allOverdueFollowUps.length}</p>
                    </div>
                    <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
                      <AlertCircle className="h-6 w-6 text-destructive" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="card-shadow">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Overdue Tasks</p>
                      <p className="text-2xl font-bold text-destructive mt-1">{allOverdueTasks.length}</p>
                    </div>
                    <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
                      <AlertCircle className="h-6 w-6 text-destructive" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="card-shadow">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Task Completion</p>
                      <p className="text-2xl font-bold text-primary mt-1">{completionRate}%</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {allCompletedTasks.length} of {totalTasks}
                      </p>
                    </div>
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <CheckSquare className="h-6 w-6 text-primary" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="card-shadow">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Follow-up Rate</p>
                      <p className="text-2xl font-bold text-primary mt-1">{followUpCompletionRate}%</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {allCompletedFollowUps.length} of {totalFollowUps}
                      </p>
                    </div>
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <Calendar className="h-6 w-6 text-primary" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            <Tabs defaultValue="follow-ups" className="space-y-6">
              <TabsList>
                <TabsTrigger value="follow-ups" className="gap-2">
                  <Calendar className="h-4 w-4" />
                  Follow-ups
                  <Badge variant="secondary" className="ml-1">{displayFollowUps.length}</Badge>
                </TabsTrigger>
                <TabsTrigger value="tasks" className="gap-2">
                  <CheckSquare className="h-4 w-4" />
                  Tasks
                  <Badge variant="secondary" className="ml-1">{displayTasks.length}</Badge>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="follow-ups" className="space-y-6">
                {displayFollowUps.length === 0 ? (
                  <Card className="card-shadow">
                    <CardContent className="py-12">
                      <p className="text-center text-muted-foreground">
                        {hasActiveFilters ? 'No follow-ups match your filters' : 'No follow-ups found'}
                      </p>
                    </CardContent>
                  </Card>
                ) : statusFilter === 'all' ? (
                  <>
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
                  </>
                ) : (
                  <Card className="card-shadow rounded-xl border-border/80">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Calendar className="h-5 w-5" />
                        {statusFilter === 'overdue' && 'Overdue Follow-ups'}
                        {statusFilter === 'upcoming' && 'Upcoming Follow-ups'}
                        {statusFilter === 'completed' && 'Completed Follow-ups'}
                        <Badge variant="secondary">{displayFollowUps.length}</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {displayFollowUps.map(f => (
                          <FollowUpItem 
                            key={f.id} 
                            followUp={f} 
                            isOverdue={statusFilter === 'overdue'} 
                            navigate={navigate} 
                          />
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="tasks" className="space-y-6">
              {displayTasks.length === 0 ? (
                <Card className="card-shadow">
                  <CardContent className="py-12">
                    <p className="text-center text-muted-foreground">
                      {hasActiveFilters ? 'No tasks match your filters' : 'No tasks found'}
                    </p>
                  </CardContent>
                </Card>
              ) : statusFilter === 'all' ? (
                <>
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
                </>
              ) : (
                <Card className="card-shadow rounded-xl border-border/80">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CheckSquare className="h-5 w-5" />
                      {statusFilter === 'overdue' && 'Overdue Tasks'}
                      {statusFilter === 'upcoming' && 'Pending Tasks'}
                      {statusFilter === 'completed' && 'Completed Tasks'}
                      <Badge variant="secondary">{displayTasks.length}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {displayTasks.map(t => (
                        <TaskItem 
                          key={t.id} 
                          task={t} 
                          isOverdue={statusFilter === 'overdue'} 
                          navigate={navigate} 
                        />
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
            </Tabs>
          </>
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
