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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save } from 'lucide-react';

export interface TargetRow {
  activity_type: string;
  period: string;
  target_count: number;
}

const ACTIVITY_LABELS: Record<string, string> = {
  email: 'Outbound Emails',
  call: 'Calls / Meetings Scheduled',
  meeting: 'Meetings / Demos',
  linkedin: 'LinkedIn Outreach',
  whatsapp: 'WhatsApp Messages',
  nda: 'NDAs Signed',
  deal_closed: 'Deals Closed',
};

const ACTIVITY_ORDER = ['email', 'call', 'meeting', 'linkedin', 'whatsapp', 'nda', 'deal_closed'];
const PERIODS = ['daily', 'weekly', 'monthly'] as const;

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
  const [period, setPeriod] = useState<string>('weekly');

  const [draft, setDraft] = useState<Record<string, Record<string, number>>>({});

  useEffect(() => {
    const map: Record<string, Record<string, number>> = {};
    ACTIVITY_ORDER.forEach((act) => {
      map[act] = {};
      PERIODS.forEach((p) => {
        const found = targets.find((t) => t.activity_type === act && t.period === p);
        map[act][p] = found?.target_count ?? 0;
      });
    });
    setDraft(map);
  }, [targets, open]);

  const updateValue = (act: string, p: string, val: number) => {
    setDraft((prev) => ({
      ...prev,
      [act]: { ...prev[act], [p]: val },
    }));
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);

    const upserts: { activity_type: string; period: string; target_count: number; updated_by: string }[] = [];
    ACTIVITY_ORDER.forEach((act) => {
      PERIODS.forEach((p) => {
        upserts.push({
          activity_type: act,
          period: p,
          target_count: draft[act]?.[p] ?? 0,
          updated_by: user.id,
        });
      });
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
            Set the expected number of activities per employee. These targets apply to all team members.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={period} onValueChange={setPeriod}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="daily">Daily</TabsTrigger>
            <TabsTrigger value="weekly">Weekly</TabsTrigger>
            <TabsTrigger value="monthly">Monthly</TabsTrigger>
          </TabsList>

          {PERIODS.map((p) => (
            <TabsContent key={p} value={p} className="space-y-3 mt-4">
              {ACTIVITY_ORDER.map((act) => (
                <div key={act} className="flex items-center justify-between gap-4">
                  <label className="text-sm font-medium min-w-0 flex-1">{ACTIVITY_LABELS[act]}</label>
                  <Input
                    type="number"
                    min={0}
                    value={draft[act]?.[p] ?? 0}
                    onChange={(e) => updateValue(act, p, Math.max(0, Number(e.target.value) || 0))}
                    className="w-24 h-9 text-sm text-right"
                  />
                </div>
              ))}
            </TabsContent>
          ))}
        </Tabs>

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
