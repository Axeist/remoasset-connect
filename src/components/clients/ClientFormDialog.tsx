import { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { SectionHeader } from '@/components/shared/DeviceSpecForm';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import type { Client } from '@/types/procurement';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  editItem?: Client | null;
}

export function ClientFormDialog({ open, onOpenChange, onSuccess, editItem }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [countries, setCountries] = useState<{ id: string; name: string }[]>([]);

  const [name, setName] = useState('');
  const [countryId, setCountryId] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!open) return;
    supabase.from('countries').select('id, name').order('name').then(({ data }) => {
      if (data) setCountries(data);
    });
  }, [open]);

  useEffect(() => {
    if (editItem) {
      setName(editItem.name);
      setCountryId(editItem.country_id || '');
      setContactName(editItem.contact_name || '');
      setContactEmail(editItem.contact_email || '');
      setContactPhone(editItem.contact_phone || '');
      setNotes(editItem.notes || '');
    } else {
      setName(''); setCountryId(''); setContactName('');
      setContactEmail(''); setContactPhone(''); setNotes('');
    }
  }, [editItem, open]);

  const handleSave = async () => {
    if (!name.trim()) {
      toast({ title: 'Client name required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const payload = {
      name: name.trim(),
      country_id: countryId || null,
      contact_name: contactName || null,
      contact_email: contactEmail || null,
      contact_phone: contactPhone || null,
      notes: notes || null,
      ...(editItem ? {} : { created_by: user?.id }),
    };

    const { error } = editItem
      ? await supabase.from('clients' as any).update(payload).eq('id', editItem.id)
      : await supabase.from('clients' as any).insert(payload);

    setSaving(false);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: editItem ? 'Client updated' : 'Client added' });
      onOpenChange(false);
      onSuccess();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editItem ? 'Edit' : 'Add'} Client</DialogTitle>
          <DialogDescription>Enter the client organization details.</DialogDescription>
        </DialogHeader>
        <div className="space-y-6 py-2">
          {/* 1. Client Info */}
          <div>
            <SectionHeader number={1} title="Client Information" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-sm font-medium">Client Name <span className="text-destructive">*</span></Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Exequt" className="h-10" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Country</Label>
                <Select value={countryId} onValueChange={setCountryId}>
                  <SelectTrigger className="h-10"><SelectValue placeholder="Select country" /></SelectTrigger>
                  <SelectContent>
                    {countries.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* 2. Contact */}
          <div>
            <SectionHeader number={2} title="Contact Details" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Contact Name</Label>
                <Input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Primary contact" className="h-10" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Contact Email</Label>
                <Input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="email@company.com" className="h-10" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Contact Phone</Label>
                <Input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="+1 234 567 890" className="h-10" />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Any additional info about this client..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {editItem ? 'Update' : 'Add'} Client
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
