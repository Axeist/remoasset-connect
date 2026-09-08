import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { VENDOR_TYPE_OPTIONS, type VendorType } from '@/lib/vendorTypes';
import {
  defaultVendorTypesForRfqType,
  formatCountdown,
  isClosedStatusName,
  matchRfqVendors,
  vendorHasAnyType,
  vendorOperatesInCountry,
  type MatchableVendor,
} from '@/lib/rfq';
import { buildInviteEmail } from '@/lib/rfq-email-templates';
import { invokeRfqCampaign } from '@/lib/rfq-api';
import { ArrowLeft, Send, FlaskConical } from 'lucide-react';
import type { RfqType } from '@/types/rfq';
import { RfqWizardRail } from '@/components/rfq/RfqWizardRail';
import { RfqHowToButton } from '@/components/rfq/RfqHowToDialog';

export default function RfqNew() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [clients, setClients] = useState<{ id: string; name: string; country_id: string | null }[]>([]);
  const [countries, setCountries] = useState<{ id: string; name: string }[]>([]);
  const [vendors, setVendors] = useState<MatchableVendor[]>([]);
  const [rfqType, setRfqType] = useState<RfqType>('fulfillment');
  const [vendorTypes, setVendorTypes] = useState<VendorType[]>(['new_device']);
  const [clientKind, setClientKind] = useState<'active' | 'prospecting'>('active');
  const [clientId, setClientId] = useState('');
  const [prospectName, setProspectName] = useState('');
  const [countryId, setCountryId] = useState('');
  const [scope, setScope] = useState('');
  const [qty, setQty] = useState('1');
  const [deadlineLocal, setDeadlineLocal] = useState(() => {
    const d = new Date(Date.now() + 48 * 3600_000);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  });
  const [extraCc, setExtraCc] = useState('');
  const [selectedVendorIds, setSelectedVendorIds] = useState<Set<string>>(new Set());
  const [subject, setSubject] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [bodyText, setBodyText] = useState('');
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [editHtml, setEditHtml] = useState(false);

  useEffect(() => {
    setVendorTypes(defaultVendorTypesForRfqType(rfqType));
  }, [rfqType]);

  useEffect(() => {
    (async () => {
      const [{ data: c }, { data: countriesData }, { data: statusRows }] = await Promise.all([
        supabase.from('clients' as any).select('id, name, country_id').order('name'),
        supabase.from('countries').select('id, name').order('name'),
        supabase.from('lead_statuses').select('id, name'),
      ]);
      setClients((c as any) || []);
      setCountries(countriesData || []);

      const statusById = new Map<string, string>(
        ((statusRows as { id: string; name: string }[]) || []).map((s) => [s.id, s.name]),
      );
      const wonIds = [...statusById.entries()]
        .filter(([, name]) => isClosedStatusName(name))
        .map(([id]) => id);

      const pageSize = 1000;
      let from = 0;
      const rows: MatchableVendor[] = [];
      for (;;) {
        let q = supabase
          .from('leads')
          .select('id, company_name, email, country_ids, hq_country_id, vendor_types, status_id')
          .order('company_name')
          .range(from, from + pageSize - 1);
        if (wonIds.length > 0) q = q.in('status_id', wonIds);
        const { data, error } = await q;
        if (error || !data?.length) break;
        for (const v of data as any[]) {
          rows.push({
            id: v.id,
            company_name: v.company_name,
            email: v.email,
            country_ids: Array.isArray(v.country_ids) ? v.country_ids : [],
            hq_country_id: v.hq_country_id,
            vendor_types: v.vendor_types,
            status_name: statusById.get(v.status_id) ?? null,
          });
        }
        if (data.length < pageSize) break;
        from += pageSize;
      }
      setVendors(rows);
    })();
  }, []);

  useEffect(() => {
    if (clientKind !== 'active') return;
    const client = clients.find((c) => c.id === clientId);
    if (client?.country_id) setCountryId(client.country_id);
  }, [clientId, clients, clientKind]);

  const matched = useMemo(() => {
    if (!countryId || !vendorTypes.length) return [];
    return matchRfqVendors(vendors, countryId, vendorTypes);
  }, [vendors, countryId, vendorTypes]);

  const nearMisses = useMemo(() => {
    if (!countryId) return [];
    return vendors
      .filter((v) => isClosedStatusName(v.status_name))
      .filter((v) => vendorOperatesInCountry(v, countryId))
      .filter((v) => !matched.some((m) => m.id === v.id))
      .map((v) => {
        const reasons: string[] = [];
        if (!v.email || !v.email.includes('@')) reasons.push('missing email');
        if (!vendorHasAnyType(v, vendorTypes)) {
          const have = (v.vendor_types || []).join(', ') || 'none';
          reasons.push(`types [${have}] do not overlap [${vendorTypes.join(', ')}]`);
        }
        return { ...v, reasons };
      })
      .slice(0, 8);
  }, [vendors, countryId, vendorTypes, matched]);

  useEffect(() => {
    setSelectedVendorIds(new Set(matched.map((m) => m.id)));
  }, [matched]);

  const countryName = countries.find((c) => c.id === countryId)?.name || 'this country';
  const deadlineIso = new Date(deadlineLocal).toISOString();
  const missingMagicLink = Boolean(bodyHtml) && !bodyHtml.includes('{{magic_link}}');

  const buildEmailDefaults = useCallback(() => {
    const kind = rfqType === 'fulfillment' ? 'fulfillment' : 'retrieval';
    const vars = {
      vendor_name: '{{vendor_name}}',
      country: countryName,
      deadline: new Date(deadlineIso).toLocaleString(),
      deadline_countdown: formatCountdown(deadlineIso),
      magic_link: '{{magic_link}}',
      scope_summary: scope || 'See RFQ details in RemoAsset Connect.',
      qty: qty || '1',
      owner_name: user?.email?.split('@')[0] || 'RemoAsset',
      rfq_type_label: rfqType.replace(/_/g, ' '),
    };
    const mail = buildInviteEmail(vars, kind);
    setSubject(mail.subject);
    setBodyHtml(mail.body_html);
    setBodyText(mail.body_text);
  }, [rfqType, countryName, deadlineIso, scope, qty, user?.email]);

  const toggleType = (t: VendorType) => {
    setVendorTypes((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t],
    );
  };

  const parseExtraCc = () =>
    extraCc.split(/[,;\s]+/).map((e) => e.trim()).filter((e) => e.includes('@'));

  const briefClientReady =
    clientKind === 'active' ? Boolean(clientId) : Boolean(prospectName.trim());

  const goPartners = () => {
    if (!briefClientReady || !countryId || !scope.trim()) {
      toast({
        title: 'Complete the brief',
        description:
          clientKind === 'prospecting'
            ? 'Prospect name, country, and scope are required.'
            : 'Client, country, and scope are required.',
        variant: 'destructive',
      });
      return;
    }
    setStep(2);
  };

  const goEmailStep = () => {
    if (!briefClientReady || !countryId || !scope.trim() || !selectedVendorIds.size) {
      toast({
        title: 'Select partners',
        description: 'At least one vendor is required.',
        variant: 'destructive',
      });
      return;
    }
    buildEmailDefaults();
    setEditHtml(false);
    setStep(3);
  };

  const createAndSend = async (mode: 'send' | 'test_send') => {
    if (!subject.trim() || !bodyHtml.trim()) {
      toast({ title: 'Email required', description: 'Subject and body cannot be empty.', variant: 'destructive' });
      return;
    }
    if (!bodyHtml.includes('{{magic_link}}') && mode === 'send') {
      toast({
        title: 'Magic link missing',
        description: 'Keep {{magic_link}} in the email body so vendors can respond.',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      const ownerCc = user?.email ? [user.email] : [];
      const cc_emails = Array.from(new Set([...ownerCc, ...parseExtraCc()]));

      let resolvedClientId = clientId;
      if (clientKind === 'prospecting') {
        const name = prospectName.trim();
        const existing = clients.find((c) => c.name.toLowerCase() === name.toLowerCase());
        if (existing) {
          resolvedClientId = existing.id;
        } else {
          const { data: created, error: clientErr } = await supabase
            .from('clients' as any)
            .insert({
              name,
              country_id: countryId || null,
              notes: 'Created from RFQ as a prospecting client.',
              created_by: user?.id,
            })
            .select('id')
            .single();
          if (clientErr) throw clientErr;
          resolvedClientId = (created as { id: string }).id;
          setClientId(resolvedClientId);
          setClients((prev) => [
            ...prev,
            { id: resolvedClientId, name, country_id: countryId || null },
          ]);
        }
      }

      let rfqId: string | null = null;

      if (mode === 'send' || true) {
        const { data: req, error: reqErr } = await supabase.from('client_requests' as any).insert({
          client_id: resolvedClientId,
          country_id: countryId,
          request_type:
            rfqType === 'retrieval_redeployment'
              ? 'retrieval_redeployment'
              : rfqType === 'itad'
                ? 'itad'
                : 'fulfillment',
          brand: 'RFQ',
          device_model: scope.slice(0, 80) || 'RFQ campaign',
          quantity: Number(qty) || 1,
          processor: '—',
          display_size: '—',
          ram: '—',
          storage: '—',
          status: 'rfq_in_progress',
          notes: `Created from RFQ campaign. Scope: ${scope}`,
          created_by: user?.id,
        }).select('id').single();
        if (reqErr) throw reqErr;

        const { data: rfq, error: rfqErr } = await supabase.from('rfqs' as any).insert({
          client_id: resolvedClientId,
          client_request_id: (req as any).id,
          country_id: countryId,
          rfq_type: rfqType,
          target_vendor_types: vendorTypes,
          scope_summary: scope,
          quantity: Number(qty) || 1,
          deadline: deadlineIso,
          status: 'draft',
          cc_emails,
          email_subject: subject,
          email_body_html: bodyHtml,
          sealed_until: deadlineIso,
          owner_id: user?.id,
          created_by: user?.id,
        }).select('id').single();
        if (rfqErr) throw rfqErr;
        rfqId = (rfq as any).id;

        const recipientRows = matched
          .filter((m) => selectedVendorIds.has(m.id))
          .map((m) => ({
            rfq_id: rfqId,
            vendor_id: m.id,
            email: m.email!,
            status: 'pending_send',
          }));
        const { error: recErr } = await supabase.from('rfq_recipients' as any).insert(recipientRows);
        if (recErr) throw recErr;
      }

      if (mode === 'test_send') {
        await invokeRfqCampaign({
          action: 'test_send',
          rfq_id: rfqId,
          subject,
          body_html: bodyHtml,
          body_text: bodyText,
          to: user?.email,
        });
        toast({
          title: 'Test email sent',
          description: `Check ${user?.email}. The quote button uses a real partner link so you can click through and test the form.`,
        });
        if (rfqId) navigate(`/rfq/${rfqId}`);
        return;
      }

      await invokeRfqCampaign({
        action: 'send',
        rfq_id: rfqId,
        subject,
        body_html: bodyHtml,
        body_text: bodyText,
      });
      toast({ title: 'RFQ campaign sent', description: `Emailed ${selectedVendorIds.size} Closed partners.` });
      navigate(`/rfq/${rfqId}`);
    } catch (e) {
      toast({
        title: 'Failed',
        description: e instanceof Error ? e.message : String(e),
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const selectAll = () => setSelectedVendorIds(new Set(matched.map((m) => m.id)));
  const selectNone = () => setSelectedVendorIds(new Set());

  return (
    <AppLayout>
      <div className="p-6 max-w-3xl mx-auto pb-8">
        <Button
          variant="ghost"
          className="rounded-xl -ml-2 cursor-pointer"
          onClick={() => (step === 1 ? navigate('/rfq') : setStep((s) => (s === 3 ? 2 : 1)))}
        >
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>

        <div className="mt-2 mb-4 flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Raise RFQ</h1>
            <p className="text-sm text-muted-foreground mt-1">Step {step} of 3</p>
          </div>
          <RfqHowToButton />
        </div>

        <RfqWizardRail step={step} onStepChange={setStep} />

        {step === 1 && (
          <Card className="card-shadow mt-6 p-5 space-y-8">
            <section className="space-y-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">What you need</h2>
              <div className="space-y-2">
                <Label>Request type</Label>
                <Select value={rfqType} onValueChange={(v) => setRfqType(v as RfqType)}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fulfillment">New device fulfillment</SelectItem>
                    <SelectItem value="retrieval_redeployment">Retrieval / storage / redeploy</SelectItem>
                    <SelectItem value="itad">ITAD</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Sets vendor-type defaults and the email template.</p>
              </div>
              <div className="space-y-2">
                <Label>Client *</Label>
                <div className="flex flex-wrap gap-2">
                  {([
                    { value: 'active' as const, label: 'Active client' },
                    { value: 'prospecting' as const, label: 'Prospecting client' },
                  ]).map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => {
                        setClientKind(o.value);
                        if (o.value === 'prospecting') setClientId('');
                        else setProspectName('');
                      }}
                      className={`px-3 py-1.5 rounded-full text-sm border transition-colors duration-200 cursor-pointer ${
                        clientKind === o.value
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background hover:bg-muted'
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
                {clientKind === 'active' ? (
                  <Select value={clientId} onValueChange={setClientId}>
                    <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select client" /></SelectTrigger>
                    <SelectContent>
                      {clients.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <>
                    <Input
                      className="rounded-xl"
                      value={prospectName}
                      onChange={(e) => setProspectName(e.target.value)}
                      placeholder="Type prospect name"
                      autoFocus
                    />
                    <p className="text-xs text-muted-foreground">
                      Saved as a new client when you send this RFQ.
                    </p>
                  </>
                )}
              </div>
              <div className="space-y-2">
                <Label>Country *</Label>
                <Select value={countryId} onValueChange={setCountryId}>
                  <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select country" /></SelectTrigger>
                  <SelectContent>
                    {countries.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Quantity</Label>
                  <Input className="rounded-xl" type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Deadline</Label>
                  <Input className="rounded-xl" type="datetime-local" value={deadlineLocal} onChange={(e) => setDeadlineLocal(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Scope / brief *</Label>
                <Textarea
                  className="rounded-xl min-h-[120px]"
                  placeholder={'Example:\n• 25× MacBook Pro 14" M3, 16GB/512GB\n• Delivery to Bangalore by 30 Jul'}
                  value={scope}
                  onChange={(e) => setScope(e.target.value)}
                />
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Who to invite</h2>
              <div className="space-y-2">
                <Label>Vendor types</Label>
                <div className="flex flex-wrap gap-2">
                  {VENDOR_TYPE_OPTIONS.map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => toggleType(o.value)}
                      className={`px-3 py-1.5 rounded-full text-sm border transition-colors duration-200 cursor-pointer ${
                        vendorTypes.includes(o.value)
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background hover:bg-muted'
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">Only Closed partners matching these types in the country are invited.</p>
              </div>
              <div className="space-y-2">
                <Label>CC (you are always included)</Label>
                <Input
                  className="rounded-xl"
                  placeholder="teammate@remoasset.com"
                  value={extraCc}
                  onChange={(e) => setExtraCc(e.target.value)}
                />
              </div>
            </section>
            <div className="flex justify-end pt-2 border-t border-border/60">
              <Button className="rounded-xl cursor-pointer" onClick={goPartners}>
                Continue
              </Button>
            </div>
          </Card>
        )}

        {step === 2 && (
          <Card className="card-shadow mt-6 p-5 space-y-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="font-semibold">
                {matched.length} partner{matched.length === 1 ? '' : 's'} · {selectedVendorIds.size} selected
              </p>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{countryName}</Badge>
                {matched.length > 0 && (
                  <>
                    <Button type="button" variant="ghost" size="sm" className="cursor-pointer" onClick={selectAll}>
                      All
                    </Button>
                    <Button type="button" variant="ghost" size="sm" className="cursor-pointer" onClick={selectNone}>
                      None
                    </Button>
                  </>
                )}
              </div>
            </div>
            {matched.length === 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 px-4 py-3 text-sm">
                <p>
                  No Closed vendors with email for these types in {countryName}. Status must be Closed/Won, country coverage must include {countryName}, and types must overlap ({vendorTypes.join(', ') || 'none'}).
                </p>
                {nearMisses.length > 0 && (
                  <div className="mt-3 space-y-1">
                    <p className="font-semibold">In {countryName} but not matched:</p>
                    {nearMisses.map((v) => (
                      <p key={v.id} className="text-xs">
                        <strong>{v.company_name}</strong> — {v.reasons.join('; ')}
                      </p>
                    ))}
                  </div>
                )}
                {nearMisses.length === 0 && (
                  <p className="mt-2 text-xs">
                    No Won partners found for {countryName}. Confirm HQ/served country and status on the lead.
                  </p>
                )}
              </div>
            )}
            <div className="max-h-[360px] overflow-y-auto space-y-2">
              {matched.map((m) => (
                <label key={m.id} className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/40 transition-colors duration-200">
                  <Checkbox
                    checked={selectedVendorIds.has(m.id)}
                    onCheckedChange={(c) => {
                      setSelectedVendorIds((prev) => {
                        const next = new Set(prev);
                        if (c) next.add(m.id);
                        else next.delete(m.id);
                        return next;
                      });
                    }}
                  />
                  <div className="min-w-0">
                    <p className="font-medium text-sm">{m.company_name}</p>
                    <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {(m.vendor_types || []).join(', ') || '—'}
                    </p>
                  </div>
                </label>
              ))}
            </div>
            <div className="flex justify-end pt-2 border-t border-border/60">
              <Button className="rounded-xl cursor-pointer" onClick={goEmailStep} disabled={!selectedVendorIds.size}>
                Continue ({selectedVendorIds.size})
              </Button>
            </div>
          </Card>
        )}

        {step === 3 && (
          <Card className="card-shadow mt-6 p-5 space-y-4">
            <div className="space-y-2">
              <Label>Subject</Label>
              <Input className="rounded-xl" value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
            <div className="rounded-xl border bg-muted/30 p-3 overflow-auto max-h-[320px]">
              <p className="text-xs font-semibold text-muted-foreground mb-2">Preview</p>
              <div dangerouslySetInnerHTML={{ __html: bodyHtml.replaceAll('{{magic_link}}', '#') }} />
            </div>
            {missingMagicLink && (
              <p className="text-sm text-amber-700 dark:text-amber-400">
                Keep {'{{magic_link}}'} in the body so each partner gets a quote link.
              </p>
            )}
            <Button type="button" variant="ghost" size="sm" className="cursor-pointer" onClick={() => setEditHtml((v) => !v)}>
              {editHtml ? 'Hide HTML' : 'Edit HTML'}
            </Button>
            {editHtml && (
              <Textarea
                className="rounded-xl min-h-[220px] font-mono text-xs"
                value={bodyHtml}
                onChange={(e) => setBodyHtml(e.target.value)}
              />
            )}
            <div className="flex flex-col sm:flex-row gap-2 sm:justify-end pt-2 border-t border-border/60">
              <Button
                variant="outline"
                className="rounded-xl cursor-pointer"
                disabled={saving}
                onClick={() => createAndSend('test_send')}
              >
                <FlaskConical className="h-4 w-4 mr-2" /> Test send to me
              </Button>
              <Button className="rounded-xl cursor-pointer" disabled={saving} onClick={() => createAndSend('send')}>
                <Send className="h-4 w-4 mr-2" /> Send to {selectedVendorIds.size} partners
              </Button>
            </div>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
