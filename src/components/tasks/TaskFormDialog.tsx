import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { CalendarIcon } from 'lucide-react';

const taskSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  due_date: z.date().optional().nullable(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  lead_id: z.string().uuid().optional().or(z.literal('')),
  assignee_id: z.string().uuid().optional(),
});

type TaskFormValues = z.infer<typeof taskSchema>;

export interface TaskRecord {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  priority: string;
  is_completed: boolean;
  lead_id: string | null;
  assignee_id: string;
  lead?: { company_name: string } | null;
}

interface TaskFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: TaskRecord | null;
  defaultLeadId?: string | null;
  onSuccess: () => void;
}

export function TaskFormDialog({
  open,
  onOpenChange,
  task,
  defaultLeadId,
  onSuccess,
}: TaskFormDialogProps) {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const isAdmin = role === 'admin';
  const [leads, setLeads] = useState<{ id: string; company_name: string }[]>([]);
  const [assignees, setAssignees] = useState<{ id: string; full_name: string | null }[]>([]);

  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      title: '',
      description: '',
      due_date: null,
      priority: 'medium',
      lead_id: '',
      assignee_id: user?.id ?? '',
    },
  });

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data: leadsData } = await supabase
        .from('leads')
        .select('id, company_name')
        .order('company_name');
      setLeads(leadsData ?? []);
      if (isAdmin) {
        const { data: roles } = await supabase.from('user_roles').select('user_id');
        if (roles?.length) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('user_id, full_name')
            .in('user_id', roles.map((r) => r.user_id));
          setAssignees((profiles ?? []).map((p) => ({ id: p.user_id, full_name: p.full_name })));
        }
      }
    })();
  }, [open, isAdmin]);

  useEffect(() => {
    if (task) {
      form.reset({
        title: task.title,
        description: task.description ?? '',
        due_date: task.due_date ? new Date(task.due_date) : null,
        priority: task.priority as TaskFormValues['priority'],
        lead_id: task.lead_id ?? '',
        assignee_id: task.assignee_id,
      });
    } else {
      form.reset({
        title: '',
        description: '',
        due_date: null,
        priority: 'medium',
        lead_id: defaultLeadId ?? '',
        assignee_id: user?.id ?? '',
      });
    }
  }, [task, defaultLeadId, user?.id, form]);

  const onSubmit = async (values: TaskFormValues) => {
    const payload = {
      title: values.title,
      description: values.description || null,
      due_date: values.due_date ? values.due_date.toISOString() : null,
      priority: values.priority,
      lead_id: values.lead_id || null,
      assignee_id: values.assignee_id || user?.id,
    };

    if (task) {
      const { error } = await supabase.from('tasks').update(payload).eq('id', task.id);
      if (error) {
        toast({ variant: 'destructive', title: 'Error', description: error.message });
        return;
      }
      toast({ title: 'Task updated' });
    } else {
      const { error } = await supabase.from('tasks').insert(payload);
      if (error) {
        toast({ variant: 'destructive', title: 'Error', description: error.message });
        return;
      }
      if (payload.lead_id && user?.id) {
        await supabase.from('lead_activities').insert({
          lead_id: payload.lead_id,
          user_id: user.id,
          activity_type: 'note',
          description: `Task created: ${payload.title}`,
        });
      }
      toast({ title: 'Task created' });
    }
    onOpenChange(false);
    onSuccess();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{task ? 'Edit Task' : 'Add Task'}</DialogTitle>
          <DialogDescription>
            {task ? 'Update task details.' : 'Create a new task and optionally link to a lead.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input id="title" {...form.register('title')} placeholder="Task title" />
            {form.formState.errors.title && (
              <p className="text-sm text-destructive">{form.formState.errors.title.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              {...form.register('description')}
              placeholder="Details..."
              rows={3}
              className="resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Due date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !form.watch('due_date') && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {form.watch('due_date')
                      ? format(form.watch('due_date')!, 'PPP')
                      : 'Pick date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={form.watch('due_date') ?? undefined}
                    onSelect={(d) => form.setValue('due_date', d ?? null)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select
                value={form.watch('priority')}
                onValueChange={(v) => form.setValue('priority', v as TaskFormValues['priority'])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Lead (optional)</Label>
            <Select
              value={form.watch('lead_id') || 'none'}
              onValueChange={(v) => form.setValue('lead_id', v === 'none' ? '' : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="No lead" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No lead</SelectItem>
                {leads.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.company_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {isAdmin && (
            <div className="space-y-2">
              <Label>Assign to</Label>
              <Select
                value={form.watch('assignee_id') || ''}
                onValueChange={(v) => form.setValue('assignee_id', v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select assignee" />
                </SelectTrigger>
                <SelectContent>
                  {assignees.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.full_name || a.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" className="gradient-primary" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {task ? 'Save' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
