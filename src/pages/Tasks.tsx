import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Plus, Calendar } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface Task {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  priority: string;
  is_completed: boolean;
  lead: { company_name: string } | null;
}

const priorityColors = {
  low: 'bg-muted text-muted-foreground',
  medium: 'bg-primary/10 text-primary',
  high: 'bg-warning/10 text-warning',
  urgent: 'bg-destructive/10 text-destructive',
};

export default function Tasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (user) fetchTasks();
  }, [user]);

  const fetchTasks = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('tasks')
      .select(`
        id,
        title,
        description,
        due_date,
        priority,
        is_completed,
        lead:leads(company_name)
      `)
      .eq('assignee_id', user?.id)
      .order('due_date', { ascending: true });

    if (!error && data) {
      setTasks(data as Task[]);
    }
    setLoading(false);
  };

  const toggleTask = async (taskId: string, completed: boolean) => {
    await supabase
      .from('tasks')
      .update({ is_completed: completed })
      .eq('id', taskId);
    
    setTasks(tasks.map(t => t.id === taskId ? { ...t, is_completed: completed } : t));
  };

  const pendingTasks = tasks.filter(t => !t.is_completed);
  const completedTasks = tasks.filter(t => t.is_completed);

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">My Tasks</h1>
            <p className="text-muted-foreground mt-1">Track and manage your daily tasks</p>
          </div>
          <Button className="gap-2 gradient-primary">
            <Plus className="h-4 w-4" />
            Add Task
          </Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Pending Tasks */}
          <Card className="card-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span>Pending</span>
                <Badge variant="secondary">{pendingTasks.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-muted-foreground text-center py-8">Loading...</p>
              ) : pendingTasks.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No pending tasks. You're all caught up!</p>
              ) : (
                <div className="space-y-3">
                  {pendingTasks.map((task) => (
                    <TaskItem key={task.id} task={task} onToggle={toggleTask} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Completed Tasks */}
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
                    <TaskItem key={task.id} task={task} onToggle={toggleTask} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}

function TaskItem({ task, onToggle }: { task: Task; onToggle: (id: string, completed: boolean) => void }) {
  return (
    <div className={cn(
      "flex items-start gap-3 p-3 rounded-lg border transition-all",
      task.is_completed ? "bg-muted/30 opacity-60" : "bg-card hover:shadow-sm"
    )}>
      <Checkbox 
        checked={task.is_completed}
        onCheckedChange={(checked) => onToggle(task.id, checked as boolean)}
        className="mt-1"
      />
      <div className="flex-1 min-w-0">
        <p className={cn("font-medium", task.is_completed && "line-through")}>
          {task.title}
        </p>
        {task.lead && (
          <p className="text-sm text-muted-foreground">{task.lead.company_name}</p>
        )}
        <div className="flex items-center gap-2 mt-2">
          <Badge className={priorityColors[task.priority as keyof typeof priorityColors]}>
            {task.priority}
          </Badge>
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
