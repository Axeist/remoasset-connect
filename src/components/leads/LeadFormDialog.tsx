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
import { Switch } from '@/components/ui/switch';
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
  vendor_type: z.string().optional(),
  warehouse_available: z.boolean().default(false),
  warehouse_location: z.string().optional(),
  warehouse_notes: z.string().optional(),
  warehouse_price: z.string().optional(),
  warehouse_currency: z.string().default('USD'),
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
      vendor_type: '',
      warehouse_available: false,
      warehouse_location: '',
      warehouse_notes: '',
      warehouse_price: '',
      warehouse_currency: 'USD',
      notes: '',
    },
  });

  const [statuses, setStatuses] = useState<LeadStatusOption[]>([]);
  const [countries, setCountries] = useState<CountryOption[]>([]);
  const warehouseAvailable = form.watch('warehouse_available');

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
        vendor_type: (lead as any).vendor_type ?? '',
        warehouse_available: (lead as any).warehouse_available ?? false,
        warehouse_location: (lead as any).warehouse_location ?? '',
        warehouse_notes: (lead as any).warehouse_notes ?? '',
        warehouse_price: (lead as any).warehouse_price?.toString() ?? '',
        warehouse_currency: (lead as any).warehouse_currency ?? 'USD',
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
        vendor_type: '',
        warehouse_available: false,
        warehouse_location: '',
        warehouse_notes: '',
        warehouse_price: '',
        warehouse_currency: 'USD',
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
      vendor_type: values.vendor_type || null,
      warehouse_available: values.warehouse_available,
      warehouse_location: values.warehouse_available ? (values.warehouse_location || null) : null,
      warehouse_notes: values.warehouse_available ? (values.warehouse_notes || null) : null,
      warehouse_price: values.warehouse_available && values.warehouse_price ? parseFloat(values.warehouse_price) : null,
      warehouse_currency: values.warehouse_available ? values.warehouse_currency : null,
      lead_score: 0,
      notes: values.notes || null,
      ...(lead ? {} : { owner_id: user?.id ?? null }),
    };

    if (lead) {
      // Track changes for activity log
      const changes: string[] = [];
      if (lead.company_name !== values.company_name) changes.push(`Company name: ${lead.company_name} → ${values.company_name}`);
      if (lead.contact_name !== (values.contact_name || null)) changes.push(`Contact name: ${lead.contact_name || 'None'} → ${values.contact_name || 'None'}`);
      if (lead.email !== (values.email || null)) changes.push(`Email: ${lead.email || 'None'} → ${values.email || 'None'}`);
      if (lead.phone !== (values.phone || null)) changes.push(`Phone: ${lead.phone || 'None'} → ${values.phone || 'None'}`);
      if ((lead as any).vendor_type !== (values.vendor_type || null)) changes.push(`Vendor type updated`);
      if ((lead as any).warehouse_available !== values.warehouse_available) changes.push(`Warehouse available: ${(lead as any).warehouse_available ? 'Yes' : 'No'} → ${values.warehouse_available ? 'Yes' : 'No'}`);
      
      const { error } = await supabase.from('leads').update(payload).eq('id', lead.id);
      if (error) {
        toast({ variant: 'destructive', title: 'Error', description: error.message });
        return;
      }
      
      // Log activity if there were changes
      if (changes.length > 0 && user) {
        await supabase.from('lead_activities').insert({
          lead_id: lead.id,
          user_id: user.id,
          activity_type: 'note',
          description: `Lead updated: ${changes.join(', ')}`,
        });
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
              <Label>Vendor Type</Label>
              <Select
                value={form.watch('vendor_type') || 'none'}
                onValueChange={(v) => form.setValue('vendor_type', v === 'none' ? '' : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select vendor type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No vendor type</SelectItem>
                  <SelectItem value="new_device">New Device</SelectItem>
                  <SelectItem value="refurbished">Refurbished</SelectItem>
                  <SelectItem value="rental">Rental</SelectItem>
                </SelectContent>
              </Select>
            </div>
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
          
          {/* Warehouse Section */}
          <div className="space-y-4 pt-2 border-t">
            <div className="flex items-center justify-between">
              <Label htmlFor="warehouse_available" className="cursor-pointer">
                Warehouse Available
              </Label>
              <Switch
                id="warehouse_available"
                checked={form.watch('warehouse_available')}
                onCheckedChange={(checked) => form.setValue('warehouse_available', checked)}
              />
            </div>
            
            {warehouseAvailable && (
              <div className="space-y-4 animate-fade-in">
                <div className="space-y-2">
                  <Label htmlFor="warehouse_location">Warehouse Location</Label>
                  <Input
                    id="warehouse_location"
                    {...form.register('warehouse_location')}
                    placeholder="Enter warehouse location"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="warehouse_notes">Warehouse Notes</Label>
                  <Textarea
                    id="warehouse_notes"
                    {...form.register('warehouse_notes')}
                    placeholder="Additional warehouse notes..."
                    rows={2}
                    className="resize-none"
                  />
                </div>
                
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="warehouse_price">Warehouse Price</Label>
                    <Input
                      id="warehouse_price"
                      type="number"
                      step="0.01"
                      {...form.register('warehouse_price')}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Currency</Label>
                    <Select
                      value={form.watch('warehouse_currency')}
                      onValueChange={(v) => form.setValue('warehouse_currency', v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="USD">USD ($)</SelectItem>
                        <SelectItem value="EUR">EUR (€)</SelectItem>
                        <SelectItem value="GBP">GBP (£)</SelectItem>
                        <SelectItem value="INR">INR (₹)</SelectItem>
                        <SelectItem value="AUD">AUD (A$)</SelectItem>
                        <SelectItem value="CAD">CAD (C$)</SelectItem>
                        <SelectItem value="JPY">JPY (¥)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}
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
