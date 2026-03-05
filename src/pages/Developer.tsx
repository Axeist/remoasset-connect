import { useState, useCallback, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import {
  Key, Terminal, FileText, Wrench, Plus, Trash2, Copy, Check, RefreshCw,
  Play, Globe, Clock, Loader2, CheckCircle2, XCircle, AlertTriangle,
  ChevronDown, ChevronRight, Zap, Database, ShieldCheck, Layers, Activity,
  Users, Lock, BookOpen, ListTodo, CalendarCheck, Bell, HelpCircle, ExternalLink,
  Download,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const BASE_URL = `${import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, '')}/functions/v1/api`;

// ─── types ────────────────────────────────────────────────────────────────────

type DevTab = 'keys' | 'tester' | 'docs' | 'tools';
type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';

interface ApiKeyRow {
  id: string;
  name: string;
  key_prefix: string;
  created_at: string;
  last_used_at: string | null;
}

interface Endpoint {
  id: string;
  method: Method;
  path: string;
  title: string;
  group: string;
  defaultBody?: string;
  defaultQuery?: string;
  pathParams?: string[];
}

interface RequestLog {
  id: string;
  method: Method;
  url: string;
  status: number | null;
  duration: number;
  ts: Date;
  ok: boolean;
}

// ─── nav tabs ─────────────────────────────────────────────────────────────────

const TABS: { id: DevTab; label: string; icon: React.ElementType; desc: string }[] = [
  { id: 'keys',   label: 'API Keys',     icon: Key,      desc: 'Create & manage API keys' },
  { id: 'tester', label: 'API Tester',   icon: Terminal, desc: 'Fire live requests' },
  { id: 'docs',   label: 'API Docs',     icon: FileText, desc: 'Full endpoint reference' },
  { id: 'tools',  label: 'Dev Tools',    icon: Wrench,   desc: 'Session, env & health' },
];

// ─── endpoint catalog ─────────────────────────────────────────────────────────

const ENDPOINTS: Endpoint[] = [
  { id: 'team',        method: 'GET',    path: '/team',       title: 'List team members',     group: 'Reference' },
  { id: 'statuses',    method: 'GET',    path: '/statuses',   title: 'List pipeline statuses', group: 'Reference' },
  { id: 'countries',   method: 'GET',    path: '/countries',  title: 'List countries',        group: 'Reference' },
  { id: 'profiles',    method: 'GET',    path: '/profiles',   title: 'List profiles',         group: 'Reference' },
  { id: 'leads-list',  method: 'GET',    path: '/leads',      title: 'List leads',            group: 'Leads',     defaultQuery: 'limit=10&offset=0' },
  { id: 'leads-get',   method: 'GET',    path: '/leads/:id',  title: 'Get a lead',            group: 'Leads',     pathParams: ['id'] },
  { id: 'leads-create',method: 'POST',   path: '/leads',      title: 'Create a lead',         group: 'Leads',     defaultBody: JSON.stringify({ company_name: 'Acme Corp', contact_name: 'Jane Doe', email: 'jane@acme.com' }, null, 2) },
  { id: 'leads-update',method: 'PATCH',  path: '/leads/:id',  title: 'Update a lead',         group: 'Leads',     pathParams: ['id'], defaultBody: JSON.stringify({ deal_value: 50000 }, null, 2) },
  { id: 'leads-delete',method: 'DELETE', path: '/leads/:id',  title: 'Delete a lead',         group: 'Leads',     pathParams: ['id'] },
  { id: 'leads-bulk',  method: 'PATCH',  path: '/leads/bulk', title: 'Bulk update leads',     group: 'Leads',     defaultBody: JSON.stringify({ lead_ids: [], owner_id: '' }, null, 2) },
  { id: 'tasks-list',  method: 'GET',    path: '/tasks',      title: 'List tasks',            group: 'Tasks',     defaultQuery: 'limit=10&offset=0' },
  { id: 'tasks-get',   method: 'GET',    path: '/tasks/:id',  title: 'Get a task',            group: 'Tasks',     pathParams: ['id'] },
  { id: 'tasks-create',method: 'POST',   path: '/tasks',      title: 'Create a task',         group: 'Tasks',     defaultBody: JSON.stringify({ title: 'Send proposal', due_date: '2026-03-15', priority: 'high' }, null, 2) },
  { id: 'tasks-update',method: 'PATCH',  path: '/tasks/:id',  title: 'Update a task',         group: 'Tasks',     pathParams: ['id'], defaultBody: JSON.stringify({ is_completed: true }, null, 2) },
  { id: 'tasks-delete',method: 'DELETE', path: '/tasks/:id',  title: 'Delete a task',         group: 'Tasks',     pathParams: ['id'] },
  { id: 'fu-list',     method: 'GET',    path: '/follow_ups', title: 'List follow-ups',       group: 'Follow-ups',defaultQuery: 'limit=10&offset=0' },
  { id: 'fu-get',      method: 'GET',    path: '/follow_ups/:id', title: 'Get a follow-up',   group: 'Follow-ups',pathParams: ['id'] },
  { id: 'fu-create',   method: 'POST',   path: '/follow_ups', title: 'Schedule a follow-up',  group: 'Follow-ups',defaultBody: JSON.stringify({ lead_id: '', user_id: '', scheduled_at: '2026-03-15T09:00:00Z', notes: 'Demo call' }, null, 2) },
  { id: 'fu-update',   method: 'PATCH',  path: '/follow_ups/:id', title: 'Update a follow-up',group: 'Follow-ups',pathParams: ['id'], defaultBody: JSON.stringify({ is_completed: true }, null, 2) },
  { id: 'fu-delete',   method: 'DELETE', path: '/follow_ups/:id', title: 'Delete a follow-up',group: 'Follow-ups',pathParams: ['id'] },
  { id: 'act-list',    method: 'GET',    path: '/activities', title: 'List activities',       group: 'Activities',defaultQuery: 'limit=10&offset=0' },
  { id: 'act-get',     method: 'GET',    path: '/activities/:id', title: 'Get an activity',   group: 'Activities',pathParams: ['id'] },
  { id: 'act-create',  method: 'POST',   path: '/activities', title: 'Log an activity',       group: 'Activities',defaultBody: JSON.stringify({ lead_id: '', user_id: '', type: 'call', description: 'Discussed pricing' }, null, 2) },
  { id: 'act-update',  method: 'PATCH',  path: '/activities/:id', title: 'Update an activity',group: 'Activities',pathParams: ['id'], defaultBody: JSON.stringify({ description: 'Updated notes' }, null, 2) },
  { id: 'act-delete',  method: 'DELETE', path: '/activities/:id', title: 'Delete an activity',group: 'Activities',pathParams: ['id'] },
  { id: 'notif-list',  method: 'GET',    path: '/notifications', title: 'List notifications', group: 'Notifications', defaultQuery: 'user_id=' },
  { id: 'notif-create',method: 'POST',   path: '/notifications', title: 'Send a notification',group: 'Notifications', defaultBody: JSON.stringify({ user_id: '', title: 'Test notification', message: 'Hello from API tester', type: 'info' }, null, 2) },
];

const EP_GROUPS = [...new Set(ENDPOINTS.map((e) => e.group))];

const EDGE_FUNCTIONS = [
  { id: 'api',           label: 'api',            desc: 'REST API handler' },
  { id: 'api-keys',      label: 'api-keys',       desc: 'Key management' },
  { id: 'invite-user',   label: 'invite-user',    desc: 'User invitations' },
  { id: 'manage-user',   label: 'manage-user',    desc: 'User management' },
  { id: 'slack-notify',  label: 'slack-notify',   desc: 'Slack notifications' },
  { id: 'slack-digest',  label: 'slack-digest',   desc: 'Slack digest' },
  { id: 'slack-reminders',label:'slack-reminders',desc: 'Slack reminders' },
  { id: 'google-calendar',label:'google-calendar',desc: 'Calendar integration' },
];

const LAST_UPDATED = 'March 5, 2026';

// ─── helpers ──────────────────────────────────────────────────────────────────

function MethodBadge({ method }: { method: Method }) {
  const s: Record<Method, string> = {
    GET:    'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
    POST:   'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    PATCH:  'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    DELETE: 'bg-destructive/10 text-destructive border-destructive/20',
  };
  return <span className={cn('inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold font-mono tracking-wider shrink-0', s[method])}>{method}</span>;
}

function StatusPill({ status }: { status: number | null }) {
  if (!status) return null;
  const ok = status >= 200 && status < 300;
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold border',
      ok ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
         : 'bg-destructive/10 text-destructive border-destructive/20')}>
      {ok ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}{status}
    </span>
  );
}

