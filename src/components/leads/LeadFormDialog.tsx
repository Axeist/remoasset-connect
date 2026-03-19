import { useEffect, useRef, useState } from 'react';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Lead, LeadStatusOption, CountryOption, LeadContact } from '@/types/lead';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Trash2, UserPlus, ChevronDown, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const WON_PATTERNS = ['won', 'closed won', 'closed-won'];

const leadFormSchema = z.object({
  company_name: z.string().min(1, 'Company name is required'),
  website: z.string().min(1, 'Website is required').url('Invalid URL'),
  email: z.preprocess((v) => (v === '' ? undefined : v), z.string().email('Invalid email').optional()),
  phone: z.string().optional(),
  contact_name: z.string().optional(),
  contact_designation: z.string().optional(),
  hq_country_id: z.string().uuid('Invalid country').optional().or(z.literal('')),
  country_ids: z.array(z.string().uuid()),
  status_id: z.string().min(1, 'Status is required').uuid('Invalid status'),
  vendor_types: z.array(z.enum(['new_device', 'refurbished', 'rental', 'warehouse'])).min(1, 'Select at least one vendor type'),
  warehouse_available: z.boolean().default(false),
  warehouse_location: z.string().optional(),
  warehouse_notes: z.string().optional(),
  warehouse_price: z.string().optional(),
  warehouse_currency: z.string().default('USD'),
  notes: z.string().optional(),
});

type LeadFormValues = z.infer<typeof leadFormSchema>;

