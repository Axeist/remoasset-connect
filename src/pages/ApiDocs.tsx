import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  ChevronDown, ChevronRight, Copy, Check, Download, ExternalLink,
  Terminal, Lock, Zap, BookOpen, HelpCircle, Globe, FileText,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const BASE_URL = `${import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, '')}/functions/v1/api`;
const LAST_UPDATED = 'March 5, 2026';

// ─── helpers ─────────────────────────────────────────────────────────────────

function Method({ method }: { method: string }) {
  const colour: Record<string, string> = {
    GET: 'bg-blue-500/10 text-blue-500 border-blue-500/30',
    POST: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30',
    PATCH: 'bg-amber-500/10 text-amber-500 border-amber-500/30',
    DELETE: 'bg-red-500/10 text-red-500 border-red-500/30',
  };
  return (
    <span className={cn('inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-bold font-mono tracking-wider shrink-0', colour[method] ?? 'bg-muted text-muted-foreground border-border')}>
      {method}
    </span>
  );
}

function CodeBlock({ code, language = 'bash' }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    toast({ title: 'Copied to clipboard' });
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="relative group rounded-lg bg-zinc-950 border border-zinc-800 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-1.5 border-b border-zinc-800 bg-zinc-900/60">
        <span className="text-[11px] font-mono text-zinc-500">{language}</span>
        <button onClick={copy} className="text-zinc-500 hover:text-zinc-200 transition-colors p-0.5 rounded">
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 text-[13px] text-zinc-200 leading-relaxed font-mono whitespace-pre">{code}</pre>
    </div>
  );
}