function prettyJson(raw: string) {
  try { return JSON.stringify(JSON.parse(raw), null, 2); } catch { return raw; }
}

function CodeBlock({ code, language = 'bash' }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  return (
    <div className="relative rounded-xl border border-border/60 bg-[#30282B] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-1.5 border-b border-white/10">
        <span className="text-[11px] font-mono text-white/40 uppercase tracking-wider">{language}</span>
        <button onClick={() => { navigator.clipboard.writeText(code); setCopied(true); toast({ title: 'Copied' }); setTimeout(() => setCopied(false), 2000); }}
          className="text-white/40 hover:text-white/80 transition-colors p-0.5 rounded">
          {copied ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 text-[12.5px] text-white/85 leading-relaxed font-mono whitespace-pre">{code}</pre>
    </div>
  );
}

function ParamTable({ rows }: { rows: { name: string; type: string; required?: boolean; description: string }[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border/60 text-sm">
      <table className="w-full">
        <thead><tr className="border-b border-border/60 bg-muted/40">
          <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground w-36">Field</th>
          <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground w-24">Type</th>
          <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground w-20">Required</th>
          <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground">Description</th>
        </tr></thead>
        <tbody className="divide-y divide-border/40">
          {rows.map((r) => (
            <tr key={r.name} className="hover:bg-muted/30 transition-colors">
              <td className="px-4 py-2.5 font-mono text-xs text-primary font-semibold">{r.name}</td>
              <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{r.type}</td>
              <td className="px-4 py-2.5">
                {r.required
                  ? <span className="inline-flex items-center rounded-full bg-destructive/10 text-destructive border border-destructive/20 px-2 py-0.5 text-[10px] font-semibold">required</span>
                  : <span className="text-xs text-muted-foreground/60">optional</span>}
              </td>
              <td className="px-4 py-2.5 text-xs text-muted-foreground leading-relaxed">{r.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EndpointRow({ method, path, title, description, queryParams, bodyParams, responseExample, children }:
  { method: string; path: string; title: string; description?: string;
    queryParams?: { name: string; type: string; required?: boolean; description: string }[];
    bodyParams?: { name: string; type: string; required?: boolean; description: string }[];
    responseExample?: string; children?: React.ReactNode }) {
  return (
    <AccordionItem value={`${method}-${path}`} className="border border-border/60 rounded-xl overflow-hidden bg-card/50 data-[state=open]:bg-card">
      <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/30 [&>svg]:hidden">
        <div className="flex items-center gap-3 w-full">
          <MethodBadge method={method as Method} />
          <code className="text-sm font-mono flex-1 text-left text-foreground">{path}</code>
          <span className="text-xs text-muted-foreground hidden sm:block pr-2">{title}</span>
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-90" />
        </div>
      </AccordionTrigger>
      <AccordionContent className="border-t border-border/60 px-4 py-4 space-y-4 bg-muted/10">
        {description && <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>}
        {queryParams?.length ? <div className="space-y-2"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Query parameters</p><ParamTable rows={queryParams} /></div> : null}
        {bodyParams?.length ? <div className="space-y-2"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Request body</p><ParamTable rows={bodyParams} /></div> : null}
        {responseExample ? <div className="space-y-2"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Example response</p><CodeBlock code={responseExample} language="json" /></div> : null}
        {children}
      </AccordionContent>
    </AccordionItem>
  );
}

// ─── main page ────────────────────────────────────────────────────────────────

export default function Developer() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = (searchParams.get('tab') as DevTab) || 'keys';
  const setTab = (t: DevTab) => setSearchParams({ tab: t }, { replace: true });

  // ── API keys state
  const [apiKeys, setApiKeys] = useState<ApiKeyRow[]>([]);
  const [apiKeyLoading, setApiKeyLoading] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [createKeyOpen, setCreateKeyOpen] = useState(false);
  const [createdKeyOnce, setCreatedKeyOnce] = useState<{ api_key: string; name: string; key_prefix: string } | null>(null);
  const [revokeKeyId, setRevokeKeyId] = useState<string | null>(null);

  // ── API tester state
  const [apiKey, setApiKey] = useState('');
  const [selectedId, setSelectedId] = useState<string>(ENDPOINTS[0].id);
  const [pathVals, setPathVals] = useState<Record<string, string>>({});
  const [query, setQuery] = useState('');
  const [body, setBody] = useState('');
  const [response, setResponse] = useState('');
  const [reqStatus, setReqStatus] = useState<number | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState<RequestLog[]>([]);
  const [copiedRes, setCopiedRes] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  // ── Dev tools state
  const [devSession, setDevSession] = useState<Record<string, unknown> | null>(null);
  const [devSessionLoading, setDevSessionLoading] = useState(false);
  const [devFnResults, setDevFnResults] = useState<Record<string, { status: 'idle' | 'loading' | 'ok' | 'error'; ms?: number; body?: string }>>({});
  const [devEnvOpen, setDevEnvOpen] = useState(false);

  // ── Docs state
  const [docSection, setDocSection] = useState('overview');

  const endpoint = ENDPOINTS.find((e) => e.id === selectedId)!;

  // ── fetch keys on mount
  useEffect(() => { fetchApiKeys(); }, []);

  const fetchApiKeys = async () => {
    setApiKeyLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('api-keys', { body: { action: 'list' } });
      if (error) throw error;
      setApiKeys((data?.keys ?? []) as ApiKeyRow[]);
    } catch (e) {
      toast({ variant: 'destructive', title: 'Failed to load API keys', description: (e as Error)?.message });
    } finally { setApiKeyLoading(false); }
  };

  const handleCreateKey = async () => {
    if (!newKeyName.trim()) return;
    setApiKeyLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('api-keys', { body: { name: newKeyName.trim() } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setCreatedKeyOnce({ api_key: data.api_key, name: data.name, key_prefix: data.key_prefix });
      fetchApiKeys();
    } catch (e) {
      toast({ variant: 'destructive', title: 'Failed to create API key', description: (e as Error)?.message });
    } finally { setApiKeyLoading(false); }
  };

  const handleRevokeKey = async () => {
    if (!revokeKeyId) return;
    try {
      const { data, error } = await supabase.functions.invoke('api-keys', { method: 'DELETE', body: { id: revokeKeyId } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setRevokeKeyId(null);
      fetchApiKeys();
      toast({ title: 'API key revoked' });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Failed to revoke', description: (e as Error)?.message });
    }
  };

  // ── tester helpers
  const selectEndpoint = (ep: Endpoint) => {
    setSelectedId(ep.id);
    setPathVals({});
    setQuery(ep.defaultQuery ?? '');
    setBody(ep.defaultBody ?? '');
    setResponse(''); setReqStatus(null); setDuration(null);
  };

  const buildUrl = useCallback(() => {
    let path = endpoint.path;
    for (const [k, v] of Object.entries(pathVals)) path = path.replace(`:${k}`, encodeURIComponent(v));
    const q = query.trim();
    return `${BASE_URL}${path}${q ? `?${q}` : ''}`;
  }, [endpoint, pathVals, query]);

  const runRequest = async () => {
    if (!apiKey.trim()) { toast({ variant: 'destructive', title: 'API key required' }); return; }
    const url = buildUrl();
    const start = Date.now();
    setRunning(true); setResponse(''); setReqStatus(null); setDuration(null);
    try {
      const opts: RequestInit = { method: endpoint.method, headers: { 'Authorization': `Bearer ${apiKey.trim()}`, 'Content-Type': 'application/json' } };
      if (['POST', 'PATCH'].includes(endpoint.method) && body.trim()) opts.body = body;
      const res = await fetch(url, opts);
      const elapsed = Date.now() - start;
      setReqStatus(res.status); setDuration(elapsed);
      setResponse(prettyJson(await res.text()));
      setLogs((p) => [{ id: crypto.randomUUID(), method: endpoint.method, url, status: res.status, duration: elapsed, ts: new Date(), ok: res.ok }, ...p.slice(0, 19)]);
    } catch (e) {
      const elapsed = Date.now() - start;
      setDuration(elapsed);
      setResponse(JSON.stringify({ error: (e as Error).message }, null, 2));
      setLogs((p) => [{ id: crypto.randomUUID(), method: endpoint.method, url, status: null, duration: elapsed, ts: new Date(), ok: false }, ...p.slice(0, 19)]);
    }
    setRunning(false);
  };

  const fillSessionToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) { setApiKey(session.access_token); toast({ title: 'Session token applied' }); }
  };

  // ── dev tools helpers
  const loadSession = async () => {
    setDevSessionLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      setDevSession({
        user_id: session.user.id,
        email: session.user.email,
        role: session.user.user_metadata?.role ?? '—',
        expires_at: new Date((session.expires_at ?? 0) * 1000).toLocaleString(),
        token_preview: session.access_token.slice(0, 24) + '…',
      });
    }
    setDevSessionLoading(false);
  };

  const pingFunction = async (fnId: string) => {
    setDevFnResults((p) => ({ ...p, [fnId]: { status: 'loading' } }));
    const start = Date.now();
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, '')}/functions/v1/${fnId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY}` },
        body: JSON.stringify({ __ping: true }),
      });
      const ms = Date.now() - start;
      setDevFnResults((p) => ({ ...p, [fnId]: { status: res.status < 500 ? 'ok' : 'error', ms, body: `HTTP ${res.status}` } }));
    } catch (e) {
      setDevFnResults((p) => ({ ...p, [fnId]: { status: 'error', ms: Date.now() - start, body: (e as Error).message } }));
    }
  };

  const pingAll = () => EDGE_FUNCTIONS.forEach((f) => pingFunction(f.id));

  const DOC_SECTIONS = [
    { id: 'overview', label: 'Overview', icon: BookOpen },
    { id: 'authentication', label: 'Authentication', icon: Lock },
    { id: 'pagination', label: 'Pagination', icon: Layers },
    { id: 'leads', label: 'Leads', icon: Users },
    { id: 'tasks', label: 'Tasks', icon: ListTodo },
    { id: 'follow-ups', label: 'Follow-ups', icon: CalendarCheck },
    { id: 'activities', label: 'Activities', icon: Activity },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'reference', label: 'Reference data', icon: Database },
    { id: 'errors', label: 'Status codes', icon: AlertTriangle },
    { id: 'faq', label: 'FAQ', icon: HelpCircle },
  ];

  const scrollDoc = (id: string) => {
    setDocSection(id);
    document.getElementById(`doc-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const downloadDocs = () => {
    const content = `# RemoAsset Connect — API Documentation\nVersion 1.0  |  Last updated ${LAST_UPDATED}\n\nBase URL: ${BASE_URL}\n\nAuthentication: Authorization: Bearer <your_api_key>\n\nFull interactive docs: ${window.location.origin}/developer?tab=docs\n`;
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'remoasset-connect-api-docs.md'; a.click();
    toast({ title: 'Documentation downloaded' });
  };

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto space-y-6 animate-fade-in-up">

        {/* ── page header ── */}
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 shrink-0">
            <Terminal className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h1 className="text-2xl font-display font-bold tracking-tight">Developer</h1>
              <Badge variant="secondary" className="text-xs">Admin only</Badge>
            </div>
            <p className="text-muted-foreground text-sm">API keys, live tester, docs, and debugging tools — all in one place.</p>
          </div>
        </div>

        {/* ── tab bar ── */}
        <div className="flex gap-1 p-1 rounded-xl bg-muted/40 border border-border/60 w-fit flex-wrap">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150',
                activeTab === t.id
                  ? 'bg-background text-foreground shadow-sm border border-border/60'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
              )}
            >
              <t.icon className="h-4 w-4 shrink-0" />
              {t.label}
            </button>
          ))}
        </div>

        {/* ════════════════════════════════════════════════════════
            TAB: API KEYS
        ════════════════════════════════════════════════════════ */}
        {activeTab === 'keys' && (
          <div className="space-y-6 max-w-3xl">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="text-base font-semibold">API Keys</h2>
                <p className="text-sm text-muted-foreground">Create keys for external apps to access the RemoAsset Connect REST API.</p>
              </div>
              <Button size="sm" className="gap-2 gradient-primary text-white" onClick={() => { setCreatedKeyOnce(null); setNewKeyName(''); setCreateKeyOpen(true); }}>
                <Plus className="h-4 w-4" />Create API key
              </Button>
            </div>

            {/* base URL */}
            <Card className="card-shadow border-border/60 p-4 space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Globe className="h-4 w-4 text-primary" />Base URL
              </h3>
              <p className="text-xs text-muted-foreground">Use this as the base for all requests. Send your key as <code className="rounded bg-muted px-1 py-0.5">Authorization: Bearer &lt;key&gt;</code>.</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded-lg bg-muted px-3 py-2 text-sm font-mono break-all">{BASE_URL}</code>
                <Button variant="outline" size="icon" className="shrink-0" onClick={() => { navigator.clipboard.writeText(BASE_URL); toast({ title: 'Copied' }); }}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </Card>

            {/* keys table */}
            <Card className="card-shadow border-border/60 overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 bg-muted/30 border-b border-border/60">
                <Key className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium text-sm">Your API keys</span>
                <Button variant="ghost" size="icon" className="h-7 w-7 ml-1" onClick={fetchApiKeys} disabled={apiKeyLoading}>
                  <RefreshCw className={cn('h-3.5 w-3.5', apiKeyLoading && 'animate-spin')} />
                </Button>
              </div>
              {apiKeyLoading ? (
                <p className="text-sm text-muted-foreground py-8 text-center">Loading…</p>
              ) : apiKeys.length === 0 ? (
                <div className="py-12 text-center space-y-2">
                  <Key className="h-8 w-8 text-muted-foreground/40 mx-auto" />
                  <p className="text-sm text-muted-foreground">No API keys yet.</p>
                  <Button size="sm" variant="outline" onClick={() => { setCreatedKeyOnce(null); setNewKeyName(''); setCreateKeyOpen(true); }}>
                    Create your first key
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/20 hover:bg-muted/20">
                      <TableHead>Name</TableHead>
                      <TableHead>Prefix</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Last used</TableHead>
                      <TableHead className="w-14" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {apiKeys.map((k) => (
                      <TableRow key={k.id}>
                        <TableCell className="font-medium">{k.name}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{k.key_prefix}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{new Date(k.created_at).toLocaleDateString()}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{k.last_used_at ? new Date(k.last_used_at).toLocaleString() : '—'}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setRevokeKeyId(k.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Card>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════
            TAB: API TESTER
        ════════════════════════════════════════════════════════ */}
        {activeTab === 'tester' && (
          <div className="space-y-4">
            {/* API key bar */}
            <Card className="card-shadow border-border/60 p-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <div className="flex items-center gap-2 shrink-0">
                  <Key className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold">API Key</span>
                </div>
                <Input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)}
                  placeholder="ra_••••••••••••••••••••••••••••••••" className="flex-1 font-mono text-sm h-9" />
              </div>
              {!apiKey && (
                <p className="mt-2 text-xs text-muted-foreground flex items-center gap-1.5">
                  <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0" />
                  Requires a <code className="font-mono bg-muted px-1 rounded">ra_...</code> API key — <strong>not</strong> a session token. Create one in the API Keys tab.
                </p>
              )}
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4 items-start">
              {/* endpoint list */}
              <aside className="space-y-1 lg:sticky lg:top-4">
                {EP_GROUPS.map((group) => {
                  const geps = ENDPOINTS.filter((e) => e.group === group);
                  const collapsed = collapsedGroups[group];
                  return (
                    <div key={group} className="rounded-xl border border-border/60 overflow-hidden">
                      <button onClick={() => setCollapsedGroups((p) => ({ ...p, [group]: !p[group] }))}
                        className="w-full flex items-center justify-between px-3 py-2 bg-muted/40 hover:bg-muted/60 transition-colors text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        {group}
                        <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', collapsed && '-rotate-90')} />
                      </button>
                      {!collapsed && (
                        <div className="divide-y divide-border/40">
                          {geps.map((ep) => (
                            <button key={ep.id} onClick={() => selectEndpoint(ep)}
                              className={cn('w-full flex items-center gap-2 px-3 py-2.5 text-left transition-colors',
                                selectedId === ep.id ? 'bg-primary/10' : 'hover:bg-muted/40 bg-card')}>
                              <MethodBadge method={ep.method} />
                              <span className={cn('text-xs font-mono truncate', selectedId === ep.id ? 'text-primary font-semibold' : 'text-foreground')}>
                                {ep.path}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </aside>

              {/* request panel */}
              <div className="space-y-4">
                <Card className="card-shadow border-border/60 p-4 space-y-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <MethodBadge method={endpoint.method} />
                    <span className="text-sm font-semibold">{endpoint.title}</span>
                    {reqStatus !== null && <StatusPill status={reqStatus} />}
                    {duration !== null && <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground"><Clock className="h-3 w-3" />{duration}ms</span>}
                  </div>
                  {(endpoint.pathParams ?? []).map((p) => (
                    <div key={p} className="flex items-center gap-2">
                      <Label className="text-xs shrink-0 font-mono text-muted-foreground">:{p}</Label>
                      <Input value={pathVals[p] ?? ''} onChange={(e) => setPathVals((prev) => ({ ...prev, [p]: e.target.value }))}
                        placeholder={`Enter ${p}`} className="h-8 text-xs font-mono w-64" />
                    </div>
                  ))}
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Query string</Label>
                    <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="limit=10&offset=0" className="h-8 text-xs font-mono" />
                  </div>
                  <div className="flex items-center gap-2 rounded-lg bg-muted/50 border border-border/40 px-3 py-2">
                    <Globe className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <code className="text-xs font-mono text-foreground break-all">{buildUrl()}</code>
                  </div>
                  {['POST', 'PATCH'].includes(endpoint.method) && (
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Request body (JSON)</Label>
                      <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="{}" rows={6} className="font-mono text-xs resize-y" />
                    </div>
                  )}
                  <Button onClick={runRequest} disabled={running} className="w-full gradient-primary gap-2">
                    {running ? <><Loader2 className="h-4 w-4 animate-spin" />Sending…</> : <><Play className="h-4 w-4" />Send request</>}
                  </Button>
                </Card>

                {response && (
                  <Card className="card-shadow border-border/60 overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/60 bg-muted/30">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Response</span>
                        {reqStatus !== null && <StatusPill status={reqStatus} />}
                        {duration !== null && <span className="flex items-center gap-1 text-xs text-muted-foreground"><Clock className="h-3 w-3" />{duration}ms</span>}
                      </div>
                      <button onClick={() => { navigator.clipboard.writeText(response); setCopiedRes(true); setTimeout(() => setCopiedRes(false), 2000); }}
                        className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded">
                        {copiedRes ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                    <div className="bg-[#1e1e2e] overflow-x-auto">
                      <pre className="p-4 text-[12.5px] font-mono text-white/85 leading-relaxed whitespace-pre max-h-[480px] overflow-y-auto">{response}</pre>
                    </div>
                  </Card>
                )}

                {logs.length > 0 && (
                  <Card className="card-shadow border-border/60 overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/60 bg-muted/30">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Request history</span>
                      <button onClick={() => setLogs([])} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                        <RefreshCw className="h-3 w-3" />Clear
                      </button>
                    </div>
                    <div className="divide-y divide-border/40 max-h-56 overflow-y-auto">
                      {logs.map((log) => (
                        <div key={log.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/20">
                          <MethodBadge method={log.method} />
                          <code className="text-xs font-mono text-muted-foreground truncate flex-1 min-w-0">{log.url.replace(BASE_URL, '')}</code>
                          <div className="flex items-center gap-2 shrink-0">
                            {log.status !== null ? <StatusPill status={log.status} /> : <span className="text-xs text-destructive flex items-center gap-1"><XCircle className="h-3 w-3" />Error</span>}
                            <span className="text-xs text-muted-foreground w-14 text-right">{log.duration}ms</span>
                            <span className="text-[10px] text-muted-foreground/60 w-20 text-right">{log.ts.toLocaleTimeString()}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════
            TAB: API DOCS
        ════════════════════════════════════════════════════════ */}
        {activeTab === 'docs' && (
          <div className="space-y-4">
            {/* base URL banner */}
            <Card className="card-shadow border-border/60 p-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Base URL</p>
                  <div className="flex items-center gap-2">
                    <Terminal className="h-4 w-4 text-primary shrink-0" />
                    <code className="text-sm font-mono break-all">{BASE_URL}</code>
                    <button onClick={() => { navigator.clipboard.writeText(BASE_URL); toast({ title: 'Copied' }); }} className="text-muted-foreground hover:text-primary transition-colors">
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button variant="outline" size="sm" className="gap-2" onClick={downloadDocs}>
                    <Download className="h-4 w-4" />Download
                  </Button>
                </div>
              </div>
            </Card>

            <div className="flex gap-6 items-start">
              {/* sticky sidebar */}
              <aside className="hidden lg:block w-48 shrink-0 sticky top-4">
                <Card className="card-shadow border-border/60 p-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-2 py-1.5">Contents</p>
                  <nav className="space-y-0.5">
                    {DOC_SECTIONS.map((item) => (
                      <button key={item.id} onClick={() => scrollDoc(item.id)}
                        className={cn('w-full flex items-center gap-2.5 rounded-[8px] px-2.5 py-1.5 text-sm transition-all duration-150 text-left',
                          docSection === item.id ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:text-foreground hover:bg-muted/60')}>
                        <item.icon className="h-3.5 w-3.5 shrink-0" />
                        <span className="text-xs">{item.label}</span>
                      </button>
                    ))}
                  </nav>
                </Card>
              </aside>

              {/* doc content */}
              <div className="flex-1 min-w-0 space-y-10">

                <section id="doc-overview" className="scroll-mt-4 space-y-4">
                  <h2 className="text-base font-semibold flex items-center gap-2 border-b border-border/60 pb-2"><BookOpen className="h-4 w-4 text-primary" />Overview</h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">The RemoAsset Connect API is a REST API that returns JSON. It lets you automate any action available in the app — creating leads, scheduling follow-ups, logging activities, managing tasks, and sending in-app notifications.</p>
                  <div className="grid sm:grid-cols-3 gap-3">
                    {[
                      { icon: Lock, title: 'API key auth', desc: 'Every request requires an API key as a Bearer token. Create and manage keys in the API Keys tab.' },
                      { icon: Zap, title: 'JSON everywhere', desc: 'All request and response bodies are JSON. Set Content-Type: application/json on POST and PATCH requests.' },
                      { icon: BookOpen, title: 'Paginated lists', desc: 'All list endpoints support limit (max 100) and offset. Responses include a total count field.' },
                    ].map((c) => (
                      <div key={c.title} className="rounded-xl border border-border/60 bg-card/50 p-4 space-y-2">
                        <div className="flex items-center gap-2"><div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10"><c.icon className="h-3.5 w-3.5 text-primary" /></div><span className="text-sm font-semibold">{c.title}</span></div>
                        <p className="text-xs text-muted-foreground leading-relaxed">{c.desc}</p>
                      </div>
                    ))}
                  </div>
                </section>

                <section id="doc-authentication" className="scroll-mt-4 space-y-4">
                  <h2 className="text-base font-semibold flex items-center gap-2 border-b border-border/60 pb-2"><Lock className="h-4 w-4 text-primary" />Authentication</h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">All requests must include your API key as a Bearer token. Keys are shown only once — store them securely.</p>
                  <CodeBlock language="http" code={`Authorization: Bearer ra_<your_api_key>`} />
                  <CodeBlock language="bash" code={`curl -H "Authorization: Bearer ra_<your_api_key>" \\\n     -H "Content-Type: application/json" \\\n     ${BASE_URL}/leads`} />
                  <div className="flex items-start gap-3 rounded-xl border border-warning/30 bg-warning/5 p-3.5">
                    <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                    <p className="text-xs text-muted-foreground">Never expose API keys in client-side code or public repositories.</p>
                  </div>
                </section>

                <section id="doc-pagination" className="scroll-mt-4 space-y-4">
                  <h2 className="text-base font-semibold flex items-center gap-2 border-b border-border/60 pb-2"><Layers className="h-4 w-4 text-primary" />Pagination</h2>
                  <p className="text-sm text-muted-foreground">All list endpoints support <code className="bg-muted px-1.5 py-0.5 rounded-md text-xs font-mono">limit</code> (max 100, default 50) and <code className="bg-muted px-1.5 py-0.5 rounded-md text-xs font-mono">offset</code>. Responses include a <code className="bg-muted px-1.5 py-0.5 rounded-md text-xs font-mono">total</code> field.</p>
                  <ParamTable rows={[
                    { name: 'limit', type: 'number', description: 'Max records. Default 50, max 100.' },
                    { name: 'offset', type: 'number', description: 'Records to skip. Combine with limit for pagination.' },
                  ]} />
                </section>

                <section id="doc-leads" className="scroll-mt-4 space-y-4">
                  <h2 className="text-base font-semibold flex items-center gap-2 border-b border-border/60 pb-2"><Users className="h-4 w-4 text-primary" />Leads</h2>
                  <Accordion type="multiple" className="space-y-2">
                    <EndpointRow method="GET" path="/leads" title="List leads" queryParams={[{ name: 'limit', type: 'number', description: 'Max results' }, { name: 'offset', type: 'number', description: 'Pagination offset' }, { name: 'status_id', type: 'uuid', description: 'Filter by stage' }, { name: 'owner_id', type: 'uuid', description: 'Filter by owner' }, { name: 'search', type: 'string', description: 'Full-text search' }]} responseExample={`{ "data": [ { "id": "uuid", "company_name": "Acme Corp", ... } ], "total": 42 }`} />
                    <EndpointRow method="GET" path="/leads/:id" title="Get a lead" responseExample={`{ "id": "uuid", "company_name": "Acme Corp", ... }`} />
                    <EndpointRow method="POST" path="/leads" title="Create a lead" bodyParams={[{ name: 'company_name', type: 'string', required: true, description: 'Company name' }, { name: 'contact_name', type: 'string', description: 'Primary contact' }, { name: 'email', type: 'string', description: 'Contact email' }, { name: 'status_id', type: 'uuid', description: 'Pipeline stage' }, { name: 'owner_id', type: 'uuid', description: 'Assigned member' }, { name: 'deal_value', type: 'number', description: 'Estimated value' }]} />
                    <EndpointRow method="PATCH" path="/leads/:id" title="Update a lead" bodyParams={[{ name: 'company_name', type: 'string', description: 'New name' }, { name: 'status_id', type: 'uuid', description: 'Move to stage' }, { name: 'owner_id', type: 'uuid', description: 'Reassign' }, { name: 'deal_value', type: 'number', description: 'Update value' }]} />
                    <EndpointRow method="DELETE" path="/leads/:id" title="Delete a lead" responseExample={`{ "success": true }`} />
                    <EndpointRow method="PATCH" path="/leads/bulk" title="Bulk update leads" bodyParams={[{ name: 'lead_ids', type: 'uuid[]', required: true, description: 'IDs to update' }, { name: 'status_id', type: 'uuid', description: 'Set stage' }, { name: 'owner_id', type: 'uuid', description: 'Reassign all' }]} responseExample={`{ "updated": 5 }`} />
                  </Accordion>
                </section>

                <section id="doc-tasks" className="scroll-mt-4 space-y-4">
                  <h2 className="text-base font-semibold flex items-center gap-2 border-b border-border/60 pb-2"><ListTodo className="h-4 w-4 text-primary" />Tasks</h2>
                  <Accordion type="multiple" className="space-y-2">
                    <EndpointRow method="GET" path="/tasks" title="List tasks" queryParams={[{ name: 'assignee_id', type: 'uuid', description: 'Filter by assignee' }, { name: 'lead_id', type: 'uuid', description: 'Filter by lead' }, { name: 'is_completed', type: 'boolean', description: 'Filter by completion' }, { name: 'limit', type: 'number', description: 'Default 50' }, { name: 'offset', type: 'number', description: 'Pagination' }]} />
                    <EndpointRow method="GET" path="/tasks/:id" title="Get a task" />
                    <EndpointRow method="POST" path="/tasks" title="Create a task" bodyParams={[{ name: 'title', type: 'string', required: true, description: 'Task title' }, { name: 'lead_id', type: 'uuid', description: 'Linked lead' }, { name: 'assignee_id', type: 'uuid', description: 'Assigned to' }, { name: 'due_date', type: 'date', description: 'YYYY-MM-DD' }, { name: 'priority', type: 'string', description: 'low / medium / high' }]} />
                    <EndpointRow method="PATCH" path="/tasks/:id" title="Update a task" bodyParams={[{ name: 'is_completed', type: 'boolean', description: 'Mark complete' }, { name: 'due_date', type: 'date', description: 'New due date' }, { name: 'priority', type: 'string', description: 'low / medium / high' }]} />
                    <EndpointRow method="DELETE" path="/tasks/:id" title="Delete a task" responseExample={`{ "success": true }`} />
                  </Accordion>
                </section>

                <section id="doc-follow-ups" className="scroll-mt-4 space-y-4">
                  <h2 className="text-base font-semibold flex items-center gap-2 border-b border-border/60 pb-2"><CalendarCheck className="h-4 w-4 text-primary" />Follow-ups</h2>
                  <Accordion type="multiple" className="space-y-2">
                    <EndpointRow method="GET" path="/follow_ups" title="List follow-ups" queryParams={[{ name: 'lead_id', type: 'uuid', description: 'Filter by lead' }, { name: 'user_id', type: 'uuid', description: 'Filter by member' }, { name: 'limit', type: 'number', description: 'Default 50' }, { name: 'offset', type: 'number', description: 'Pagination' }]} />
                    <EndpointRow method="GET" path="/follow_ups/:id" title="Get a follow-up" />
                    <EndpointRow method="POST" path="/follow_ups" title="Schedule a follow-up" bodyParams={[{ name: 'lead_id', type: 'uuid', required: true, description: 'Associated lead' }, { name: 'user_id', type: 'uuid', required: true, description: 'Responsible member' }, { name: 'scheduled_at', type: 'datetime', required: true, description: 'ISO 8601 UTC' }, { name: 'notes', type: 'string', description: 'Notes' }]} />
                    <EndpointRow method="PATCH" path="/follow_ups/:id" title="Update a follow-up" bodyParams={[{ name: 'scheduled_at', type: 'datetime', description: 'Reschedule' }, { name: 'is_completed', type: 'boolean', description: 'Mark complete' }]} />
                    <EndpointRow method="DELETE" path="/follow_ups/:id" title="Delete a follow-up" />
                  </Accordion>
                </section>

                <section id="doc-activities" className="scroll-mt-4 space-y-4">
                  <h2 className="text-base font-semibold flex items-center gap-2 border-b border-border/60 pb-2"><Activity className="h-4 w-4 text-primary" />Activities</h2>
                  <Accordion type="multiple" className="space-y-2">
                    <EndpointRow method="GET" path="/activities" title="List activities" queryParams={[{ name: 'lead_id', type: 'uuid', description: 'Filter by lead' }, { name: 'limit', type: 'number', description: 'Default 50' }, { name: 'offset', type: 'number', description: 'Pagination' }]} />
                    <EndpointRow method="GET" path="/activities/:id" title="Get an activity" />
                    <EndpointRow method="POST" path="/activities" title="Log an activity" bodyParams={[{ name: 'lead_id', type: 'uuid', required: true, description: 'Associated lead' }, { name: 'user_id', type: 'uuid', required: true, description: 'Who logged it' }, { name: 'type', type: 'string', required: true, description: 'call / email / meeting / note / whatsapp / other' }, { name: 'description', type: 'string', description: 'What happened' }]} />
                    <EndpointRow method="PATCH" path="/activities/:id" title="Update an activity" bodyParams={[{ name: 'description', type: 'string', description: 'Updated description' }, { name: 'type', type: 'string', description: 'Updated type' }]} />
                    <EndpointRow method="DELETE" path="/activities/:id" title="Delete an activity" />
                  </Accordion>
                </section>

                <section id="doc-notifications" className="scroll-mt-4 space-y-4">
                  <h2 className="text-base font-semibold flex items-center gap-2 border-b border-border/60 pb-2"><Bell className="h-4 w-4 text-primary" />Notifications</h2>
                  <Accordion type="multiple" className="space-y-2">
                    <EndpointRow method="GET" path="/notifications" title="List notifications" queryParams={[{ name: 'user_id', type: 'uuid', required: true, description: 'Recipient member' }, { name: 'limit', type: 'number', description: 'Default 50' }]} />
                    <EndpointRow method="POST" path="/notifications" title="Send a notification" bodyParams={[{ name: 'user_id', type: 'uuid', required: true, description: 'Recipient' }, { name: 'title', type: 'string', required: true, description: 'Short title' }, { name: 'message', type: 'string', required: true, description: 'Full message' }, { name: 'type', type: 'string', description: 'info / warning / success / task / lead / email' }]} />
                  </Accordion>
                </section>

                <section id="doc-reference" className="scroll-mt-4 space-y-4">
                  <h2 className="text-base font-semibold flex items-center gap-2 border-b border-border/60 pb-2"><Database className="h-4 w-4 text-primary" />Reference data</h2>
                  <Accordion type="multiple" className="space-y-2">
                    <EndpointRow method="GET" path="/team" title="List team members" responseExample={`[ { "user_id": "uuid", "role": "admin", "full_name": "Ranjith Kumar" }, ... ]`} />
                    <EndpointRow method="GET" path="/statuses" title="List pipeline statuses" responseExample={`[ { "id": "uuid", "name": "Prospect", "color": "#6366f1", "sort_order": 1 }, ... ]`} />
                    <EndpointRow method="GET" path="/countries" title="List countries" />
                    <EndpointRow method="GET" path="/profiles" title="List profiles" />
                  </Accordion>
                </section>

                <section id="doc-errors" className="scroll-mt-4 space-y-4">
                  <h2 className="text-base font-semibold flex items-center gap-2 border-b border-border/60 pb-2"><AlertTriangle className="h-4 w-4 text-primary" />Status codes</h2>
                  <div className="rounded-xl border border-border/60 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/40 border-b border-border/60">
                        <tr><th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground w-16">Code</th><th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground w-32">Status</th><th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Meaning</th></tr>
                      </thead>
                      <tbody className="divide-y divide-border/40">
                        {[['200','OK','Request succeeded.'],['201','Created','Record created.'],['400','Bad Request','Missing fields or bad values.'],['401','Unauthorized','Missing or invalid API key.'],['403','Forbidden','Insufficient permissions.'],['404','Not Found','Resource not found.'],['500','Server Error','Unexpected error.']].map(([code, status, meaning]) => (
                          <tr key={code} className="hover:bg-muted/30"><td className="px-4 py-2.5 font-mono text-xs font-bold">{code}</td><td className="px-4 py-2.5 text-xs text-muted-foreground font-medium">{status}</td><td className="px-4 py-2.5 text-xs text-muted-foreground">{meaning}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                <section id="doc-faq" className="scroll-mt-4 space-y-4">
                  <h2 className="text-base font-semibold flex items-center gap-2 border-b border-border/60 pb-2"><HelpCircle className="h-4 w-4 text-primary" />FAQ</h2>
                  <Accordion type="multiple" className="space-y-2">
                    {[
                      { q: 'Where do I create an API key?', a: 'Go to Developer → API Keys. Click "Create API key", enter a name, and copy the key — it is shown only once.' },
                      { q: 'How do I find status_id or owner_id values?', a: 'Call GET /statuses for pipeline stages, GET /team for team member IDs, and GET /countries for country IDs.' },
                      { q: 'What datetime format should I use?', a: 'Use ISO 8601 UTC: YYYY-MM-DDTHH:MM:SSZ — for example 2026-03-10T09:00:00Z.' },
                      { q: 'Is there a rate limit?', a: 'No hard rate limit currently. Use the API responsibly.' },
                      { q: 'How do I revoke an API key?', a: 'Go to Developer → API Keys and click the trash icon. It is immediately invalidated.' },
                    ].map((item) => (
                      <AccordionItem key={item.q} value={item.q} className="border border-border/60 rounded-xl overflow-hidden bg-card/50">
                        <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/30 text-sm font-medium text-left [&>svg]:text-muted-foreground">{item.q}</AccordionTrigger>
                        <AccordionContent className="px-4 pb-4 pt-1 text-sm text-muted-foreground leading-relaxed border-t border-border/60 bg-muted/10">{item.a}</AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </section>

              </div>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════
            TAB: DEV TOOLS
        ════════════════════════════════════════════════════════ */}
        {activeTab === 'tools' && (
          <div className="space-y-6 max-w-3xl">
            <div>
              <h2 className="text-base font-semibold">Dev Tools</h2>
              <p className="text-sm text-muted-foreground">Session inspector, environment variables, and Edge Function health checks.</p>
            </div>

            {/* session */}
            <Card className="card-shadow border-border/60 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-b border-border/60">
                <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" /><span className="text-sm font-semibold">Current session</span></div>
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={loadSession} disabled={devSessionLoading}>
                  {devSessionLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}Load
                </Button>
              </div>
              {devSession ? (
                <div className="divide-y divide-border/40">
                  {Object.entries(devSession).map(([k, v]) => (
                    <div key={k} className="flex items-center px-4 py-2.5 gap-4">
                      <span className="text-xs font-mono text-muted-foreground w-28 shrink-0">{k}</span>
                      <span className="text-xs font-mono text-foreground break-all">{String(v)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">Click Load to inspect the active session.</p>
              )}
            </Card>

            {/* env vars */}
            <Card className="card-shadow border-border/60 overflow-hidden">
              <button onClick={() => setDevEnvOpen((p) => !p)}
                className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 border-b border-border/60 hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-2"><Database className="h-4 w-4 text-primary" /><span className="text-sm font-semibold">Environment variables</span></div>
                <ChevronRight className={cn('h-4 w-4 text-muted-foreground transition-transform', devEnvOpen && 'rotate-90')} />
              </button>
              {devEnvOpen && (
                <div className="divide-y divide-border/40">
                  {[
                    { key: 'VITE_SUPABASE_URL', val: import.meta.env.VITE_SUPABASE_URL ?? '—' },
                    { key: 'VITE_SUPABASE_PROJECT_ID', val: import.meta.env.VITE_SUPABASE_PROJECT_ID ?? '—' },
                    { key: 'VITE_SUPABASE_ANON_KEY', val: `${(import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').slice(0, 20)}…` },
                    { key: 'MODE', val: import.meta.env.MODE },
                    { key: 'DEV', val: String(import.meta.env.DEV) },
                    { key: 'PROD', val: String(import.meta.env.PROD) },
                  ].map(({ key, val }) => (
                    <div key={key} className="flex items-center px-4 py-2.5 gap-4 hover:bg-muted/20">
                      <span className="text-xs font-mono text-primary w-52 shrink-0">{key}</span>
                      <span className="text-xs font-mono text-foreground break-all">{val}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* edge function health */}
            <Card className="card-shadow border-border/60 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-b border-border/60">
                <div className="flex items-center gap-2"><Zap className="h-4 w-4 text-primary" /><span className="text-sm font-semibold">Edge Function health</span></div>
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={pingAll}><RefreshCw className="h-3 w-3" />Ping all</Button>
              </div>
              <div className="divide-y divide-border/40">
                {EDGE_FUNCTIONS.map((fn) => {
                  const s = devFnResults[fn.id] ?? { status: 'idle' };
                  return (
                    <div key={fn.id} className="flex items-center px-4 py-3 gap-3 hover:bg-muted/20">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-mono font-medium">{fn.label}</p>
                        <p className="text-xs text-muted-foreground">{fn.desc}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {s.status === 'idle' && <span className="text-xs text-muted-foreground">—</span>}
                        {s.status === 'loading' && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                        {s.status === 'ok' && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-2 py-0.5 text-xs font-semibold"><CheckCircle2 className="h-3 w-3" />Online{s.ms !== undefined && ` · ${s.ms}ms`}</span>}
                        {s.status === 'error' && <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 text-destructive border border-destructive/20 px-2 py-0.5 text-xs font-semibold"><XCircle className="h-3 w-3" />{s.body ?? 'Error'}{s.ms !== undefined && ` · ${s.ms}ms`}</span>}
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => pingFunction(fn.id)}><RefreshCw className="h-3 w-3" /></Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* quick links */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { label: 'Supabase Dashboard', desc: 'DB & logs', icon: Database, action: () => window.open(`https://supabase.com/dashboard/project/${import.meta.env.VITE_SUPABASE_PROJECT_ID}`, '_blank') },
                { label: 'Edge Fn Logs', desc: 'Function logs', icon: Layers, action: () => window.open(`https://supabase.com/dashboard/project/${import.meta.env.VITE_SUPABASE_PROJECT_ID}/functions`, '_blank') },
                { label: 'Auth Users', desc: 'Manage users', icon: Users, action: () => window.open(`https://supabase.com/dashboard/project/${import.meta.env.VITE_SUPABASE_PROJECT_ID}/auth/users`, '_blank') },
                { label: 'Team Activity', desc: 'Recent actions', icon: Activity, action: () => navigate('/admin/team-activity') },
                { label: 'Admin Panel', desc: 'App settings', icon: ShieldCheck, action: () => navigate('/admin') },
              ].map((item) => (
                <button key={item.label} onClick={item.action}
                  className="flex items-center gap-3 p-4 rounded-xl border border-border/60 bg-card/50 hover:bg-card hover:border-primary/30 transition-all text-left group">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 shrink-0 group-hover:bg-primary/20 transition-colors">
                    <item.icon className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium leading-none mb-1">{item.label}</p>
                    <p className="text-xs text-muted-foreground truncate">{item.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* dialogs */}
      <Dialog open={createKeyOpen} onOpenChange={(open) => { setCreateKeyOpen(open); if (!open) { setCreatedKeyOnce(null); setNewKeyName(''); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{createdKeyOnce ? 'API key created' : 'Create API key'}</DialogTitle></DialogHeader>
          {createdKeyOnce ? (
            <div className="space-y-3 py-2">
              <p className="text-sm text-muted-foreground">Copy this key now — it won't be shown again.</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded-lg bg-muted px-3 py-2 text-sm font-mono break-all">{createdKeyOnce.api_key}</code>
                <Button variant="outline" size="icon" onClick={() => { navigator.clipboard.writeText(createdKeyOnce!.api_key); toast({ title: 'Copied' }); }}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <DialogFooter><Button onClick={() => { setCreateKeyOpen(false); setCreatedKeyOnce(null); }}>Done</Button></DialogFooter>
            </div>
          ) : (
            <>
              <div className="space-y-2 py-2">
                <Label htmlFor="key-name">Key name</Label>
                <Input id="key-name" placeholder="e.g. Production app" value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateKey()} />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateKeyOpen(false)}>Cancel</Button>
                <Button onClick={handleCreateKey} disabled={apiKeyLoading || !newKeyName.trim()}>{apiKeyLoading ? 'Creating…' : 'Create key'}</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!revokeKeyId} onOpenChange={(open) => !open && setRevokeKeyId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke API key?</AlertDialogTitle>
            <AlertDialogDescription>Any app using this key will stop working. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRevokeKey} className="bg-destructive text-destructive-foreground">Revoke</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