const emptyContact = (): LeadContact => ({ name: '', email: '', phone: '', designation: '' });

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
      hq_country_id: '',
      country_ids: [],
      status_id: '',
      vendor_types: [],
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
  const [additionalContacts, setAdditionalContacts] = useState<LeadContact[]>([]);
  const [countrySearch, setCountrySearch] = useState('');
  const [countryDropdownOpen, setCountryDropdownOpen] = useState(false);
  const [hqSearch, setHqSearch] = useState('');
  const [hqDropdownOpen, setHqDropdownOpen] = useState(false);
  const hqDropdownRef = useRef<HTMLDivElement>(null);
  const countryDropdownRef = useRef<HTMLDivElement>(null);
  const warehouseAvailable = form.watch('warehouse_available');
  const selectedCountryIds = form.watch('country_ids') ?? [];
  const selectedHqId = form.watch('hq_country_id') ?? '';

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
        hq_country_id: lead.hq_country_id ?? '',
        country_ids: Array.isArray(lead.country_ids) ? lead.country_ids : [],
        status_id: lead.status_id ?? '',
        vendor_types: Array.isArray((lead as any).vendor_types)
          ? (lead as any).vendor_types
          : (lead as any).vendor_type
            ? [(lead as any).vendor_type]
            : [],
        warehouse_available: (lead as any).warehouse_available ?? false,
        warehouse_location: (lead as any).warehouse_location ?? '',
        warehouse_notes: (lead as any).warehouse_notes ?? '',
        warehouse_price: (lead as any).warehouse_price?.toString() ?? '',
        warehouse_currency: (lead as any).warehouse_currency ?? 'USD',
        notes: lead.notes ?? '',
      });
      setAdditionalContacts(
        Array.isArray(lead.additional_contacts) ? lead.additional_contacts : []
      );
    } else {
      form.reset({
        company_name: '',
        website: '',
        email: '',
        phone: '',
        contact_name: '',
        contact_designation: '',
        hq_country_id: '',
        country_ids: [],
        status_id: statuses[0]?.id ?? '',
        vendor_types: [],
        warehouse_available: false,
        warehouse_location: '',
        warehouse_notes: '',
        warehouse_price: '',
        warehouse_currency: 'USD',
        notes: '',
      });
      setAdditionalContacts([]);
    }
  }, [lead, form, statuses.length]);

  const updateContact = (idx: number, field: keyof LeadContact, value: string) => {
    setAdditionalContacts((prev) => prev.map((c, i) => (i === idx ? { ...c, [field]: value } : c)));
  };

  const removeContact = (idx: number) => {
    setAdditionalContacts((prev) => prev.filter((_, i) => i !== idx));
  };

  const toggleCountry = (id: string) => {
    const current = form.getValues('country_ids') ?? [];
    const next = current.includes(id) ? current.filter((c) => c !== id) : [...current, id];
    form.setValue('country_ids', next, { shouldValidate: true });
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (countryDropdownRef.current && !countryDropdownRef.current.contains(e.target as Node)) {
        setCountryDropdownOpen(false);
      }
    };
    if (countryDropdownOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [countryDropdownOpen]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (hqDropdownRef.current && !hqDropdownRef.current.contains(e.target as Node)) {
        setHqDropdownOpen(false);
      }
    };
    if (hqDropdownOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [hqDropdownOpen]);

  const onSubmit = async (values: LeadFormValues) => {
    const selectedStatus = statuses.find((s) => s.id === values.status_id);
    if (selectedStatus && WON_PATTERNS.includes(selectedStatus.name.toLowerCase())) {
      const missing: string[] = [];
      if (!values.contact_name?.trim()) missing.push('Contact Name');
      if (!values.contact_designation?.trim()) missing.push('Designation');
      if (!values.phone?.trim()) missing.push('Phone');
      if (!values.email?.trim()) missing.push('Email');
      if (missing.length > 0) {
        toast({ variant: 'destructive', title: 'Cannot set status to Closed Won', description: `Primary contact is incomplete: ${missing.join(', ')}` });
        return;
      }
    }

    const cleanContacts = additionalContacts.filter((c) => c.name.trim() || c.email.trim() || c.phone.trim());

    const payload: Record<string, any> = {
      company_name: values.company_name,
      website: values.website,
      email: values.email?.trim() || null,
      phone: values.phone || null,
      contact_name: values.contact_name || null,
      contact_designation: values.contact_designation || null,
      hq_country_id: values.hq_country_id || null,
      country_ids: values.country_ids,
      status_id: values.status_id,
      vendor_types: values.vendor_types,
      warehouse_available: values.warehouse_available,
      warehouse_location: values.warehouse_available ? (values.warehouse_location || null) : null,
      warehouse_notes: values.warehouse_available ? (values.warehouse_notes || null) : null,
      warehouse_price: values.warehouse_available && values.warehouse_price ? parseFloat(values.warehouse_price) : null,
      warehouse_currency: values.warehouse_available ? values.warehouse_currency : null,
      lead_score: 0,
      notes: values.notes?.trim() || null,
      additional_contacts: cleanContacts,
      ...(lead ? {} : { owner_id: user?.id ?? null }),
    };

    if (lead) {
      const changes: string[] = [];
      if (lead.company_name !== values.company_name) changes.push(`Company name: ${lead.company_name} → ${values.company_name}`);
      if (lead.contact_name !== (values.contact_name || null)) changes.push(`Contact name: ${lead.contact_name || 'None'} → ${values.contact_name || 'None'}`);
      if (lead.email !== (values.email || null)) changes.push(`Email: ${lead.email || 'None'} → ${values.email || 'None'}`);
      if (lead.phone !== (values.phone || null)) changes.push(`Phone: ${lead.phone || 'None'} → ${values.phone || 'None'}`);
      const prevTypes = Array.isArray((lead as any).vendor_types) ? (lead as any).vendor_types : (lead as any).vendor_type ? [(lead as any).vendor_type] : [];
      const same = prevTypes.length === values.vendor_types.length && values.vendor_types.every((t: string) => prevTypes.includes(t));
      if (!same) changes.push(`Vendor types updated`);
      if ((lead as any).warehouse_available !== values.warehouse_available) changes.push(`Warehouse available: ${(lead as any).warehouse_available ? 'Yes' : 'No'} → ${values.warehouse_available ? 'Yes' : 'No'}`);
      const prevContacts = Array.isArray(lead.additional_contacts) ? lead.additional_contacts.length : 0;
      if (prevContacts !== cleanContacts.length) changes.push(`Additional contacts: ${prevContacts} → ${cleanContacts.length}`);

      const { error } = await supabase.from('leads').update(payload).eq('id', lead.id);
      if (error) {
        toast({ variant: 'destructive', title: 'Error', description: error.message });
        return;
      }

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
      const { data: newLead, error } = await supabase.from('leads').insert(payload).select('id').single();
      if (error) {
        toast({ variant: 'destructive', title: 'Error', description: error.message });
        return;
      }
      toast({ title: 'Lead created', description: 'New lead added successfully.' });
      // Fire Slack notification (non-blocking)
      const selectedStatus = statuses.find((s) => s.id === values.status_id);
      const firstCountry = countries.find((c) => c.id === values.country_ids[0]);
      supabase.functions.invoke('slack-notify', {
        body: {
          event: 'lead_created',
          payload: {
            company_name: values.company_name,
            contact_name: values.contact_name || null,
            status: selectedStatus?.name || null,
            country: firstCountry?.name || null,
            lead_score: 0,
            lead_id: newLead?.id ?? '',
          },
        },
      }).catch(() => {/* silent fail */});
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
              <Label htmlFor="website">Website *</Label>
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

          {/* Primary Contact */}
          <div className="space-y-3 rounded-lg border p-4">
            <div className="flex items-center gap-2">
              <Label className="text-sm font-semibold">Primary Contact</Label>
              <Badge variant="secondary" className="text-[10px]">Used for communication</Badge>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="contact_name" className="text-xs">Name</Label>
                <Input id="contact_name" {...form.register('contact_name')} placeholder="John Doe" className="h-9" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="contact_designation" className="text-xs">Designation</Label>
                <Input id="contact_designation" {...form.register('contact_designation')} placeholder="Procurement Manager" className="h-9" />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="email" className="text-xs">Email</Label>
                <Input id="email" type="email" {...form.register('email')} placeholder="contact@acme.com" className="h-9" />
                {form.formState.errors.email && (
                  <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
                )}
              </div>
              <div className="space-y-1">
                <Label htmlFor="phone" className="text-xs">Phone</Label>
                <Input id="phone" {...form.register('phone')} placeholder="+1 234 567 8900" className="h-9" />
              </div>
            </div>
          </div>

          {/* Additional Contacts */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold flex items-center gap-1.5">
                <UserPlus className="h-3.5 w-3.5" />
                Additional Contacts ({additionalContacts.length})
              </Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => setAdditionalContacts((prev) => [...prev, emptyContact()])}
              >
                <Plus className="h-3 w-3" />
                Add Contact
              </Button>
            </div>

            {additionalContacts.map((contact, idx) => (
              <div key={idx} className="rounded-lg border border-dashed p-3 space-y-2 relative group">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground font-medium">Contact #{idx + 2}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-destructive"
                    onClick={() => removeContact(idx)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Input
                    placeholder="Name"
                    value={contact.name}
                    onChange={(e) => updateContact(idx, 'name', e.target.value)}
                    className="h-8 text-sm"
                  />
                  <Input
                    placeholder="Designation"
                    value={contact.designation}
                    onChange={(e) => updateContact(idx, 'designation', e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Input
                    type="email"
                    placeholder="Email"
                    value={contact.email}
                    onChange={(e) => updateContact(idx, 'email', e.target.value)}
                    className="h-8 text-sm"
                  />
                  <Input
                    placeholder="Phone"
                    value={contact.phone}
                    onChange={(e) => updateContact(idx, 'phone', e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>HQ Country</Label>
              <div ref={hqDropdownRef} className="relative">
                <button
                  type="button"
                  onClick={() => setHqDropdownOpen((v) => !v)}
                  className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                  <span className="truncate text-left">
                    {selectedHqId
                      ? (countries.find((c) => c.id === selectedHqId)?.name ?? 'Select HQ country…')
                      : 'Select HQ country…'}
                  </span>
                  <div className="flex items-center gap-1 ml-2 shrink-0">
                    {selectedHqId && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); form.setValue('hq_country_id', ''); }}
                        className="rounded hover:text-destructive"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <ChevronDown className="h-4 w-4 opacity-50" />
                  </div>
                </button>
                {hqDropdownOpen && (
                  <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md">
                    <div className="p-2 border-b">
                      <Input
                        autoFocus
                        placeholder="Search…"
                        value={hqSearch}
                        onChange={(e) => setHqSearch(e.target.value)}
                        className="h-8 text-sm"
                        onKeyDown={(e) => e.stopPropagation()}
                      />
                    </div>
                    <div className="max-h-48 overflow-y-auto p-1">
                      {countries
                        .filter((c) =>
                          c.name.toLowerCase().includes(hqSearch.toLowerCase()) ||
                          c.code.toLowerCase().includes(hqSearch.toLowerCase())
                        )
                        .map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => { form.setValue('hq_country_id', c.id, { shouldValidate: true }); setHqDropdownOpen(false); setHqSearch(''); }}
                            className={`flex w-full items-center gap-2 px-2 py-1.5 rounded hover:bg-accent text-sm text-left ${selectedHqId === c.id ? 'bg-accent' : ''}`}
                          >
                            <span className="text-xs font-mono text-muted-foreground w-8 shrink-0">{c.code}</span>
                            {c.name}
                          </button>
                        ))}
                      {countries.filter((c) =>
                        c.name.toLowerCase().includes(hqSearch.toLowerCase()) ||
                        c.code.toLowerCase().includes(hqSearch.toLowerCase())
                      ).length === 0 && (
                        <p className="px-2 py-3 text-sm text-center text-muted-foreground">No countries found</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Countries Served</Label>
              <div ref={countryDropdownRef} className="relative">
                <button
                  type="button"
                  onClick={() => setCountryDropdownOpen((v) => !v)}
                  className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                  <span className="truncate text-left">
                    {selectedCountryIds.length === 0
                      ? 'Select countries served…'
                      : selectedCountryIds.length === 1
                        ? countries.find((c) => c.id === selectedCountryIds[0])?.name ?? '1 country'
                        : `${selectedCountryIds.length} countries selected`}
                  </span>
                  <ChevronDown className="h-4 w-4 shrink-0 opacity-50 ml-2" />
                </button>
                {countryDropdownOpen && (
                  <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md">
                    <div className="p-2 border-b">
                      <Input
                        autoFocus
                        placeholder="Search countries…"
                        value={countrySearch}
                        onChange={(e) => setCountrySearch(e.target.value)}
                        className="h-8 text-sm"
                        onKeyDown={(e) => e.stopPropagation()}
                      />
                    </div>
                    <div className="max-h-48 overflow-y-auto p-1">
                      {countries
                        .filter((c) =>
                          c.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
                          c.code.toLowerCase().includes(countrySearch.toLowerCase())
                        )
                        .map((c) => {
                          const checked = selectedCountryIds.includes(c.id);
                          return (
                            <label
                              key={c.id}
                              className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer text-sm"
                            >
                              <Checkbox
                                checked={checked}
                                onCheckedChange={() => toggleCountry(c.id)}
                                onClick={(e) => e.stopPropagation()}
                              />
                              <span className="text-xs font-mono text-muted-foreground w-8 shrink-0">{c.code}</span>
                              {c.name}
                            </label>
                          );
                        })}
                      {countries.filter((c) =>
                        c.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
                        c.code.toLowerCase().includes(countrySearch.toLowerCase())
                      ).length === 0 && (
                        <p className="px-2 py-3 text-sm text-center text-muted-foreground">No countries found</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
              {selectedCountryIds.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {selectedCountryIds.map((id) => {
                    const c = countries.find((x) => x.id === id);
                    if (!c) return null;
                    return (
                      <Badge key={id} variant="secondary" className="gap-1 text-xs pr-1">
                        {c.code}
                        <button
                          type="button"
                          onClick={() => toggleCountry(id)}
                          className="ml-0.5 rounded hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Vendor Type *</Label>
            <p className="text-xs text-muted-foreground">Select all that apply</p>
            <div className="flex flex-wrap gap-4 pt-1">
              {[
                { value: 'new_device' as const, label: 'New Device' },
                { value: 'refurbished' as const, label: 'Refurbished' },
                { value: 'rental' as const, label: 'Rental' },
                { value: 'warehouse' as const, label: 'Warehouse' },
              ].map(({ value, label }) => {
                const types = form.watch('vendor_types') ?? [];
                const checked = types.includes(value);
                return (
                  <label
                    key={value}
                    className="flex items-center gap-2 cursor-pointer text-sm font-medium"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(c) => {
                        const next = c ? [...types, value] : types.filter((t) => t !== value);
                        form.setValue('vendor_types', next);
                        if (next.length === 1 && next[0] === 'warehouse') {
                          form.setValue('warehouse_available', true);
                        }
                      }}
                    />
                    {label}
                  </label>
                );
              })}
            </div>
            {form.formState.errors.vendor_types && (
              <p className="text-sm text-destructive">{form.formState.errors.vendor_types.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Status *</Label>
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
            {form.formState.errors.status_id && (
              <p className="text-sm text-destructive">{form.formState.errors.status_id.message}</p>
            )}
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
            {form.formState.errors.notes && (
              <p className="text-sm text-destructive">{form.formState.errors.notes.message}</p>
            )}
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
