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
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

interface StatusFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  status: { id: string; name: string; color: string; sort_order: number } | null;
  onSuccess: () => void;
}

export function StatusFormDialog({ open, onOpenChange, status, onSuccess }: StatusFormDialogProps) {
  const [name, setName] = useState('');
  const [color, setColor] = useState('#6B7280');
  const [sortOrder, setSortOrder] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (status) {
      setName(status.name);
      setColor(status.color);
      setSortOrder(status.sort_order);
    } else {
      setName('');
      setColor('#6B7280');
      setSortOrder(0);
    }
  }, [status, open]);

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast({ variant: 'destructive', title: 'Name required' });
      return;
    }
    setSubmitting(true);
    if (status) {
      const { error } = await supabase
        .from('lead_statuses')
        .update({ name: name.trim(), color, sort_order: sortOrder })
        .eq('id', status.id);
      if (error) {
        toast({ variant: 'destructive', title: 'Error', description: error.message });
        setSubmitting(false);
        return;
      }
      toast({ title: 'Status updated' });
    } else {
      const { error } = await supabase
        .from('lead_statuses')
        .insert({ name: name.trim(), color, sort_order: sortOrder });
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{status ? 'Edit status' : 'Add status'}</DialogTitle>
          <DialogDescription>Lead pipeline status with color.</DialogDescription>
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
