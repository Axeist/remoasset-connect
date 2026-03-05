import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  Play, Copy, Check, ChevronRight, Terminal, Loader2, RefreshCw,
  Globe, Key, Clock, CheckCircle2, XCircle, AlertTriangle, ExternalLink,
  ChevronDown, Zap,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const BASE_URL = `${import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, '')}/functions/v1/api`;

// ─── types ────────────────────────────────────────────────────────────────────

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';

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
  error?: string;
}

// ─── endpoint catalog ─────────────────────────────────────────────────────────

const ENDPOINTS: Endpoint[] = [
  // Reference
  { id: 'team',        method: 'GET',    path: '/team',       title: 'List team members',    group: 'Reference' },
  { id: 'statuses',    method: 'GET',    path: '/statuses',   title: 'List pipeline statuses', group: 'Reference' },
  { id: 'countries',   method: 'GET',    path: '/countries',  title: 'List countries',       group: 'Reference' },
  { id: 'profiles',    method: 'GET',    path: '/profiles',   title: 'List profiles',        group: 'Reference' },
  // Leads
  { id: 'leads-list',  method: 'GET',    path: '/leads',      title: 'List leads',           group: 'Leads',     defaultQuery: 'limit=10&offset=0' },
  { id: 'leads-get',   method: 'GET',    path: '/leads/:id',  title: 'Get a lead',           group: 'Leads',     pathParams: ['id'] },
  { id: 'leads-create',method: 'POST',   path: '/leads',      title: 'Create a lead',        group: 'Leads',     defaultBody: JSON.stringify({ company_name: 'Acme Corp', contact_name: 'Jane Doe', email: 'jane@acme.com' }, null, 2) },
  { id: 'leads-update',method: 'PATCH',  path: '/leads/:id',  title: 'Update a lead',        group: 'Leads',     pathParams: ['id'], defaultBody: JSON.stringify({ deal_value: 50000 }, null, 2) },
  { id: 'leads-delete',method: 'DELETE', path: '/leads/:id',  title: 'Delete a lead',        group: 'Leads',     pathParams: ['id'] },
  { id: 'leads-bulk',  method: 'PATCH',  path: '/leads/bulk', title: 'Bulk update leads',    group: 'Leads',     defaultBody: JSON.stringify({ lead_ids: [], owner_id: '' }, null, 2) },
  // Tasks
  { id: 'tasks-list',  method: 'GET',    path: '/tasks',      title: 'List tasks',           group: 'Tasks',     defaultQuery: 'limit=10&offset=0' },
  { id: 'tasks-get',   method: 'GET',    path: '/tasks/:id',  title: 'Get a task',           group: 'Tasks',     pathParams: ['id'] },
  { id: 'tasks-create',method: 'POST',   path: '/tasks',      title: 'Create a task',        group: 'Tasks',     defaultBody: JSON.stringify({ title: 'Send proposal', due_date: '2026-03-15', priority: 'high' }, null, 2) },
  { id: 'tasks-update',method: 'PATCH',  path: '/tasks/:id',  title: 'Update a task',        group: 'Tasks',     pathParams: ['id'], defaultBody: JSON.stringify({ is_completed: true }, null, 2) },
  { id: 'tasks-delete',method: 'DELETE', path: '/tasks/:id',  title: 'Delete a task',        group: 'Tasks',     pathParams: ['id'] },
  // Follow-ups
  { id: 'fu-list',     method: 'GET',    path: '/follow_ups', title: 'List follow-ups',      group: 'Follow-ups',defaultQuery: 'limit=10&offset=0' },
  { id: 'fu-get',      method: 'GET',    path: '/follow_ups/:id', title: 'Get a follow-up',  group: 'Follow-ups',pathParams: ['id'] },
  { id: 'fu-create',   method: 'POST',   path: '/follow_ups', title: 'Schedule a follow-up', group: 'Follow-ups',defaultBody: JSON.stringify({ lead_id: '', user_id: '', scheduled_at: '2026-03-15T09:00:00Z', notes: 'Demo call' }, null, 2) },
  { id: 'fu-update',   method: 'PATCH',  path: '/follow_ups/:id', title: 'Update a follow-up',group: 'Follow-ups',pathParams: ['id'], defaultBody: JSON.stringify({ is_completed: true }, null, 2) },
  { id: 'fu-delete',   method: 'DELETE', path: '/follow_ups/:id', title: 'Delete a follow-up',group: 'Follow-ups',pathParams: ['id'] },
  // Activities
  { id: 'act-list',    method: 'GET',    path: '/activities', title: 'List activities',      group: 'Activities',defaultQuery: 'limit=10&offset=0' },
  { id: 'act-get',     method: 'GET',    path: '/activities/:id', title: 'Get an activity',  group: 'Activities',pathParams: ['id'] },
  { id: 'act-create',  method: 'POST',   path: '/activities', title: 'Log an activity',      group: 'Activities',defaultBody: JSON.stringify({ lead_id: '', user_id: '', type: 'call', description: 'Discussed pricing' }, null, 2) },
  { id: 'act-update',  method: 'PATCH',  path: '/activities/:id', title: 'Update an activity',group: 'Activities',pathParams: ['id'], defaultBody: JSON.stringify({ description: 'Updated notes' }, null, 2) },
  { id: 'act-delete',  method: 'DELETE', path: '/activities/:id', title: 'Delete an activity',group: 'Activities',pathParams: ['id'] },
  // Notifications
  { id: 'notif-list',  method: 'GET',    path: '/notifications', title: 'List notifications',  group: 'Notifications', defaultQuery: 'user_id=' },
  { id: 'notif-create',method: 'POST',   path: '/notifications', title: 'Send a notification', group: 'Notifications', defaultBody: JSON.stringify({ user_id: '', title: 'Test notification', message: 'Hello from API tester', type: 'info' }, null, 2) },
];

