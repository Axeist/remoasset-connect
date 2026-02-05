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
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Lead, LeadStatusOption, CountryOption } from '@/types/lead';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

const leadFormSchema = z.object({
  company_name: z.string().min(1, 'Company name is required'),
  website: z.string().url('Invalid URL').optional().or(z.literal('')),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().optional(),
  contact_name: z.string().optional(),
  contact_designation: z.string().optional(),
  country_id: z.string().uuid().optional().or(z.literal('')),
  status_id: z.string().uuid().optional().or(z.literal('')),
  lead_score: z.number().min(1).max(100),
  notes: z.string().optional(),
});

type LeadFormValues = z.infer<typeof leadFormSchema>;

interface LeadFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead?: Lead | null;
  onSuccess: () => void;
}

export function LeadFormDialog({ open, onOpenChange, lead, onSuccess }: LeadFormDialogProps) {
  const { user, role } = useAuth();
  const { toast } = useToast();

  const form = useForm<LeadFormValues>({
    resolver: zodResolver(leadFormSchema),
    defaultValues: {
      company_name: '',
      website: '',
      email: '',
      phone: '',
      contact_name: '',
      contact_designation: '',
      country_id: '',
      status_id: '',
      lead_score: 50,
      notes: '',
    },
  });

  const [statuses, setStatuses] = useState<LeadStatusOption[]>([]);
  const [countries, setCountries] = useState<CountryOption[]>([]);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const [sRes, cRes] = await Promise.all([
        supabase.from('lead_statuses').select('id, name, color, sort_order').order('sort_order'),
        supabase.from('countries').select('id, name, code').order('name'),
      ]);
      if (sRes.data) setStatuses(sRes.data);
      if (cRes.data) setCountries(cRes.data);
    })();
  }, [open]);

  useEffect(() => {
    if (lead) {
      form.reset({
        company_name: lead.company_name,
        website: lead.website ?? '',
        email: lead.email ?? '',
        phone: lead.phone ?? '',
        contact_name: lead.contact_name ?? '',
        contact_designation: lead.contact_designation ?? '',
        country_id: lead.country_id ?? '',
        status_id: lead.status_id ?? '',
        lead_score: lead.lead_score ?? 50,
        notes: lead.notes ?? '',
      });
    } else {
      form.reset({
        company_name: '',
        website: '',
        email: '',
        phone: '',
        contact_name: '',
        contact_designation: '',
        country_id: '',
        status_id: statuses[0]?.id ?? '',
        lead_score: 50,
        notes: '',
      });
    }
  }, [lead, form, statuses.length]);

  const onSubmit = async (values: LeadFormValues) => {
    const payload = {
      company_name: values.company_name,
      website: values.website || null,
      email: values.email || null,
      phone: values.phone || null,
      contact_name: values.contact_name || null,
      contact_designation: values.contact_designation || null,
      country_id: values.country_id || null,
      status_id: values.status_id || null,
      lead_score: values.lead_score,
      notes: values.notes || null,
      ...(lead ? {} : { owner_id: user?.id ?? null }),
    };

    if (lead) {
      const { error } = await supabase.from('leads').update(payload).eq('id', lead.id);
      if (error) {
        toast({ variant: 'destructive', title: 'Error', description: error.message });
        return;
      }
      toast({ title: 'Lead updated', description: 'Changes saved successfully.' });
    } else {
      const { error } = await supabase.from('leads').insert(payload);
      if (error) {
        toast({ variant: 'destructive', title: 'Error', description: error.message });
        return;
      }
      toast({ title: 'Lead created', description: 'New lead added successfully.' });
    }
    onOpenChange(false);
    onSuccess();
  };

  const isEditing = !!lead;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Lead' : 'Add Lead'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Update lead information below.'
              : 'Add a new lead with company and contact details.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="company_name">Company name *</Label>
              <Input
                id="company_name"
                {...form.register('company_name')}
                placeholder="Acme Inc."
              />
              {form.formState.errors.company_name && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.company_name.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                type="url"
                {...form.register('website')}
                placeholder="https://acme.com"
              />
              {form.formState.errors.website && (
                <p className="text-sm text-destructive">{form.formState.errors.website.message}</p>
              )}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                {...form.register('email')}
                placeholder="contact@acme.com"
              />
              {form.formState.errors.email && (
                <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" {...form.register('phone')} placeholder="+1 234 567 8900" />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="contact_name">Contact name</Label>
              <Input id="contact_name" {...form.register('contact_name')} placeholder="John Doe" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact_designation">Designation</Label>
              <Input
                id="contact_designation"
                {...form.register('contact_designation')}
                placeholder="Procurement Manager"
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Country</Label>
              <Select
                value={form.watch('country_id') || 'all'}
                onValueChange={(v) => form.setValue('country_id', v === 'all' ? '' : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select country" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">No country</SelectItem>
                  {countries.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={form.watch('status_id') || 'all'}
                onValueChange={(v) => form.setValue('status_id', v === 'all' ? '' : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">No status</SelectItem>
                  {statuses.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      <span className="flex items-center gap-2">
                        <span
                          className="inline-block w-2 h-2 rounded-full"
                          style={{ backgroundColor: s.color }}
                        />
                        {s.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <Label>Lead score</Label>
              <span className="text-sm font-medium">{form.watch('lead_score')}</span>
            </div>
            <Slider
              min={1}
              max={100}
              step={1}
              value={[form.watch('lead_score')]}
              onValueChange={([v]) => form.setValue('lead_score', v)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              {...form.register('notes')}
              placeholder="Internal notes..."
              rows={3}
              className="resize-none"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" className="gradient-primary" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {isEditing ? 'Save' : 'Create Lead'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