function ParamTable({ rows }: { rows: { name: string; type: string; required?: boolean; description: string }[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border text-sm">
      <table className="w-full">
        <thead className="bg-muted/50">
          <tr>
            <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground w-36">Field</th>
            <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground w-24">Type</th>
            <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground w-20">Required</th>
            <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Description</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60">
          {rows.map((r) => (
            <tr key={r.name} className="hover:bg-muted/30 transition-colors">
              <td className="px-4 py-2.5 font-mono text-xs text-primary font-semibold">{r.name}</td>
              <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{r.type}</td>
              <td className="px-4 py-2.5">
                {r.required
                  ? <Badge variant="destructive" className="text-[10px] h-4 px-1.5">required</Badge>
                  : <span className="text-xs text-muted-foreground">optional</span>}
              </td>
              <td className="px-4 py-2.5 text-xs text-muted-foreground">{r.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-6 space-y-5">
      <h2 className="text-lg font-semibold border-b pb-2">{title}</h2>
      {children}
    </section>
  );
}

function Endpoint({
  method, path, title, description, queryParams, bodyParams, responseExample, children,
}: {
  method: string; path: string; title: string; description?: string;
  queryParams?: { name: string; type: string; required?: boolean; description: string }[];
  bodyParams?: { name: string; type: string; required?: boolean; description: string }[];
  responseExample?: string;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border overflow-hidden">
      <button
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <Method method={method} />
        <code className="text-sm font-mono flex-1 text-foreground">{path}</code>
        <span className="text-sm text-muted-foreground hidden sm:block">{title}</span>
        {open ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
      </button>
      {open && (
        <div className="border-t px-4 py-4 space-y-4 bg-muted/10">
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
          {queryParams && queryParams.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Query parameters</h4>
              <ParamTable rows={queryParams} />
            </div>
          )}
          {bodyParams && bodyParams.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Request body</h4>
              <ParamTable rows={bodyParams} />
            </div>
          )}
          {responseExample && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Response</h4>
              <CodeBlock code={responseExample} language="json" />
            </div>
          )}
          {children}
        </div>
      )}
    </div>
  );
}

function Faq({ q, a }: { q: string; a: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border overflow-hidden">
      <button className="w-full flex items-center justify-between gap-3 px-4 py-3.5 hover:bg-muted/40 transition-colors text-left" onClick={() => setOpen((v) => !v)}>
        <span className="text-sm font-medium">{q}</span>
        {open ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
      </button>
      {open && <div className="border-t px-4 py-3.5 text-sm text-muted-foreground space-y-2 bg-muted/10">{a}</div>}
    </div>
  );
}

// ─── nav sections ─────────────────────────────────────────────────────────────

const NAV = [
  { id: 'overview', label: 'Overview' },
  { id: 'authentication', label: 'Authentication' },
  { id: 'pagination', label: 'Pagination' },
  { id: 'leads', label: 'Leads' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'follow-ups', label: 'Follow-ups' },
  { id: 'activities', label: 'Activities' },
  { id: 'documents', label: 'Documents' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'reference', label: 'Reference data' },
  { id: 'workflows', label: 'Workflow examples' },
  { id: 'errors', label: 'Errors & status codes' },
  { id: 'faq', label: 'FAQ' },
];

// ─── main component ────────────────────────────────────────────────────────────

export default function ApiDocs() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState('overview');

  const copyBase = () => {
    navigator.clipboard.writeText(BASE_URL);
    toast({ title: 'Base URL copied' });
  };

  const downloadDocs = () => {
    const content = `# RemoAsset Connect — API Documentation\nVersion 1.0  |  Last updated ${LAST_UPDATED}\n\nBase URL: ${BASE_URL}\n\nAuthentication: Authorization: Bearer <your_api_key>\n\nSee the full interactive docs at: ${window.location.origin}/admin/api-docs\n`;
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'remoasset-connect-api-docs.md';
    anchor.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Documentation downloaded' });
  };

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-6">

        {/* ── header ── */}
        <div className="rounded-2xl border bg-gradient-to-br from-primary/5 via-background to-muted/30 p-6 flex flex-col sm:flex-row sm:items-start gap-4 justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="secondary" className="text-xs gap-1"><Globe className="h-3 w-3" />REST API</Badge>
              <Badge variant="outline" className="text-xs">v1.0</Badge>
              <Badge variant="outline" className="text-xs gap-1"><FileText className="h-3 w-3" />Updated {LAST_UPDATED}</Badge>
            </div>
            <h1 className="text-2xl font-bold">RemoAsset Connect — API Documentation</h1>
            <p className="text-sm text-muted-foreground max-w-xl">
              Integrate Connect with your workflows, automations, and internal tools using the REST API. Manage leads, tasks, follow-ups, activities, documents, and notifications programmatically.
            </p>
            <div className="flex items-center gap-2 pt-1 flex-wrap">
              <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-1.5 font-mono text-xs border max-w-full overflow-hidden">
                <Terminal className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="truncate text-muted-foreground">{BASE_URL}</span>
                <button onClick={copyBase} className="shrink-0 hover:text-foreground transition-colors">
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button variant="outline" size="sm" className="gap-2" onClick={downloadDocs}>
              <Download className="h-4 w-4" />Download
            </Button>
            <Button variant="outline" size="sm" className="gap-2" onClick={() => navigate('/admin')}>
              <ExternalLink className="h-4 w-4" />Admin panel
            </Button>
          </div>
        </div>

        <div className="flex gap-6 items-start">

          {/* ── sidebar nav ── */}
          <aside className="hidden lg:block w-48 shrink-0 sticky top-4 space-y-0.5">
            {NAV.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                onClick={() => setActiveSection(item.id)}
                className={cn(
                  'block rounded-lg px-3 py-1.5 text-sm transition-colors',
                  activeSection === item.id
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                )}
              >
                {item.label}
              </a>
            ))}
          </aside>

          {/* ── content ── */}
          <div className="flex-1 min-w-0 space-y-10">

            {/* Overview */}
            <Section id="overview" title="Overview">
              <p className="text-sm text-muted-foreground">
                The RemoAsset Connect API is a REST API that returns JSON. It lets you automate any action that can be performed inside the app — creating leads, scheduling follow-ups, logging activities, managing tasks, sending in-app notifications, and more.
              </p>
              <div className="grid sm:grid-cols-3 gap-3">
                {[
                  { icon: Lock, title: 'API key auth', desc: 'Every request requires a Bearer token in the Authorization header. Keys are created in Admin → API for Integrations.' },
                  { icon: Zap, title: 'JSON everywhere', desc: 'All request and response bodies are JSON. Set Content-Type: application/json on POST and PATCH requests.' },
                  { icon: BookOpen, title: 'Paginated lists', desc: 'All list endpoints support limit (max 100) and offset for pagination. Responses include a total count.' },
                ].map((c) => (
                  <div key={c.title} className="rounded-xl border p-4 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <c.icon className="h-4 w-4 text-primary" />
                      <span className="text-sm font-semibold">{c.title}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{c.desc}</p>
                  </div>
                ))}
              </div>
            </Section>

            {/* Authentication */}
            <Section id="authentication" title="Authentication">
              <p className="text-sm text-muted-foreground">
                All requests must include your API key as a Bearer token. API keys are created and managed in the <strong>Admin Panel → API for Integrations</strong> tab. Keys are shown only once when created — store them securely.
              </p>
              <CodeBlock language="http" code={`Authorization: Bearer ra_<your_api_key>`} />
              <CodeBlock language="bash" code={`curl -H "Authorization: Bearer ra_<your_api_key>" \\
     -H "Content-Type: application/json" \\
     ${BASE_URL}/leads`} />
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3.5 text-sm text-amber-700 dark:text-amber-400 space-y-1">
                <p className="font-semibold">Security note</p>
                <p className="text-xs">Never expose API keys in client-side code, browser extensions, or public repositories. Use server-side scripts or workflow automation tools that keep secrets private.</p>
              </div>
            </Section>

            {/* Pagination */}
            <Section id="pagination" title="Pagination">
              <p className="text-sm text-muted-foreground">All list endpoints support <code className="bg-muted px-1 rounded text-xs">limit</code> and <code className="bg-muted px-1 rounded text-xs">offset</code> query parameters.</p>
              <ParamTable rows={[
                { name: 'limit', type: 'number', description: 'Max records to return. Default 50, maximum 100.' },
                { name: 'offset', type: 'number', description: 'Number of records to skip. Use with limit for pagination.' },
              ]} />
              <CodeBlock language="bash" code={`# Page 1: records 1–25
curl "${BASE_URL}/leads?limit=25&offset=0" \\
     -H "Authorization: Bearer <key>"

# Page 2: records 26–50
curl "${BASE_URL}/leads?limit=25&offset=25" \\
     -H "Authorization: Bearer <key>"`} />
              <p className="text-sm text-muted-foreground">Responses include a <code className="bg-muted px-1 rounded text-xs">total</code> field with the full count of matching records.</p>
              <CodeBlock language="json" code={`{ "data": [ ...records ], "total": 120 }`} />
            </Section>

            {/* Leads */}
            <Section id="leads" title="Leads">
              <p className="text-sm text-muted-foreground">Leads are the core entity in Connect. Each lead represents a company or contact moving through your pipeline.</p>
              <div className="space-y-2">
                <Endpoint method="GET" path="/leads" title="List leads"
                  description="Returns a paginated list of leads. Results are ordered by updated_at descending."
                  queryParams={[
                    { name: 'limit', type: 'number', description: 'Max results (default 50, max 100)' },
                    { name: 'offset', type: 'number', description: 'Pagination offset' },
                    { name: 'status_id', type: 'uuid', description: 'Filter by pipeline stage' },
                    { name: 'owner_id', type: 'uuid', description: 'Filter by assigned team member' },
                    { name: 'search / q', type: 'string', description: 'Full-text search on company name, contact name, and email' },
                  ]}
                  responseExample={`{ "data": [ { "id": "uuid", "company_name": "Acme Corp", ... } ], "total": 42 }`}
                />
                <Endpoint method="GET" path="/leads/:id" title="Get a lead"
                  description="Returns the full lead object for the given UUID."
                  responseExample={`{ "id": "uuid", "company_name": "Acme Corp", "contact_name": "John Smith", "email": "john@acme.com", "status_id": "uuid", "owner_id": "uuid", ... }`}
                />
                <Endpoint method="POST" path="/leads" title="Create a lead"
                  description="Creates a new lead. Returns 201 with the created lead object."
                  bodyParams={[
                    { name: 'company_name', type: 'string', required: true, description: 'Company name' },
                    { name: 'contact_name', type: 'string', description: 'Primary contact person' },
                    { name: 'email', type: 'string', description: 'Contact email' },
                    { name: 'phone', type: 'string', description: 'Contact phone number' },
                    { name: 'status_id', type: 'uuid', description: 'Pipeline stage — get IDs from GET /statuses' },
                    { name: 'owner_id', type: 'uuid', description: 'Assigned team member — get IDs from GET /team' },
                    { name: 'country_id', type: 'uuid', description: 'Country — get IDs from GET /countries' },
                    { name: 'deal_value', type: 'number', description: 'Estimated deal value' },
                    { name: 'notes', type: 'string', description: 'Free-form notes' },
                  ]}
                  responseExample={`{ "id": "uuid", "company_name": "Acme Corp", "created_at": "2026-03-05T10:00:00Z", ... }`}
                />
                <Endpoint method="PATCH" path="/leads/:id" title="Update a lead"
                  description="Updates one or more fields on an existing lead. Send only the fields you want to change. Returns the updated lead."
                  bodyParams={[
                    { name: 'company_name', type: 'string', description: 'New company name' },
                    { name: 'contact_name', type: 'string', description: 'New contact name' },
                    { name: 'email', type: 'string', description: 'New email' },
                    { name: 'status_id', type: 'uuid', description: 'Move to a new pipeline stage' },
                    { name: 'owner_id', type: 'uuid', description: 'Reassign to a different team member' },
                    { name: 'deal_value', type: 'number', description: 'Update estimated value' },
                  ]}
                />
                <Endpoint method="DELETE" path="/leads/:id" title="Delete a lead"
                  description="Permanently deletes a lead and all related records."
                  responseExample={`{ "success": true }`}
                />
                <Endpoint method="PATCH" path="/leads/bulk" title="Bulk update leads"
                  description="Update multiple leads at once. At least one of status_id, owner_id, or country_id is required alongside lead_ids."
                  bodyParams={[
                    { name: 'lead_ids', type: 'uuid[]', required: true, description: 'Array of lead IDs to update' },
                    { name: 'status_id', type: 'uuid', description: 'Set pipeline stage for all listed leads' },
                    { name: 'owner_id', type: 'uuid', description: 'Reassign all listed leads' },
                    { name: 'country_id', type: 'uuid', description: 'Set country for all listed leads' },
                  ]}
                  responseExample={`{ "updated": 5, "leads": [ { ...lead } ] }`}
                />
              </div>
            </Section>

            {/* Tasks */}
            <Section id="tasks" title="Tasks">
              <p className="text-sm text-muted-foreground">Tasks are to-do items that can be linked to a lead and assigned to a team member.</p>
              <div className="space-y-2">
                <Endpoint method="GET" path="/tasks" title="List tasks"
                  description="Returns tasks ordered by due_date ascending."
                  queryParams={[
                    { name: 'assignee_id', type: 'uuid', description: 'Filter by assigned team member' },
                    { name: 'lead_id', type: 'uuid', description: 'Filter by associated lead' },
                    { name: 'is_completed', type: 'boolean', description: 'true or false to filter by completion status' },
                    { name: 'limit', type: 'number', description: 'Default 50, max 100' },
                    { name: 'offset', type: 'number', description: 'Pagination offset' },
                  ]}
                />
                <Endpoint method="GET" path="/tasks/:id" title="Get a task" description="Returns the full task object." />
                <Endpoint method="POST" path="/tasks" title="Create a task"
                  bodyParams={[
                    { name: 'title', type: 'string', required: true, description: 'Task title' },
                    { name: 'description', type: 'string', description: 'Detailed description' },
                    { name: 'lead_id', type: 'uuid', description: 'Link to a lead' },
                    { name: 'assignee_id', type: 'uuid', description: 'Assign to a team member' },
                    { name: 'due_date', type: 'date', description: 'Due date in ISO 8601 format: YYYY-MM-DD' },
                    { name: 'priority', type: 'string', description: 'low, medium, or high' },
                    { name: 'is_completed', type: 'boolean', description: 'Default false' },
                  ]}
                />
                <Endpoint method="PATCH" path="/tasks/:id" title="Update a task"
                  description="Use is_completed: true to mark a task done."
                  bodyParams={[
                    { name: 'title', type: 'string', description: 'Updated title' },
                    { name: 'is_completed', type: 'boolean', description: 'Mark task complete or incomplete' },
                    { name: 'due_date', type: 'date', description: 'Updated due date' },
                    { name: 'priority', type: 'string', description: 'low, medium, or high' },
                    { name: 'assignee_id', type: 'uuid', description: 'Reassign task' },
                  ]}
                />
                <Endpoint method="DELETE" path="/tasks/:id" title="Delete a task" responseExample={`{ "success": true }`} />
              </div>
            </Section>

            {/* Follow-ups */}
            <Section id="follow-ups" title="Follow-ups">
              <p className="text-sm text-muted-foreground">Follow-ups are scheduled actions associated with a lead. Results are ordered by <code className="bg-muted px-1 rounded text-xs">scheduled_at</code> ascending.</p>
              <div className="space-y-2">
                <Endpoint method="GET" path="/follow_ups" title="List follow-ups"
                  queryParams={[
                    { name: 'lead_id', type: 'uuid', description: 'Filter by lead' },
                    { name: 'user_id', type: 'uuid', description: 'Filter by responsible team member' },
                    { name: 'limit', type: 'number', description: 'Default 50, max 100' },
                    { name: 'offset', type: 'number', description: 'Pagination offset' },
                  ]}
                />
                <Endpoint method="GET" path="/follow_ups/:id" title="Get a follow-up" />
                <Endpoint method="POST" path="/follow_ups" title="Schedule a follow-up"
                  bodyParams={[
                    { name: 'lead_id', type: 'uuid', required: true, description: 'The lead this follow-up belongs to' },
                    { name: 'user_id', type: 'uuid', required: true, description: 'Responsible team member' },
                    { name: 'scheduled_at', type: 'datetime', required: true, description: 'ISO 8601 UTC timestamp — e.g. 2026-03-10T09:00:00Z' },
                    { name: 'notes', type: 'string', description: 'What to discuss or action' },
                    { name: 'is_completed', type: 'boolean', description: 'Default false' },
                  ]}
                />
                <Endpoint method="PATCH" path="/follow_ups/:id" title="Update a follow-up"
                  description="Use is_completed: true to mark a follow-up done."
                  bodyParams={[
                    { name: 'scheduled_at', type: 'datetime', description: 'Reschedule' },
                    { name: 'notes', type: 'string', description: 'Update notes' },
                    { name: 'is_completed', type: 'boolean', description: 'Mark complete' },
                  ]}
                />
                <Endpoint method="DELETE" path="/follow_ups/:id" title="Delete a follow-up" />
              </div>
            </Section>

            {/* Activities */}
            <Section id="activities" title="Activities">
              <p className="text-sm text-muted-foreground">Activities are timeline entries on a lead — calls, emails, meetings, notes, and more. Results are ordered by <code className="bg-muted px-1 rounded text-xs">created_at</code> descending.</p>
              <div className="space-y-2">
                <Endpoint method="GET" path="/activities" title="List activities"
                  queryParams={[
                    { name: 'lead_id', type: 'uuid', description: 'Filter by lead' },
                    { name: 'limit', type: 'number', description: 'Default 50, max 100' },
                    { name: 'offset', type: 'number', description: 'Pagination offset' },
                  ]}
                />
                <Endpoint method="GET" path="/activities/:id" title="Get an activity" />
                <Endpoint method="POST" path="/activities" title="Log an activity"
                  bodyParams={[
                    { name: 'lead_id', type: 'uuid', required: true, description: 'The lead this activity is logged against' },
                    { name: 'user_id', type: 'uuid', required: true, description: 'Team member who performed the activity' },
                    { name: 'type', type: 'string', required: true, description: 'call, email, meeting, note, whatsapp, or other' },
                    { name: 'description', type: 'string', description: 'What happened or was discussed' },
                    { name: 'occurred_at', type: 'datetime', description: 'ISO 8601 UTC timestamp. Defaults to now.' },
                  ]}
                />
                <Endpoint method="PATCH" path="/activities/:id" title="Update an activity"
                  bodyParams={[
                    { name: 'type', type: 'string', description: 'Updated activity type' },
                    { name: 'description', type: 'string', description: 'Updated description' },
                    { name: 'occurred_at', type: 'datetime', description: 'Updated timestamp' },
                  ]}
                />
                <Endpoint method="DELETE" path="/activities/:id" title="Delete an activity" />
              </div>
            </Section>

            {/* Documents */}
            <Section id="documents" title="Documents">
              <p className="text-sm text-muted-foreground">Documents record files associated with a lead — NDAs, pricing sheets, quotations, and custom files.</p>
              <div className="space-y-2">
                <Endpoint method="GET" path="/documents" title="List documents for a lead"
                  description="lead_id is required. Results ordered by uploaded_at descending."
                  queryParams={[
                    { name: 'lead_id', type: 'uuid', required: true, description: 'The lead to list documents for' },
                    { name: 'limit', type: 'number', description: 'Default 50, max 100' },
                    { name: 'offset', type: 'number', description: 'Pagination offset' },
                  ]}
                />
                <Endpoint method="GET" path="/documents/:id" title="Get a document" />
                <Endpoint method="POST" path="/documents" title="Record a document"
                  bodyParams={[
                    { name: 'lead_id', type: 'uuid', required: true, description: 'Lead this document belongs to' },
                    { name: 'document_type', type: 'string', required: true, description: 'nda, pricing, quotation, or custom' },
                    { name: 'file_path', type: 'string', required: true, description: 'Storage path or URL of the file' },
                    { name: 'file_name', type: 'string', required: true, description: 'Display file name e.g. proposal.pdf' },
                    { name: 'uploaded_by', type: 'uuid', required: true, description: 'User ID of the person who uploaded it' },
                    { name: 'file_size', type: 'number', description: 'File size in bytes' },
                    { name: 'custom_name', type: 'string', description: 'Custom label — used when document_type is "custom"' },
                  ]}
                />
                <Endpoint method="DELETE" path="/documents/:id" title="Delete a document" />
              </div>
            </Section>

            {/* Notifications */}
            <Section id="notifications" title="Notifications">
              <p className="text-sm text-muted-foreground">Push in-app notifications to specific team members from your workflows.</p>
              <div className="space-y-2">
                <Endpoint method="GET" path="/notifications" title="List notifications"
                  description="user_id is required. Returns notifications ordered by created_at descending."
                  queryParams={[
                    { name: 'user_id', type: 'uuid', required: true, description: 'Team member to list notifications for' },
                    { name: 'limit', type: 'number', description: 'Default 50, max 100' },
                    { name: 'offset', type: 'number', description: 'Pagination offset' },
                  ]}
                />
                <Endpoint method="POST" path="/notifications" title="Send a notification"
                  description="Creates an in-app notification for a team member. They will see it in the notification bell immediately."
                  bodyParams={[
                    { name: 'user_id', type: 'uuid', required: true, description: 'Recipient team member' },
                    { name: 'title', type: 'string', required: true, description: 'Short title shown in the notification bell' },
                    { name: 'message', type: 'string', required: true, description: 'Full notification message' },
                    { name: 'type', type: 'string', description: 'info (default), warning, success, task, lead, or email' },
                    { name: 'metadata', type: 'object', description: 'Any additional JSON data to attach' },
                  ]}
                />
              </div>
            </Section>

            {/* Reference data */}
            <Section id="reference" title="Reference data">
              <p className="text-sm text-muted-foreground">Use these endpoints to get IDs for status, country, and team fields when creating or updating records.</p>
              <div className="space-y-2">
                <Endpoint method="GET" path="/team" title="List team members"
                  description="Returns all team members with user_id, role, and full_name. Use user_id values for owner_id, assignee_id, and user_id fields."
                  responseExample={`[ { "user_id": "uuid", "role": "admin", "full_name": "Ranjith Kumar" }, ... ]`}
                />
                <Endpoint method="GET" path="/statuses" title="List pipeline statuses"
                  description="Returns all pipeline stages ordered by sort_order. Use id values as status_id when creating or moving leads."
                  responseExample={`[ { "id": "uuid", "name": "Prospect", "color": "#6366f1", "sort_order": 1 }, ... ]`}
                />
                <Endpoint method="GET" path="/countries" title="List countries"
                  description="Returns all countries ordered by name. Use id values as country_id."
                />
                <Endpoint method="GET" path="/profiles" title="List profiles"
                  description="Returns team member profiles — user_id, full_name, designation, phone."
                />
              </div>
            </Section>

            {/* Workflow examples */}
            <Section id="workflows" title="Workflow examples">
              <div className="space-y-6">
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold">1. Create a lead and schedule a follow-up</h3>
                  <CodeBlock language="bash" code={`# Step 1 — get available statuses
curl -H "Authorization: Bearer <key>" ${BASE_URL}/statuses

# Step 2 — get team member IDs
curl -H "Authorization: Bearer <key>" ${BASE_URL}/team

# Step 3 — create the lead
curl -X POST ${BASE_URL}/leads \\
  -H "Authorization: Bearer <key>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "company_name": "Acme Corp",
    "contact_name": "John Smith",
    "email": "john@acme.com",
    "status_id": "<status_uuid>",
    "owner_id": "<user_uuid>"
  }'

# Step 4 — schedule a follow-up (use the lead id from step 3)
curl -X POST ${BASE_URL}/follow_ups \\
  -H "Authorization: Bearer <key>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "lead_id": "<lead_uuid>",
    "user_id": "<user_uuid>",
    "scheduled_at": "2026-03-10T09:00:00Z",
    "notes": "Demo call — discuss pricing and timeline"
  }'`} />
                </div>
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold">2. Move a lead to a new pipeline stage</h3>
                  <CodeBlock language="bash" code={`curl -X PATCH ${BASE_URL}/leads/<lead_uuid> \\
  -H "Authorization: Bearer <key>" \\
  -H "Content-Type: application/json" \\
  -d '{ "status_id": "<new_status_uuid>" }'`} />
                </div>
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold">3. Bulk reassign leads to a new team member</h3>
                  <CodeBlock language="bash" code={`curl -X PATCH ${BASE_URL}/leads/bulk \\
  -H "Authorization: Bearer <key>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "lead_ids": ["<uuid1>", "<uuid2>", "<uuid3>"],
    "owner_id": "<new_owner_uuid>"
  }'`} />
                </div>
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold">4. Log a call and create a follow-up task</h3>
                  <CodeBlock language="bash" code={`# Log the call
curl -X POST ${BASE_URL}/activities \\
  -H "Authorization: Bearer <key>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "lead_id": "<lead_uuid>",
    "user_id": "<user_uuid>",
    "type": "call",
    "description": "Discussed requirements and shared pricing deck",
    "occurred_at": "2026-03-05T11:30:00Z"
  }'

# Create a task to send a proposal
curl -X POST ${BASE_URL}/tasks \\
  -H "Authorization: Bearer <key>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "title": "Send proposal to Acme Corp",
    "lead_id": "<lead_uuid>",
    "assignee_id": "<user_uuid>",
    "due_date": "2026-03-07",
    "priority": "high"
  }'`} />
                </div>
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold">5. Send an in-app notification to a team member</h3>
                  <CodeBlock language="bash" code={`curl -X POST ${BASE_URL}/notifications \\
  -H "Authorization: Bearer <key>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "user_id": "<user_uuid>",
    "title": "New RFQ received",
    "message": "Acme Corp submitted a new request for quotation. Review and respond by EOD.",
    "type": "lead"
  }'`} />
                </div>
              </div>
            </Section>

            {/* Errors */}
            <Section id="errors" title="Errors & status codes">
              <p className="text-sm text-muted-foreground mb-4">All error responses use a consistent JSON format:</p>
              <CodeBlock language="json" code={`{ "error": "Description of what went wrong" }`} />
              <div className="mt-4 rounded-lg border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground w-20">Code</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground w-32">Status</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Meaning</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {[
                      { code: '200', status: 'OK', meaning: 'Request succeeded' },
                      { code: '201', status: 'Created', meaning: 'Record was created successfully. Response contains the new object.' },
                      { code: '400', status: 'Bad Request', meaning: 'Invalid request — missing required fields or bad parameter values. Check the error message.' },
                      { code: '401', status: 'Unauthorized', meaning: 'Missing or invalid API key. Check the Authorization header.' },
                      { code: '403', status: 'Forbidden', meaning: 'Valid key but insufficient permissions (e.g. non-admin key on an admin-only action).' },
                      { code: '404', status: 'Not Found', meaning: 'The requested resource or ID does not exist.' },
                      { code: '405', status: 'Method Not Allowed', meaning: 'HTTP method is not supported on this endpoint.' },
                      { code: '500', status: 'Server Error', meaning: 'An unexpected error occurred. Retry after a short wait; contact support if it persists.' },
                    ].map((r) => (
                      <tr key={r.code} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-2.5 font-mono text-xs font-bold text-foreground">{r.code}</td>
                        <td className="px-4 py-2.5 text-xs font-medium text-muted-foreground">{r.status}</td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground">{r.meaning}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>

            {/* FAQ */}
            <Section id="faq" title="FAQ">
              <div className="space-y-2">
                <Faq
                  q="Where do I create an API key?"
                  a={<p>Go to <strong>Admin Panel → API for Integrations</strong>. Click "Create API key", enter a name, and copy the key shown — it is displayed only once. Store it in a secure secrets manager or environment variable.</p>}
                />
                <Faq
                  q="How do I find the right status_id, owner_id, or country_id?"
                  a={<p>Call the reference endpoints: <code className="bg-muted px-1 rounded text-xs">GET /statuses</code> for pipeline stages, <code className="bg-muted px-1 rounded text-xs">GET /team</code> for team member user IDs, and <code className="bg-muted px-1 rounded text-xs">GET /countries</code> for country IDs. These return the <code className="bg-muted px-1 rounded text-xs">id</code> fields you need.</p>}
                />
                <Faq
                  q="Can I create a lead without a status or owner?"
                  a={<p>Yes — only <code className="bg-muted px-1 rounded text-xs">company_name</code> is required when creating a lead. All other fields including <code className="bg-muted px-1 rounded text-xs">status_id</code>, <code className="bg-muted px-1 rounded text-xs">owner_id</code>, and <code className="bg-muted px-1 rounded text-xs">country_id</code> are optional.</p>}
                />
                <Faq
                  q="How do I paginate through all leads?"
                  a={<>
                    <p>Use <code className="bg-muted px-1 rounded text-xs">limit</code> and <code className="bg-muted px-1 rounded text-xs">offset</code>. The response includes a <code className="bg-muted px-1 rounded text-xs">total</code> count so you know when to stop.</p>
                    <CodeBlock language="bash" code={`# First page
curl "${BASE_URL}/leads?limit=50&offset=0" -H "Authorization: Bearer <key>"
# Second page
curl "${BASE_URL}/leads?limit=50&offset=50" -H "Authorization: Bearer <key>"`} />
                  </>}
                />
                <Faq
                  q="What datetime format should I use?"
                  a={<p>Use ISO 8601 UTC format: <code className="bg-muted px-1 rounded text-xs">YYYY-MM-DDTHH:MM:SSZ</code> — for example <code className="bg-muted px-1 rounded text-xs">2026-03-10T09:00:00Z</code>. For date-only fields like <code className="bg-muted px-1 rounded text-xs">due_date</code> on tasks, use <code className="bg-muted px-1 rounded text-xs">YYYY-MM-DD</code>.</p>}
                />
                <Faq
                  q="Can I update multiple leads at once?"
                  a={<p>Yes — use <code className="bg-muted px-1 rounded text-xs">PATCH /leads/bulk</code> with a <code className="bg-muted px-1 rounded text-xs">lead_ids</code> array. You can set <code className="bg-muted px-1 rounded text-xs">status_id</code>, <code className="bg-muted px-1 rounded text-xs">owner_id</code>, or <code className="bg-muted px-1 rounded text-xs">country_id</code> — or all three at once. Other fields are not supported in bulk updates.</p>}
                />
                <Faq
                  q="What notification types are supported?"
                  a={<p>When creating notifications via <code className="bg-muted px-1 rounded text-xs">POST /notifications</code>, the <code className="bg-muted px-1 rounded text-xs">type</code> field accepts: <code className="bg-muted px-1 rounded text-xs">info</code>, <code className="bg-muted px-1 rounded text-xs">warning</code>, <code className="bg-muted px-1 rounded text-xs">success</code>, <code className="bg-muted px-1 rounded text-xs">task</code>, <code className="bg-muted px-1 rounded text-xs">lead</code>, or <code className="bg-muted px-1 rounded text-xs">email</code>. Defaults to <code className="bg-muted px-1 rounded text-xs">info</code> if not provided.</p>}
                />
                <Faq
                  q="Is there a rate limit?"
                  a={<p>There is no hard rate limit enforced currently. Use the API responsibly. If you're running high-volume automations, batch your requests and add short delays between calls to avoid overwhelming the system.</p>}
                />
                <Faq
                  q="What happens if I send an unknown field in the request body?"
                  a={<p>Unknown fields are silently ignored. Only recognised fields listed in the request body tables are persisted.</p>}
                />
                <Faq
                  q="How do I revoke an API key?"
                  a={<p>Go to <strong>Admin Panel → API for Integrations</strong> and click the delete (trash) icon next to the key you want to revoke. The key is immediately invalidated — any requests using it will get a 401 response.</p>}
                />
              </div>
            </Section>

            {/* footer */}
            <div className="rounded-xl border bg-muted/30 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="text-xs text-muted-foreground space-y-0.5">
                <p className="font-medium text-foreground">RemoAsset Connect API</p>
                <p>For authorised integrations only. Last updated {LAST_UPDATED}.</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="gap-2 text-xs h-8" onClick={() => navigate('/admin')}>
                  <ExternalLink className="h-3.5 w-3.5" />Manage API keys
                </Button>
                <Button variant="outline" size="sm" className="gap-2 text-xs h-8" onClick={() => { navigator.clipboard.writeText(BASE_URL); toast({ title: 'Base URL copied' }); }}>
                  <Copy className="h-3.5 w-3.5" />Copy base URL
                </Button>
              </div>
            </div>

          </div>
        </div>
      </div>
    </AppLayout>
  );
}
