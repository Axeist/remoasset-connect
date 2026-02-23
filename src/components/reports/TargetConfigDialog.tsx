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
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save } from 'lucide-react';

export interface TargetRow {
  activity_type: string;
  period: string;
  target_count: number;
}

const TARGET_CATEGORIES: { key: string; label: string; description: string }[] = [
  { key: 'outreach', label: 'Outreach', description: 'Emails, calls, LinkedIn & WhatsApp combined' },
  { key: 'meeting', label: 'Meetings / Demos', description: 'Scheduled meetings and demos' },
  { key: 'nda', label: 'NDAs Signed', description: 'NDA agreements received' },
  { key: 'deal_closed', label: 'Deals Closed', description: 'Won deals' },
];

const WEEKLY_MULTIPLIER = 5;
const MONTHLY_MULTIPLIER = 22;

interface TargetConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targets: TargetRow[];
  onSaved: () => void;
}

export function TargetConfigDialog({ open, onOpenChange, targets, onSaved }: TargetConfigDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const [dailyValues, setDailyValues] = useState<Record<string, number>>({});

  useEffect(() => {
    const map: Record<string, number> = {};
    TARGET_CATEGORIES.forEach(({ key }) => {
      const found = targets.find((t) => t.activity_type === key && t.period === 'daily');
      map[key] = found?.target_count ?? 0;
    });
    setDailyValues(map);
  }, [targets, open]);

  const updateValue = (key: string, val: number) => {
    setDailyValues((prev) => ({ ...prev, [key]: val }));
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);

    const upserts: { activity_type: string; period: string; target_count: number; updated_by: string }[] = [];
    TARGET_CATEGORIES.forEach(({ key }) => {
      const daily = dailyValues[key] ?? 0;
      upserts.push(
        { activity_type: key, period: 'daily', target_count: daily, updated_by: user.id },
        { activity_type: key, period: 'weekly', target_count: daily * WEEKLY_MULTIPLIER, updated_by: user.id },
        { activity_type: key, period: 'monthly', target_count: daily * MONTHLY_MULTIPLIER, updated_by: user.id },
      );
    });

    const { error } = await supabase
      .from('productivity_targets')
      .upsert(upserts, { onConflict: 'activity_type,period' });

    if (error) {
      toast({ variant: 'destructive', title: 'Failed to save targets', description: error.message });
    } else {
      toast({ title: 'Targets saved' });
      onSaved();
      onOpenChange(false);
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configure Productivity Targets</DialogTitle>
          <DialogDescription>
            Set daily targets per employee. Weekly (×{WEEKLY_MULTIPLIER}) and monthly (×{MONTHLY_MULTIPLIER}) are auto-calculated.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {TARGET_CATEGORIES.map(({ key, label, description }) => {
            const daily = dailyValues[key] ?? 0;
            return (
              <div key={key} className="space-y-1.5">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-xs text-muted-foreground">{description}</p>
                  </div>
                  <Input
                    type="number"
                    min={0}
                    value={daily}
                    onChange={(e) => updateValue(key, Math.max(0, Number(e.target.value) || 0))}
                    className="w-24 h-9 text-sm text-right"
                    placeholder="Daily"
                  />
                </div>
                <div className="flex gap-4 pl-1 text-xs text-muted-foreground">
                  <span>Weekly: <span className="font-medium text-foreground">{daily * WEEKLY_MULTIPLIER}</span></span>
                  <span>Monthly: <span className="font-medium text-foreground">{daily * MONTHLY_MULTIPLIER}</span></span>
                </div>
              </div>
            );
          })}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Targets
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
