import { useState, useEffect } from 'react';
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
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { formatSlaPreview, isTerminalStatus } from '@/lib/leadSla';

interface StatusFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  status: {
    id: string;
    name: string;
    color: string;
    sort_order: number;
    sla_idle_days?: number | null;
    sla_stage_days?: number | null;
    sla_followup_intent?: string | null;
  } | null;
  onSuccess: () => void;
}

export function StatusFormDialog({ open, onOpenChange, status, onSuccess }: StatusFormDialogProps) {
  const [name, setName] = useState('');
  const [color, setColor] = useState('#6B7280');
  const [sortOrder, setSortOrder] = useState(0);
  const [slaIdle, setSlaIdle] = useState('');
  const [slaStage, setSlaStage] = useState('');
  const [intent, setIntent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (status) {
      setName(status.name);
      setColor(status.color);
      setSortOrder(status.sort_order);
      setSlaIdle(status.sla_idle_days != null ? String(status.sla_idle_days) : '');
      setSlaStage(status.sla_stage_days != null ? String(status.sla_stage_days) : '');
      setIntent(status.sla_followup_intent ?? '');
    } else {
      setName('');
      setColor('#6B7280');
      setSortOrder(0);
      setSlaIdle('7');
      setSlaStage('14');
      setIntent('Nudge the next step for this stage. Stay brief and specific.');
    }
  }, [status, open]);

  const parseDays = (v: string) => {
    const n = Number(v);
    if (!v.trim() || !Number.isFinite(n) || n <= 0) return null;
    return Math.round(n);
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast({ variant: 'destructive', title: 'Name required' });
      return;
    }
    const sla_idle_days = parseDays(slaIdle);
    const sla_stage_days = parseDays(slaStage);
    const sla_followup_intent = isTerminalStatus(name) ? null : intent.trim() || null;
    setSubmitting(true);
    const payload = {
      name: name.trim(),
      color,
      sort_order: sortOrder,
      sla_idle_days,
      sla_stage_days,
      sla_followup_intent,
    };
    if (status) {
      const { error } = await supabase.from('lead_statuses').update(payload).eq('id', status.id);
      if (error) {
        toast({ variant: 'destructive', title: 'Error', description: error.message });
        setSubmitting(false);
        return;
      }
      toast({ title: 'Status updated' });
    } else {
      const { error } = await supabase.from('lead_statuses').insert(payload);
      if (error) {
        toast({ variant: 'destructive', title: 'Error', description: error.message });
        setSubmitting(false);
        return;
      }
      toast({ title: 'Status added' });
    }
    setSubmitting(false);
    onOpenChange(false);
    onSuccess();
  };

  const terminal = isTerminalStatus(name);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{status ? 'Edit status' : 'Add status'}</DialogTitle>
          <DialogDescription>Pipeline stage, color, and SLA clocks.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Qualified" />
          </div>
          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex gap-2 items-center">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-10 w-14 rounded border cursor-pointer"
              />
              <Input value={color} onChange={(e) => setColor(e.target.value)} className="font-mono" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Sort order</Label>
            <Input
              type="number"
              min={0}
              value={sortOrder}
              onChange={(e) => setSortOrder(Number(e.target.value) || 0)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Activity SLA (days)</Label>
              <Input
                type="number"
                min={0}
                placeholder="Off"
                value={slaIdle}
                onChange={(e) => setSlaIdle(e.target.value)}
                disabled={terminal}
              />
            </div>
            <div className="space-y-2">
              <Label>Time in stage (days)</Label>
              <Input
                type="number"
                min={0}
                placeholder="Off"
                value={slaStage}
                onChange={(e) => setSlaStage(e.target.value)}
                disabled={terminal}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Preview: {terminal ? 'No SLA' : formatSlaPreview(parseDays(slaIdle), parseDays(slaStage))}. Empty or 0 turns a clock off.
          </p>
          {!terminal && (
            <div className="space-y-2">
              <Label>Follow-up intent</Label>
              <Textarea
                value={intent}
                onChange={(e) => setIntent(e.target.value.slice(0, 280))}
                rows={3}
                className="text-sm"
                placeholder="One sentence for AI drafts"
              />
              <p className="text-[11px] text-muted-foreground">{intent.length}/280</p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting} className="gradient-primary">
            {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {status ? 'Save' : 'Add'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
