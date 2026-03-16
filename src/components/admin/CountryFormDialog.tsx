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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { REGIONS } from '@/components/leads/LeadsFilters';

interface CountryFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  country: { id: string; name: string; code: string; region?: string | null } | null;
  onSuccess: () => void;
}

function toTitleCase(s: string): string {
  return s.trim().replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

export function CountryFormDialog({ open, onOpenChange, country, onSuccess }: CountryFormDialogProps) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [region, setRegion] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (country) {
      setName(country.name);
      setCode(country.code);
      setRegion((country as { region?: string | null }).region ?? '');
    } else {
      setName('');
      setCode('');
      setRegion('');
    }
  }, [country, open]);

  const handleSubmit = async () => {
    if (!name.trim() || !code.trim()) {
      toast({ variant: 'destructive', title: 'Name and code required' });
      return;
    }
    const nameTitleCase = toTitleCase(name);
    setSubmitting(true);
    if (country) {
      const { error } = await supabase
        .from('countries')
        .update({
          name: nameTitleCase,
          code: code.trim().toUpperCase(),
          region: region || null,
        })
        .eq('id', country.id);
      if (error) {
        toast({ variant: 'destructive', title: 'Error', description: error.message });
        setSubmitting(false);
        return;
      }
      toast({ title: 'Country updated' });
    } else {
      const { error } = await supabase
        .from('countries')
        .insert({
          name: nameTitleCase,
          code: code.trim().toUpperCase(),
          region: region || null,
        });
      if (error) {
        toast({ variant: 'destructive', title: 'Error', description: error.message });
        setSubmitting(false);
        return;
      }
      toast({ title: 'Country added' });
    }
    setSubmitting(false);
    onOpenChange(false);
    onSuccess();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{country ? 'Edit country' : 'Add country'}</DialogTitle>
          <DialogDescription>Country name and 2-letter code.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. United States" />
          </div>
          <div className="space-y-2">
            <Label>Code</Label>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 2))}
              placeholder="e.g. US"
              maxLength={2}
              className="uppercase"
            />
          </div>
          <div className="space-y-2">
            <Label>Region</Label>
            <Select value={region || 'none'} onValueChange={(v) => setRegion(v === 'none' ? '' : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select region" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No region</SelectItem>
                {REGIONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting} className="gradient-primary">
            {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {country ? 'Save' : 'Add'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
