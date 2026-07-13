import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
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
import { FieldHint, InfoCallout } from '@/components/rfq/RfqInfo';

export default function RfqNew() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [clients, setClients] = useState<{ id: string; name: string; country_id: string | null }[]>([]);
  const [countries, setCountries] = useState<{ id: string; name: string }[]>([]);
  const [vendors, setVendors] = useState<MatchableVendor[]>([]);
  const [rfqType, setRfqType] = useState<RfqType>('fulfillment');
  const [vendorTypes, setVendorTypes] = useState<VendorType[]>(['new_device']);
  const [clientId, setClientId] = useState('');
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

      // Only Closed/Won leads — paginate so we never miss partners past the first 2000 alpha rows
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
    const client = clients.find((c) => c.id === clientId);
    if (client?.country_id) setCountryId(client.country_id);
  }, [clientId, clients]);

  const matched = useMemo(() => {
    if (!countryId || !vendorTypes.length) return [];
    return matchRfqVendors(vendors, countryId, vendorTypes);
  }, [vendors, countryId, vendorTypes]);

  /** Won vendors in-country that still fail a match rule — for diagnostics */
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
          reasons.push(`vendor types [${have}] do not overlap selection [${vendorTypes.join(', ')}]`);
        }
        return { ...v, reasons };
      })
      .slice(0, 8);
  }, [vendors, countryId, vendorTypes, matched]);

  useEffect(() => {
    setSelectedVendorIds(new Set(matched.map((m) => m.id)));
  }, [matched]);

  const countryName = countries.find((c) => c.id === countryId)?.name || 'Country';
  const deadlineIso = new Date(deadlineLocal).toISOString();

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

  const goEmailStep = () => {
    if (!clientId || !countryId || !scope.trim() || !selectedVendorIds.size) {
      toast({
        title: 'Complete the brief',
        description: 'Client, country, scope, and at least one vendor are required.',
        variant: 'destructive',
      });
      return;
    }
    buildEmailDefaults();
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

      let rfqId: string | null = null;

      if (mode === 'send' || true) {
        // Create client request linked
        const { data: req, error: reqErr } = await supabase.from('client_requests' as any).insert({
          client_id: clientId,
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
          client_id: clientId,
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

  return (
    <AppLayout>
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <Button variant="ghost" className="rounded-xl -ml-2" onClick={() => (step === 1 ? navigate('/rfq') : setStep((s) => (s === 3 ? 2 : 1) as 1 | 2))}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Raise RFQ campaign</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Step {step} of 3 — brief → Closed partners → edit &amp; send email
          </p>
        </div>

        <div className="flex gap-2 text-xs">
          {[
            { n: 1, label: 'Brief' },
            { n: 2, label: 'Partners' },
            { n: 3, label: 'Email & send' },
          ].map((s) => (
            <div
              key={s.n}
              className={`flex-1 rounded-lg border px-2 py-1.5 text-center ${
                step === s.n ? 'border-primary bg-primary/5 font-semibold' : step > s.n ? 'bg-muted/40 text-muted-foreground' : 'text-muted-foreground'
              }`}
            >
              {s.n}. {s.label}
            </div>
          ))}
        </div>

        {step === 1 && (
          <div className="space-y-5 rounded-xl border bg-card p-5">
            <InfoCallout title="Who gets invited?" tone="blue">
              <p>
                Only vendors whose pipeline status is <strong>Closed / Won</strong>, who operate in the selected country,
                have a contact email, and match at least one vendor type you select below.
              </p>
            </InfoCallout>

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
              <FieldHint>
                Sets smart defaults for vendor types and email template. Fulfillment → new device; retrieval → warehouse + ITAD.
              </FieldHint>
            </div>

            <div className="space-y-2">
              <Label>Vendor types to mail</Label>
              <div className="flex flex-wrap gap-2">
                {VENDOR_TYPE_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => toggleType(o.value)}
                    className={`px-3 py-1.5 rounded-full text-sm border transition ${
                      vendorTypes.includes(o.value)
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background hover:bg-muted'
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
              <FieldHint>
                Multi-select who should receive this campaign. You can add or remove types beyond the defaults.
              </FieldHint>
            </div>

            <div className="space-y-2">
              <Label>Client</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select client" /></SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldHint>A linked client request is created automatically so award can allocate the vendor later.</FieldHint>
            </div>

            <div className="space-y-2">
              <Label>Country</Label>
              <Select value={countryId} onValueChange={setCountryId}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select country" /></SelectTrigger>
                <SelectContent>
                  {countries.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldHint>Prefills from the client when available. Matching uses HQ or operating countries on the vendor.</FieldHint>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Quantity</Label>
                <Input className="rounded-xl" type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} />
                <FieldHint>Shown in the email and on the vendor quote form.</FieldHint>
              </div>
              <div className="space-y-2">
                <Label>Deadline</Label>
                <Input className="rounded-xl" type="datetime-local" value={deadlineLocal} onChange={(e) => setDeadlineLocal(e.target.value)} />
                <FieldHint>Default 48 hours. Bids stay sealed until this time (or you unseal early).</FieldHint>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Scope / brief</Label>
              <Textarea
                className="rounded-xl min-h-[120px]"
                placeholder={'Example:\n• 25× MacBook Pro 14" M3, 16GB/512GB\n• Delivery to Bangalore by 30 Jul\n• Include warranty + shipping in landed price'}
                value={scope}
                onChange={(e) => setScope(e.target.value)}
              />
              <FieldHint>
                Be specific — this text appears in the email and on the magic-link form. Clear scope gets faster, better quotes.
              </FieldHint>
            </div>

            <div className="space-y-2">
              <Label>CC (you are always included)</Label>
              <Input
                className="rounded-xl"
                placeholder="extra@remoasset.com, teammate@…"
                value={extraCc}
                onChange={(e) => setExtraCc(e.target.value)}
              />
              {user?.email && (
                <FieldHint>
                  Locked CC: <strong>{user.email}</strong>. Add teammates (comma-separated). Same CC list is used for send, remind, and award emails.
                </FieldHint>
              )}
            </div>

            <Button className="rounded-xl w-full" onClick={() => setStep(2)}>Continue to partner matching</Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4 rounded-xl border bg-card p-5">
            <InfoCallout title="Review the matched list" tone="neutral">
              <p>
                These are Closed partners who match your country and vendor types and have an email on file.
                Uncheck anyone who should not receive this RFQ. Do not add vendors manually here — fix their lead status, country, or types in Vendors if someone is missing.
              </p>
            </InfoCallout>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="font-semibold">
                {matched.length} Closed partner{matched.length === 1 ? '' : 's'} matched
                <span className="font-normal text-muted-foreground text-sm ml-2">
                  ({selectedVendorIds.size} selected to email)
                </span>
              </p>
              <Badge variant="secondary">{countryName}</Badge>
            </div>
            {matched.length === 0 && (
              <InfoCallout title="No matches" tone="amber">
                <p>
                  No Closed vendors with email for these types in this country. Check the vendor directory:
                  pipeline status must be Closed/Won, country coverage must include {countryName || 'this country'},
                  and vendor types must overlap your selection ({vendorTypes.join(', ') || 'none selected'}).
                </p>
                {nearMisses.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <p className="font-semibold">Won partners in {countryName} that did not match:</p>
                    {nearMisses.map((v) => (
                      <p key={v.id} className="text-xs">
                        <strong>{v.company_name}</strong> — {v.reasons.join('; ')}
                      </p>
                    ))}
                    <p className="text-xs mt-2">
                      Tip: for a fulfillment RFQ, select <strong>New Device</strong> on step 1 (or add that type on the lead).
                      For retrieval, the lead needs <strong>warehouse</strong> and/or <strong>ITAD</strong> types.
                    </p>
                  </div>
                )}
                {nearMisses.length === 0 && (
                  <p className="mt-2 text-xs">
                    No Won partners found for {countryName} at all. Confirm the lead HQ/served country is Bahamas and status is Won.
                  </p>
                )}
              </InfoCallout>
            )}
            <div className="max-h-[360px] overflow-y-auto space-y-2">
              {matched.map((m) => (
                <label key={m.id} className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/40">
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
                      Types: {(m.vendor_types || []).join(', ') || '—'} · Status: {m.status_name}
                    </p>
                  </div>
                </label>
              ))}
            </div>
            <Button className="rounded-xl w-full" onClick={goEmailStep} disabled={!selectedVendorIds.size}>
              Continue to email ({selectedVendorIds.size} recipient{selectedVendorIds.size === 1 ? '' : 's'})
            </Button>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4 rounded-xl border bg-card p-5">
            <InfoCallout title="Edit before you send" tone="amber">
              <p>
                Template uses RemoAsset branding (orange + dark) and a human, short tone.
                Keep <code className="text-[11px] bg-black/5 px-1 rounded">{'{{magic_link}}'}</code> in the body —
                it becomes each partner’s personal quote link. Use <strong>Test send</strong> to yourself first.
              </p>
            </InfoCallout>
            <div className="space-y-2">
              <Label>Subject line</Label>
              <Input className="rounded-xl" value={subject} onChange={(e) => setSubject(e.target.value)} />
              <FieldHint>Shown in the inbox. Deadline / country in the subject improves open rates.</FieldHint>
            </div>
            <div className="space-y-2">
              <Label>HTML body</Label>
              <Textarea
                className="rounded-xl min-h-[280px] font-mono text-xs"
                value={bodyHtml}
                onChange={(e) => setBodyHtml(e.target.value)}
              />
            </div>
            <div className="rounded-xl border bg-muted/30 p-3 overflow-auto max-h-[240px]">
              <p className="text-xs font-semibold text-muted-foreground mb-2">Live preview (how partners will see it)</p>
              <div dangerouslySetInnerHTML={{ __html: bodyHtml.replaceAll('{{magic_link}}', '#') }} />
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                className="rounded-xl flex-1"
                disabled={saving}
                onClick={() => createAndSend('test_send')}
              >
                <FlaskConical className="h-4 w-4 mr-2" /> Test send to me
              </Button>
              <Button className="rounded-xl flex-1" disabled={saving} onClick={() => createAndSend('send')}>
                <Send className="h-4 w-4 mr-2" /> Send to {selectedVendorIds.size} partners
              </Button>
            </div>
            <FieldHint>
              Send creates the campaign, logs every outbound email in Connect, and moves the linked client request to RFQ in progress.
            </FieldHint>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
