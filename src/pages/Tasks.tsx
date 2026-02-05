import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Plus, Calendar, List, LayoutGrid } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format, startOfDay, endOfDay, isBefore, isAfter, isWithinInterval } from 'date-fns';
import { cn } from '@/lib/utils';
import { TaskFormDialog, type TaskRecord } from '@/components/tasks/TaskFormDialog';
import { TaskDetailDialog } from '@/components/tasks/TaskDetailDialog';

const priorityColors: Record<string, string> = {
  low: 'bg-muted text-muted-foreground',
  medium: 'bg-primary/10 text-primary',
  high: 'bg-warning/10 text-warning',
  urgent: 'bg-destructive/10 text-destructive',
};

type DueFilter = 'all' | 'overdue' | 'today' | 'week';
type StatusFilter = 'all' | 'pending' | 'completed';

export default function Tasks() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [leads, setLeads] = useState<{ id: string; company_name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [detailTask, setDetailTask] = useState<TaskRecord | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editTask, setEditTask] = useState<TaskRecord | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');
  const [filters, setFilters] = useState<{
    due: DueFilter;
    priority: string;
    status: StatusFilter;
    lead_id: string;
  }>({
    due: 'all',
    priority: 'all',
    status: 'all',
    lead_id: 'all',
  });

  useEffect(() => {
    if (user) {
      fetchTasks();
      supabase
        .from('leads')
        .select('id, company_name')
        .eq('owner_id', user.id)
        .order('company_name')
        .then(({ data }) => setLeads(data ?? []));
    }
  }, [user, filters]);

  const fetchTasks = async () => {
    if (!user) return;
    setLoading(true);
    let query = supabase
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
      .eq('assignee_id', user.id)
      .order('due_date', { ascending: true });

    const { data, error } = await query;
    if (!error && data) {
      let list = data as TaskRecord[];
      const now = new Date();
      const todayStart = startOfDay(now);
      const todayEnd = endOfDay(now);
      const weekEnd = endOfDay(new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000));

      if (filters.due === 'overdue') {
        list = list.filter((t) => t.due_date && isBefore(new Date(t.due_date), todayStart) && !t.is_completed);
      } else if (filters.due === 'today') {
        list = list.filter((t) => t.due_date && isWithinInterval(new Date(t.due_date), { start: todayStart, end: todayEnd }));
      } else if (filters.due === 'week') {
        list = list.filter((t) => t.due_date && isWithinInterval(new Date(t.due_date), { start: todayStart, end: weekEnd }));
      }

      if (filters.priority !== 'all') {
        list = list.filter((t) => t.priority === filters.priority);
      }
      if (filters.status === 'pending') list = list.filter((t) => !t.is_completed);
      if (filters.status === 'completed') list = list.filter((t) => t.is_completed);
      if (filters.lead_id !== 'all') {
        list = list.filter((t) => t.lead_id === filters.lead_id);
      }

      setTasks(list);
    }
    setLoading(false);
  };

  const toggleTask = async (taskId: string, completed: boolean) => {
    await supabase.from('tasks').update({ is_completed: completed }).eq('id', taskId);
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, is_completed: completed } : t)));
    if (detailTask?.id === taskId) setDetailTask((t) => (t ? { ...t, is_completed: completed } : null));
  };

  const pendingTasks = tasks.filter((t) => !t.is_completed);
  const completedTasks = tasks.filter((t) => t.is_completed);

  const openEdit = (task: TaskRecord) => {
    setDetailOpen(false);
    setEditTask(task);
    setFormOpen(true);
  };

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">My Tasks</h1>
            <p className="text-muted-foreground mt-1">Track and manage your daily tasks</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setViewMode('list')} className={cn(viewMode === 'list' && 'bg-muted')}>
              <List className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={() => setViewMode('kanban')} className={cn(viewMode === 'kanban' && 'bg-muted')}>
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button className="gap-2 gradient-primary" onClick={() => { setEditTask(null); setFormOpen(true); }}>
              <Plus className="h-4 w-4" />
              Add Task
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card className="card-shadow">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-4">
              <Select value={filters.due} onValueChange={(v) => setFilters((f) => ({ ...f, due: v as DueFilter }))}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Due" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">This week</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filters.priority} onValueChange={(v) => setFilters((f) => ({ ...f, priority: v }))}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filters.status} onValueChange={(v) => setFilters((f) => ({ ...f, status: v as StatusFilter }))}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filters.lead_id} onValueChange={(v) => setFilters((f) => ({ ...f, lead_id: v }))}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Lead" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All leads</SelectItem>
                  {leads.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.company_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <p className="text-muted-foreground text-center py-8">Loading...</p>
        ) : viewMode === 'kanban' ? (
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="card-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span>To do</span>
                  <Badge variant="secondary">{pendingTasks.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 min-h-[200px]">
                  {pendingTasks.length === 0 ? (
                    <p className="text-muted-foreground text-sm">No pending tasks</p>
                  ) : (
                    pendingTasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        onToggle={toggleTask}
                        onClick={() => { setDetailTask(task); setDetailOpen(true); }}
                      />
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
            <Card className="card-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span>Done</span>
                  <Badge variant="secondary">{completedTasks.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 min-h-[200px]">
                  {completedTasks.length === 0 ? (
                    <p className="text-muted-foreground text-sm">No completed tasks</p>
                  ) : (
                    completedTasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        onToggle={toggleTask}
                        onClick={() => { setDetailTask(task); setDetailOpen(true); }}
                      />
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="card-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span>Pending</span>
                  <Badge variant="secondary">{pendingTasks.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {pendingTasks.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No pending tasks. You're all caught up!</p>
                ) : (
                  <div className="space-y-3">
                    {pendingTasks.map((task) => (
                      <TaskItem
                        key={task.id}
                        task={task}
                        onToggle={toggleTask}
                        onClick={() => { setDetailTask(task); setDetailOpen(true); }}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
            <Card className="card-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span>Completed</span>
                  <Badge variant="secondary">{completedTasks.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {completedTasks.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No completed tasks yet.</p>
                ) : (
                  <div className="space-y-3">
                    {completedTasks.map((task) => (
                      <TaskItem
                        key={task.id}
                        task={task}
                        onToggle={toggleTask}
                        onClick={() => { setDetailTask(task); setDetailOpen(true); }}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        <TaskFormDialog
          open={formOpen}
          onOpenChange={(open) => { setFormOpen(open); if (!open) setEditTask(null); }}
          task={editTask}
          onSuccess={fetchTasks}
        />
        <TaskDetailDialog
          open={detailOpen}
          onOpenChange={setDetailOpen}
          task={detailTask}
          onEdit={() => openEdit(detailTask!)}
          onDelete={fetchTasks}
        />
      </div>
    </AppLayout>
  );
}

function TaskItem({
  task,
  onToggle,
  onClick,
}: {
  task: TaskRecord;
  onToggle: (id: string, completed: boolean) => void;
  onClick: () => void;
}) {
  return (
    <div
      className={cn(
        'flex items-start gap-3 p-3 rounded-lg border transition-all cursor-pointer',
        task.is_completed ? 'bg-muted/30 opacity-60' : 'bg-card hover:shadow-sm'
      )}
      onClick={onClick}
    >
      <Checkbox
        checked={task.is_completed}
        onCheckedChange={(checked) => onToggle(task.id, checked as boolean)}
        onClick={(e) => e.stopPropagation()}
        className="mt-1"
      />
      <div className="flex-1 min-w-0">
        <p className={cn('font-medium', task.is_completed && 'line-through')}>{task.title}</p>
        {task.lead_id && task.lead && (
          <Link
            to={`/leads/${task.lead_id}`}
            onClick={(e) => e.stopPropagation()}
            className="text-sm text-primary hover:underline"
          >
            {task.lead.company_name}
          </Link>
        )}
        <div className="flex items-center gap-2 mt-2">
          <Badge className={priorityColors[task.priority] ?? 'bg-muted'}>{task.priority}</Badge>
          {task.due_date && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {format(new Date(task.due_date), 'MMM d')}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function TaskCard({
  task,
  onToggle,
  onClick,
}: {
  task: TaskRecord;
  onToggle: (id: string, completed: boolean) => void;
  onClick: () => void;
}) {
  return (
    <div
      className={cn(
        'p-3 rounded-lg border transition-all cursor-pointer',
        task.is_completed ? 'bg-muted/30 opacity-60' : 'bg-card hover:shadow-sm'
      )}
      onClick={onClick}
    >
      <div className="flex items-start gap-2">
        <Checkbox
          checked={task.is_completed}
          onCheckedChange={(checked) => onToggle(task.id, checked as boolean)}
          onClick={(e) => e.stopPropagation()}
        />
        <div className="flex-1 min-w-0">
          <p className={cn('font-medium text-sm', task.is_completed && 'line-through')}>{task.title}</p>
          {task.lead_id && task.lead && (
            <Link
              to={`/leads/${task.lead_id}`}
              onClick={(e) => e.stopPropagation()}
              className="text-xs text-primary hover:underline block"
            >
              {task.lead.company_name}
            </Link>
          )}
          <div className="flex items-center gap-2 mt-1">
            <Badge className={cn('text-xs', priorityColors[task.priority] ?? 'bg-muted')}>{task.priority}</Badge>
            {task.due_date && (
              <span className="text-xs text-muted-foreground">{format(new Date(task.due_date), 'MMM d')}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
