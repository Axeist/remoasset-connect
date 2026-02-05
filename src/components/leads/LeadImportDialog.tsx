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
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { parseCsv, normalizeHeader } from '@/lib/csv';
import { Loader2, Upload, FileSpreadsheet, AlertCircle, Download } from 'lucide-react';
import type { LeadStatusOption, CountryOption } from '@/types/lead';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DEFAULT_SCORE = 50;

interface OwnerOption {
  id: string;
  full_name: string | null;
}

interface ParsedRow {
  company_name: string;
  website: string | null;
  email: string | null;
  phone: string | null;
  contact_name: string | null;
  contact_designation: string | null;
  country_id: string | null;
  status_id: string | null;
  lead_score: number;
  notes: string | null;
  owner_id: string | null;
  error?: string;
}

interface LeadImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function LeadImportDialog({ open, onOpenChange, onSuccess }: LeadImportDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<LeadStatusOption[]>([]);
  const [countries, setCountries] = useState<CountryOption[]>([]);
  const [ownerOptions, setOwnerOptions] = useState<OwnerOption[]>([]);
  const [importing, setImporting] = useState(false);
  const [step, setStep] = useState<'upload' | 'preview'>('upload');

  useEffect(() => {
    if (!open) return;
    setFile(null);
    setRows([]);
    setHeaders([]);
    setStep('upload');
    (async () => {
      const [sRes, cRes, rolesRes] = await Promise.all([
        supabase.from('lead_statuses').select('id, name, color, sort_order').order('sort_order'),
        supabase.from('countries').select('id, name, code').order('name'),
        supabase.from('user_roles').select('user_id'),
      ]);
      if (sRes.data) setStatuses(sRes.data);
      if (cRes.data) setCountries(cRes.data);
      if (rolesRes.data?.length) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', rolesRes.data.map((r) => r.user_id));
        setOwnerOptions((profiles ?? []).map((p) => ({ id: p.user_id, full_name: p.full_name })));
      } else {
        setOwnerOptions([]);
      }
    })();
  }, [open]);

  const resolveCountry = (value: string | null): string | null => {
    if (!value || !value.trim()) return null;
    const v = value.trim();
    const byName = countries.find((c) => c.name.toLowerCase() === v.toLowerCase());
    if (byName) return byName.id;
    const byCode = countries.find((c) => c.code.toLowerCase() === v.toLowerCase());
    return byCode?.id ?? null;
  };

  const resolveStatus = (value: string | null): string | null => {
    if (!value || !value.trim()) return statuses[0]?.id ?? null;
    const v = value.trim();
    const found = statuses.find((s) => s.name.toLowerCase() === v.toLowerCase());
    return found?.id ?? statuses[0]?.id ?? null;
  };

  const parseScore = (value: string | null): number => {
    if (value == null || value.trim() === '') return DEFAULT_SCORE;
    const n = parseInt(value.trim(), 10);
    if (Number.isNaN(n)) return DEFAULT_SCORE;
    return Math.max(1, Math.min(100, n));
  };

  const resolveOwner = (value: string | null): string | null => {
    if (!value || !value.trim()) return null;
    const v = value.trim().toLowerCase();
    const found = ownerOptions.find(
      (o) => o.full_name?.trim().toLowerCase() === v
    );
    return found?.id ?? null;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.name.endsWith('.csv') && !f.type.includes('csv') && !f.type.includes('spreadsheet')) {
      toast({ variant: 'destructive', title: 'Invalid file', description: 'Please choose a CSV file.' });
      return;
    }
    setFile(f);
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? '');
      const rawRows = parseCsv(text);
      if (rawRows.length === 0) {
        toast({ variant: 'destructive', title: 'Empty file', description: 'No rows found in the CSV.' });
        return;
      }
      const rawHeaders = rawRows[0].map((h) => normalizeHeader(h));
      setHeaders(rawHeaders);

      const col = (key: string) => {
        const i = rawHeaders.indexOf(key);
        return i >= 0 ? i : -1;
      };

      const firstStatusId = statuses[0]?.id ?? null;
      const parsed: ParsedRow[] = [];

      for (let r = 1; r < rawRows.length; r++) {
        const raw = rawRows[r];
        const get = (key: string) => {
          const i = col(key);
          if (i < 0 || i >= raw.length) return null;
          const v = raw[i]?.trim();
          return v === '' ? null : v;
        };

        const companyName = get('company_name') ?? get('name') ?? '';
        const emailVal = get('email');
        const notesParts: string[] = [];
        const followup = get('followup_stage');
        const callBooked = get('call_booked');
        if (followup) notesParts.push(`Follow-up: ${followup}`);
        if (callBooked) notesParts.push(`Call: ${callBooked}`);
        const notesVal = get('notes');
        if (notesVal) notesParts.push(notesVal);
        const notes = notesParts.length > 0 ? notesParts.join('\n') : null;

        let error: string | undefined;
        if (!companyName) error = 'Company name is required';
        else if (emailVal && !EMAIL_REGEX.test(emailVal)) error = 'Invalid email';
        else if (emailVal && emailVal.includes('?')) error = 'Invalid email (placeholder)';

        const countryId = resolveCountry(get('country'));
        const statusId = resolveStatus(get('status')) ?? firstStatusId;
        const ownerId = resolveOwner(get('lead_owner'));

        parsed.push({
          company_name: companyName || '(Unknown)',
          website: get('website') || null,
          email: error && emailVal ? null : (emailVal || null),
          phone: get('phone') || null,
          contact_name: get('contact_name') || null,
          contact_designation: get('contact_designation') || null,
          country_id: countryId,
          status_id: statusId,
          lead_score: parseScore(get('lead_score')),
          notes,
          owner_id: ownerId,
          error,
        });
      }

      setRows(parsed);
      setStep('preview');
    };
    reader.readAsText(f, 'UTF-8');
  };

  const validRows = rows.filter((r) => !r.error);
  const errorCount = rows.filter((r) => r.error).length;

  const handleImport = async () => {
    if (validRows.length === 0) {
      toast({ variant: 'destructive', title: 'No valid rows', description: 'Fix errors or add at least one row with a company name.' });
      return;
    }
    setImporting(true);
    const payloads = validRows.map((r) => ({
      company_name: r.company_name,
      website: r.website,
      email: r.email,
      phone: r.phone,
      contact_name: r.contact_name,
      contact_designation: r.contact_designation,
      country_id: r.country_id,
      status_id: r.status_id,
      lead_score: r.lead_score,
      notes: r.notes,
      owner_id: r.owner_id ?? user?.id ?? null,
    }));

    const BATCH = 50;
    let inserted = 0;
    for (let i = 0; i < payloads.length; i += BATCH) {
      const chunk = payloads.slice(i, i + BATCH);
      const { error } = await supabase.from('leads').insert(chunk);
      if (error) {
        toast({ variant: 'destructive', title: 'Import failed', description: error.message });
        setImporting(false);
        return;
      }
      inserted += chunk.length;
    }

    toast({ title: 'Import complete', description: `${inserted} lead(s) imported.${errorCount > 0 ? ` ${errorCount} row(s) skipped due to errors.` : ''}` });
    setImporting(false);
    onOpenChange(false);
    onSuccess();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Import leads from CSV
          </DialogTitle>
          <DialogDescription className="space-y-2">
            <span className="block">Upload a CSV with columns like Vendor Name, Country, Website, Contact Mail, Contact Number, Status, Lead Owner, and Notes.</span>
            <a
              href="/leads-import-sample.csv"
              download="leads-import-sample.csv"
              className="inline-flex items-center gap-1.5 text-primary hover:underline font-medium"
            >
              <Download className="h-4 w-4" />
              Download sample CSV
            </a>
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <div className="flex flex-col items-center justify-center py-8 border border-dashed rounded-lg bg-muted/30">
            <input
              type="file"
              accept=".csv,text/csv,application/csv"
              className="hidden"
              id="lead-csv-upload"
              onChange={handleFileChange}
            />
            <label htmlFor="lead-csv-upload" className="cursor-pointer flex flex-col items-center gap-2">
              <Upload className="h-10 w-10 text-muted-foreground" />
              <span className="text-sm font-medium">Choose CSV file</span>
              <span className="text-xs text-muted-foreground">or drag and drop</span>
            </label>
          </div>
        )}

        {step === 'preview' && (
          <>
            <div className="flex items-center justify-between text-sm">
              <span>
                {file?.name} — {rows.length} row(s), {validRows.length} valid, {errorCount} with errors
              </span>
              <Button type="button" variant="ghost" size="sm" onClick={() => setStep('upload')}>
                Change file
              </Button>
            </div>
            <div className="border rounded-md overflow-auto flex-1 min-h-0">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="text-left p-2 font-medium">Company</th>
                    <th className="text-left p-2 font-medium">Country</th>
                    <th className="text-left p-2 font-medium">Status</th>
                    <th className="text-left p-2 font-medium">Owner</th>
                    <th className="text-left p-2 font-medium">Email</th>
                    <th className="text-left p-2 w-20">Score</th>
                    <th className="text-left p-2 w-24">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 30).map((r, i) => (
                    <tr key={i} className={r.error ? 'bg-destructive/10' : ''}>
                      <td className="p-2">{r.company_name}</td>
                      <td className="p-2">{countries.find((c) => c.id === r.country_id)?.name ?? (r.country_id ? '?' : '—')}</td>
                      <td className="p-2">{statuses.find((s) => s.id === r.status_id)?.name ?? '—'}</td>
                      <td className="p-2">{ownerOptions.find((o) => o.id === r.owner_id)?.full_name ?? (r.owner_id ? '?' : '—')}</td>
                      <td className="p-2">{r.email ?? '—'}</td>
                      <td className="p-2">{r.lead_score}</td>
                      <td className="p-2">
                        {r.error ? (
                          <span className="text-destructive flex items-center gap-1">
                            <AlertCircle className="h-4 w-4" />
                            {r.error}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">OK</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length > 30 && (
                <p className="text-xs text-muted-foreground p-2 border-t">
                  Showing first 30 rows. All {rows.length} rows will be processed on import.
                </p>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleImport} disabled={importing || validRows.length === 0} className="gap-2">
                {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Import {validRows.length} lead(s)
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