const GROUPS = [...new Set(ENDPOINTS.map((e) => e.group))];

// ─── helpers ──────────────────────────────────────────────────────────────────

function MethodBadge({ method }: { method: Method }) {
  const styles: Record<Method, string> = {
    GET:    'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
    POST:   'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    PATCH:  'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    DELETE: 'bg-destructive/10 text-destructive border-destructive/20',
  };
  return (
    <span className={cn('inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold font-mono tracking-wider shrink-0', styles[method])}>
      {method}
    </span>
  );
}

function StatusPill({ status }: { status: number | null }) {
  if (status === null) return null;
  const ok = status >= 200 && status < 300;
  return (
    <span className={cn(
      'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold border',
      ok ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
         : 'bg-destructive/10 text-destructive border-destructive/20'
    )}>
      {ok ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
      {status}
    </span>
  );
}

function prettyJson(raw: string): string {
  try { return JSON.stringify(JSON.parse(raw), null, 2); } catch { return raw; }
}

// ─── main page ────────────────────────────────────────────────────────────────

export default function ApiTester() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [apiKey, setApiKey]           = useState('');
  const [selectedId, setSelectedId]   = useState<string>(ENDPOINTS[0].id);
  const [pathVals, setPathVals]       = useState<Record<string, string>>({});
  const [query, setQuery]             = useState('');
  const [body, setBody]               = useState('');
  const [response, setResponse]       = useState('');
  const [status, setStatus]           = useState<number | null>(null);
  const [duration, setDuration]       = useState<number | null>(null);
  const [loading, setLoading]         = useState(false);
  const [logs, setLogs]               = useState<RequestLog[]>([]);
  const [copiedRes, setCopiedRes]     = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const endpoint = ENDPOINTS.find((e) => e.id === selectedId)!;

  const selectEndpoint = (ep: Endpoint) => {
    setSelectedId(ep.id);
    setPathVals({});
    setQuery(ep.defaultQuery ?? '');
    setBody(ep.defaultBody ?? '');
    setResponse('');
    setStatus(null);
    setDuration(null);
  };

  const buildUrl = useCallback(() => {
    let path = endpoint.path;
    for (const [k, v] of Object.entries(pathVals)) {
      path = path.replace(`:${k}`, encodeURIComponent(v));
    }
    const q = query.trim();
    return `${BASE_URL}${path}${q ? `?${q}` : ''}`;
  }, [endpoint, pathVals, query]);

  const run = async () => {
    if (!apiKey.trim()) {
      toast({ variant: 'destructive', title: 'API key required', description: 'Paste an API key in the field above.' });
      return;
    }
    const url = buildUrl();
    const start = Date.now();
    setLoading(true);
    setResponse('');
    setStatus(null);
    setDuration(null);

    try {
      const opts: RequestInit = {
        method: endpoint.method,
        headers: {
          'Authorization': `Bearer ${apiKey.trim()}`,
          'Content-Type': 'application/json',
        },
      };
      if (['POST', 'PATCH'].includes(endpoint.method) && body.trim()) {
        opts.body = body;
      }
      const res = await fetch(url, opts);
      const elapsed = Date.now() - start;
      const text = await res.text();
      setStatus(res.status);
      setDuration(elapsed);
      setResponse(prettyJson(text));
      setLogs((prev) => [{
        id: crypto.randomUUID(),
        method: endpoint.method,
        url,
        status: res.status,
        duration: elapsed,
        ts: new Date(),
        ok: res.ok,
      }, ...prev.slice(0, 19)]);
    } catch (err) {
      const elapsed = Date.now() - start;
      const msg = err instanceof Error ? err.message : 'Network error';
      setStatus(null);
      setDuration(elapsed);
      setResponse(JSON.stringify({ error: msg }, null, 2));
      setLogs((prev) => [{
        id: crypto.randomUUID(),
        method: endpoint.method,
        url,
        status: null,
        duration: elapsed,
        ts: new Date(),
        ok: false,
        error: msg,
      }, ...prev.slice(0, 19)]);
    }
    setLoading(false);
  };

  const copyRes = () => {
    navigator.clipboard.writeText(response);
    setCopiedRes(true);
    setTimeout(() => setCopiedRes(false), 2000);
  };

  const fillFromSession = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      setApiKey(session.access_token);
      toast({ title: 'Session token pasted', description: 'Using your current JWT as the API key.' });
    }
  };

  const toggleGroup = (g: string) => setCollapsedGroups((p) => ({ ...p, [g]: !p[g] }));

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto space-y-5 animate-fade-in-up">

        {/* header */}
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 shrink-0">
            <Terminal className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h1 className="text-2xl font-display font-bold tracking-tight">API Tester</h1>
              <Badge variant="secondary" className="text-xs">Live</Badge>
            </div>
            <p className="text-muted-foreground text-sm">
              Fire real requests against the RemoAsset Connect API and inspect responses.
            </p>
          </div>
          <div className="hidden sm:flex gap-2 shrink-0">
            <Button variant="outline" size="sm" className="gap-2" onClick={() => navigate('/admin/api-docs')}>
              <ExternalLink className="h-4 w-4" />API Docs
            </Button>
            <Button variant="outline" size="sm" className="gap-2" onClick={() => navigate('/admin')}>
              <Key className="h-4 w-4" />Manage keys
            </Button>
          </div>
        </div>

        {/* API key bar */}
        <Card className="card-shadow border-border/60 p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="flex items-center gap-2 shrink-0">
              <Key className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">API Key</span>
            </div>
            <Input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="ra_••••••••••••••••••••••••••••••••"
              className="flex-1 font-mono text-sm h-9"
            />
          </div>
          {!apiKey && (
            <p className="mt-2 text-xs text-muted-foreground flex items-center gap-1.5">
              <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0" />
              Requires a <code className="font-mono bg-muted px-1 rounded">ra_...</code> API key — <strong>not</strong> a session token. Create one in Admin → API tab.
            </p>
          )}
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4 items-start">

          {/* ── endpoint list ── */}
          <aside className="space-y-1 lg:sticky lg:top-4">
            {GROUPS.map((group) => {
              const groupEps = ENDPOINTS.filter((e) => e.group === group);
              const collapsed = collapsedGroups[group];
              return (
                <div key={group} className="rounded-xl border border-border/60 overflow-hidden">
                  <button
                    onClick={() => toggleGroup(group)}
                    className="w-full flex items-center justify-between px-3 py-2 bg-muted/40 hover:bg-muted/60 transition-colors text-xs font-semibold text-muted-foreground uppercase tracking-wider"
                  >
                    {group}
                    <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', collapsed && '-rotate-90')} />
                  </button>
                  {!collapsed && (
                    <div className="divide-y divide-border/40">
                      {groupEps.map((ep) => (
                        <button
                          key={ep.id}
                          onClick={() => selectEndpoint(ep)}
                          className={cn(
                            'w-full flex items-center gap-2 px-3 py-2.5 text-left transition-colors',
                            selectedId === ep.id
                              ? 'bg-primary/10'
                              : 'hover:bg-muted/40 bg-card'
                          )}
                        >
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

          {/* ── request/response panel ── */}
          <div className="space-y-4">

            {/* endpoint title + URL bar */}
            <Card className="card-shadow border-border/60 p-4 space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <MethodBadge method={endpoint.method} />
                <span className="text-sm font-semibold text-foreground">{endpoint.title}</span>
                {status !== null && <StatusPill status={status} />}
                {duration !== null && (
                  <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />{duration}ms
                  </span>
                )}
              </div>

              {/* path params */}
              {(endpoint.pathParams ?? []).length > 0 && (
                <div className="flex flex-wrap gap-3">
                  {endpoint.pathParams!.map((p) => (
                    <div key={p} className="flex items-center gap-2">
                      <Label className="text-xs shrink-0 font-mono text-muted-foreground">:{p}</Label>
                      <Input
                        value={pathVals[p] ?? ''}
                        onChange={(e) => setPathVals((prev) => ({ ...prev, [p]: e.target.value }))}
                        placeholder={`Enter ${p}`}
                        className="h-8 text-xs font-mono w-64"
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* query string */}
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Query string</Label>
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="limit=10&offset=0"
                  className="h-8 text-xs font-mono"
                />
              </div>

              {/* full URL preview */}
              <div className="flex items-center gap-2 rounded-lg bg-muted/50 border border-border/40 px-3 py-2">
                <Globe className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <code className="text-xs font-mono text-foreground break-all leading-relaxed">{buildUrl()}</code>
              </div>

              {/* body */}
              {['POST', 'PATCH'].includes(endpoint.method) && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Request body (JSON)</Label>
                  <Textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="{}"
                    rows={6}
                    className="font-mono text-xs resize-y"
                  />
                </div>
              )}

              <Button
                onClick={run}
                disabled={loading}
                className="w-full gradient-primary gap-2"
              >
                {loading
                  ? <><Loader2 className="h-4 w-4 animate-spin" />Sending…</>
                  : <><Play className="h-4 w-4" />Send request</>}
              </Button>
            </Card>

            {/* response */}
            {response && (
              <Card className="card-shadow border-border/60 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/60 bg-muted/30">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Response</span>
                    {status !== null && <StatusPill status={status} />}
                    {duration !== null && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />{duration}ms
                      </span>
                    )}
                  </div>
                  <button onClick={copyRes} className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded">
                    {copiedRes ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </div>
                <div className="relative bg-[#1e1e2e] overflow-x-auto">
                  <pre className="p-4 text-[12.5px] font-mono text-white/85 leading-relaxed whitespace-pre max-h-[480px] overflow-y-auto">{response}</pre>
                </div>
              </Card>
            )}

            {/* request log */}
            {logs.length > 0 && (
              <Card className="card-shadow border-border/60 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/60 bg-muted/30">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Request history</span>
                  <button onClick={() => setLogs([])} className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
                    <RefreshCw className="h-3 w-3" />Clear
                  </button>
                </div>
                <div className="divide-y divide-border/40 max-h-56 overflow-y-auto">
                  {logs.map((log) => (
                    <div key={log.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/20 transition-colors">
                      <MethodBadge method={log.method} />
                      <code className="text-xs font-mono text-muted-foreground truncate flex-1 min-w-0">{log.url.replace(BASE_URL, '')}</code>
                      <div className="flex items-center gap-2 shrink-0">
                        {log.status !== null
                          ? <StatusPill status={log.status} />
                          : <span className="text-xs text-destructive flex items-center gap-1"><XCircle className="h-3 w-3" />Error</span>}
                        <span className="text-xs text-muted-foreground w-14 text-right">{log.duration}ms</span>
                        <span className="text-[10px] text-muted-foreground/60 w-20 text-right">
                          {log.ts.toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
