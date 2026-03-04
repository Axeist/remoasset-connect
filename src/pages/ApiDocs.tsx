import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from '@/components/ui/accordion';
import { cn } from '@/lib/utils';
import {
  Copy, Check, Download, ExternalLink, Terminal, Lock, Zap, BookOpen,
  Globe, FileText, ChevronRight, AlertTriangle, Key, Database,
  ListTodo, CalendarCheck, Activity, Bell, Users, Layers, HelpCircle,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const BASE_URL = `${import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, '')}/functions/v1/api`;
const LAST_UPDATED = 'March 5, 2026';

// ─── helpers ──────────────────────────────────────────────────────────────────

function MethodBadge({ method }: { method: string }) {
  const styles: Record<string, string> = {
    GET: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
    POST: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    PATCH: 'bg-warning/10 text-warning border-warning/20',
    DELETE: 'bg-destructive/10 text-destructive border-destructive/20',
  };
  return (
    <span className={cn('inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-bold font-mono tracking-wider shrink-0', styles[method] ?? 'bg-muted text-muted-foreground border-border')}>
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
    <div className="relative rounded-xl border border-border/60 bg-[#30282B] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-1.5 border-b border-white/10">
        <span className="text-[11px] font-mono text-white/40 uppercase tracking-wider">{language}</span>
        <button onClick={copy} className="text-white/40 hover:text-white/80 transition-colors p-0.5 rounded">
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
        <thead>
          <tr className="border-b border-border/60 bg-muted/40">
            <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground w-36">Field</th>
            <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground w-24">Type</th>
            <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground w-20">Required</th>
            <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground">Description</th>
          </tr>
        </thead>
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

function EndpointRow({
  method, path, title, description, queryParams, bodyParams, responseExample, children,
}: {
  method: string; path: string; title: string; description?: string;
  queryParams?: { name: string; type: string; required?: boolean; description: string }[];
  bodyParams?: { name: string; type: string; required?: boolean; description: string }[];
  responseExample?: string;
  children?: React.ReactNode;
}) {
  return (
    <AccordionItem value={`${method}-${path}`} className="border border-border/60 rounded-xl overflow-hidden bg-card/50 data-[state=open]:bg-card">
      <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/30 transition-colors [&>svg]:hidden">
        <div className="flex items-center gap-3 w-full">
          <MethodBadge method={method} />
          <code className="text-sm font-mono flex-1 text-left text-foreground">{path}</code>
          <span className="text-xs text-muted-foreground hidden sm:block pr-2">{title}</span>
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-90" />
        </div>
      </AccordionTrigger>
      <AccordionContent className="border-t border-border/60 px-4 py-4 space-y-4 bg-muted/10">
        {description && <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>}
        {queryParams && queryParams.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Query parameters</p>
            <ParamTable rows={queryParams} />
          </div>
        )}
        {bodyParams && bodyParams.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Request body</p>
            <ParamTable rows={bodyParams} />
          </div>
        )}
        {responseExample && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Example response</p>
            <CodeBlock code={responseExample} language="json" />
          </div>
        )}
        {children}
      </AccordionContent>
    </AccordionItem>
  );
}

// ─── nav ─────────────────────────────────────────────────────────────────────

const NAV_SECTIONS = [
  { id: 'overview', label: 'Overview', icon: BookOpen },
  { id: 'authentication', label: 'Authentication', icon: Lock },
  { id: 'pagination', label: 'Pagination', icon: Layers },
  { id: 'leads', label: 'Leads', icon: Users },
  { id: 'tasks', label: 'Tasks', icon: ListTodo },
  { id: 'follow-ups', label: 'Follow-ups', icon: CalendarCheck },
  { id: 'activities', label: 'Activities', icon: Activity },
  { id: 'documents', label: 'Documents', icon: FileText },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'reference', label: 'Reference data', icon: Database },
  { id: 'workflows', label: 'Workflow examples', icon: Zap },
  { id: 'errors', label: 'Status codes', icon: AlertTriangle },
  { id: 'faq', label: 'FAQ', icon: HelpCircle },
];

// ─── page ─────────────────────────────────────────────────────────────────────

export default function ApiDocs() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState('overview');

  const copyBase = () => {
    navigator.clipboard.writeText(BASE_URL);
    toast({ title: 'Base URL copied' });
  };

  const downloadDocs = () => {
    const content = `# RemoAsset Connect — API Documentation\nVersion 1.0  |  Last updated ${LAST_UPDATED}\n\nBase URL: ${BASE_URL}\n\nAuthentication: Authorization: Bearer <your_api_key>\n\nFull interactive docs: ${window.location.origin}/admin/api-docs\n`;
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'remoasset-connect-api-docs.md';
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Documentation downloaded' });
  };

  const scrollTo = (id: string) => {
    setActiveSection(id);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-6 animate-fade-in-up">

        {/* ── page header ── */}
        <div className="flex items-start gap-4 mb-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 shrink-0">
            <Globe className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h1 className="text-2xl font-display font-bold text-foreground tracking-tight">API Documentation</h1>
              <Badge variant="secondary" className="text-xs">v1.0</Badge>
            </div>
            <p className="text-muted-foreground text-sm">
              Integrate Connect with your workflows and tools. Manage leads, tasks, follow-ups, activities, documents, and notifications over REST.
            </p>
          </div>
          <div className="hidden sm:flex gap-2 shrink-0">
            <Button variant="outline" size="sm" className="gap-2" onClick={downloadDocs}>
              <Download className="h-4 w-4" />Download
            </Button>
            <Button variant="outline" size="sm" className="gap-2" onClick={() => navigate('/admin')}>
              <ExternalLink className="h-4 w-4" />Admin
            </Button>
          </div>
        </div>

        {/* ── base URL banner ── */}
        <Card className="card-shadow border-border/60 p-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Base URL</p>
              <div className="flex items-center gap-2">
                <Terminal className="h-4 w-4 text-primary shrink-0" />
                <code className="text-sm font-mono text-foreground break-all">{BASE_URL}</code>
                <button onClick={copyBase} className="shrink-0 text-muted-foreground hover:text-primary transition-colors">
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0 flex-wrap">
              <div className="flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 text-primary" />
                <span>API key auth</span>
              </div>
              <div className="flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-primary" />
                <span>Updated {LAST_UPDATED}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Key className="h-3.5 w-3.5 text-primary" />
                <span>JSON REST</span>
              </div>
            </div>
          </div>
        </Card>

        <div className="flex gap-6 items-start">

          {/* ── sticky sidebar nav ── */}
          <aside className="hidden lg:block w-52 shrink-0 sticky top-4">
            <Card className="card-shadow border-border/60 p-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-2 py-1.5">Contents</p>
              <nav className="space-y-0.5">
                {NAV_SECTIONS.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => scrollTo(item.id)}
                    className={cn(
                      'w-full flex items-center gap-2.5 rounded-[8px] px-2.5 py-1.5 text-sm transition-all duration-150 text-left',
                      activeSection === item.id
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                    )}
                  >
                    <item.icon className="h-3.5 w-3.5 shrink-0" />
                    <span className="text-xs">{item.label}</span>
                  </button>
                ))}
              </nav>
            </Card>
          </aside>

          {/* ── main content ── */}
          <div className="flex-1 min-w-0 space-y-10">

            {/* Overview */}
            <section id="overview" className="scroll-mt-4 space-y-4">
              <h2 className="text-base font-semibold text-foreground flex items-center gap-2 border-b border-border/60 pb-2">
                <BookOpen className="h-4 w-4 text-primary" />Overview
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                The RemoAsset Connect API is a REST API that returns JSON. It lets you automate any action available in the app — creating leads, scheduling follow-ups, logging activities, managing tasks, and sending in-app notifications.
              </p>
              <div className="grid sm:grid-cols-3 gap-3">
                {[
                  { icon: Lock, title: 'API key auth', desc: 'Every request requires an API key as a Bearer token. Create and manage keys in Admin → API for Integrations.' },
                  { icon: Zap, title: 'JSON everywhere', desc: 'All request and response bodies are JSON. Set Content-Type: application/json on POST and PATCH requests.' },
                  { icon: BookOpen, title: 'Paginated lists', desc: 'All list endpoints support limit (max 100) and offset. Responses include a total count field.' },
                ].map((c) => (
                  <div key={c.title} className="rounded-xl border border-border/60 bg-card/50 p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
                        <c.icon className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <span className="text-sm font-semibold">{c.title}</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{c.desc}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Authentication */}
            <section id="authentication" className="scroll-mt-4 space-y-4">
              <h2 className="text-base font-semibold text-foreground flex items-center gap-2 border-b border-border/60 pb-2">
                <Lock className="h-4 w-4 text-primary" />Authentication
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                All requests must include your API key as a Bearer token. Create keys in <strong className="text-foreground">Admin Panel → API for Integrations</strong>. Keys are shown only once — store them securely.
              </p>
              <CodeBlock language="http" code={`Authorization: Bearer ra_<your_api_key>`} />
              <CodeBlock language="bash" code={`curl -H "Authorization: Bearer ra_<your_api_key>" \\
     -H "Content-Type: application/json" \\
     ${BASE_URL}/leads`} />
              <div className="flex items-start gap-3 rounded-xl border border-warning/30 bg-warning/5 p-3.5">
                <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="text-sm font-medium text-foreground">Security note</p>
                  <p className="text-xs text-muted-foreground">Never expose API keys in client-side code or public repositories. Use server-side scripts or workflow tools that keep secrets private.</p>
                </div>
              </div>
            </section>

            {/* Pagination */}
            <section id="pagination" className="scroll-mt-4 space-y-4">
              <h2 className="text-base font-semibold text-foreground flex items-center gap-2 border-b border-border/60 pb-2">
                <Layers className="h-4 w-4 text-primary" />Pagination
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                All list endpoints support <code className="bg-muted px-1.5 py-0.5 rounded-md text-xs font-mono">limit</code> (max 100, default 50) and <code className="bg-muted px-1.5 py-0.5 rounded-md text-xs font-mono">offset</code> query parameters. Responses include a <code className="bg-muted px-1.5 py-0.5 rounded-md text-xs font-mono">total</code> field with the full record count.
              </p>
              <ParamTable rows={[
                { name: 'limit', type: 'number', description: 'Max records to return. Default 50, maximum 100.' },
                { name: 'offset', type: 'number', description: 'Number of records to skip. Combine with limit for page-by-page access.' },
              ]} />
              <CodeBlock language="bash" code={`# Page 1
curl "${BASE_URL}/leads?limit=25&offset=0" -H "Authorization: Bearer <key>"

# Page 2
curl "${BASE_URL}/leads?limit=25&offset=25" -H "Authorization: Bearer <key>"`} />
            </section>

            {/* Leads */}
            <section id="leads" className="scroll-mt-4 space-y-4">
              <h2 className="text-base font-semibold text-foreground flex items-center gap-2 border-b border-border/60 pb-2">
                <Users className="h-4 w-4 text-primary" />Leads
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">Leads are the core entity in Connect. Each lead represents a company or contact moving through your pipeline.</p>
              <Accordion type="multiple" className="space-y-2">
                <EndpointRow method="GET" path="/leads" title="List leads"
                  description="Returns a paginated list of leads, ordered by updated_at descending."
                  queryParams={[
                    { name: 'limit', type: 'number', description: 'Max results (default 50, max 100)' },
                    { name: 'offset', type: 'number', description: 'Pagination offset' },
                    { name: 'status_id', type: 'uuid', description: 'Filter by pipeline stage' },
                    { name: 'owner_id', type: 'uuid', description: 'Filter by assigned team member' },
                    { name: 'search / q', type: 'string', description: 'Full-text search on company name, contact name, and email' },
                  ]}
                  responseExample={`{ "data": [ { "id": "uuid", "company_name": "Acme Corp", ... } ], "total": 42 }`}
                />
                <EndpointRow method="GET" path="/leads/:id" title="Get a lead"
                  description="Returns the full lead object for the given UUID."
                  responseExample={`{ "id": "uuid", "company_name": "Acme Corp", "contact_name": "John Smith", "email": "john@acme.com", "status_id": "uuid", "owner_id": "uuid", ... }`}
                />
                <EndpointRow method="POST" path="/leads" title="Create a lead"
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
                />
                <EndpointRow method="PATCH" path="/leads/:id" title="Update a lead"
                  description="Updates one or more fields. Send only the fields you want to change. Returns the updated lead."
                  bodyParams={[
                    { name: 'company_name', type: 'string', description: 'New company name' },
                    { name: 'contact_name', type: 'string', description: 'New contact name' },
                    { name: 'email', type: 'string', description: 'New email' },
                    { name: 'status_id', type: 'uuid', description: 'Move to a new pipeline stage' },
                    { name: 'owner_id', type: 'uuid', description: 'Reassign to a different team member' },
                    { name: 'deal_value', type: 'number', description: 'Update estimated value' },
                  ]}
                />
                <EndpointRow method="DELETE" path="/leads/:id" title="Delete a lead"
                  description="Permanently deletes a lead and all related records."
                  responseExample={`{ "success": true }`}
                />
                <EndpointRow method="PATCH" path="/leads/bulk" title="Bulk update leads"
                  description="Update multiple leads at once. At least one of status_id, owner_id, or country_id is required alongside lead_ids."
                  bodyParams={[
                    { name: 'lead_ids', type: 'uuid[]', required: true, description: 'Array of lead IDs to update' },
                    { name: 'status_id', type: 'uuid', description: 'Set pipeline stage for all listed leads' },
                    { name: 'owner_id', type: 'uuid', description: 'Reassign all listed leads to this team member' },
                    { name: 'country_id', type: 'uuid', description: 'Set country for all listed leads' },
                  ]}
                  responseExample={`{ "updated": 5, "leads": [ { ...lead } ] }`}
                />
              </Accordion>
            </section>

            {/* Tasks */}
            <section id="tasks" className="scroll-mt-4 space-y-4">
              <h2 className="text-base font-semibold text-foreground flex items-center gap-2 border-b border-border/60 pb-2">
                <ListTodo className="h-4 w-4 text-primary" />Tasks
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">Tasks are to-do items that can be linked to a lead and assigned to a team member.</p>
              <Accordion type="multiple" className="space-y-2">
                <EndpointRow method="GET" path="/tasks" title="List tasks"
                  description="Returns tasks ordered by due_date ascending."
                  queryParams={[
                    { name: 'assignee_id', type: 'uuid', description: 'Filter by assigned team member' },
                    { name: 'lead_id', type: 'uuid', description: 'Filter by associated lead' },
                    { name: 'is_completed', type: 'boolean', description: 'true or false to filter by completion status' },
                    { name: 'limit', type: 'number', description: 'Default 50, max 100' },
                    { name: 'offset', type: 'number', description: 'Pagination offset' },
                  ]}
                />
                <EndpointRow method="GET" path="/tasks/:id" title="Get a task" description="Returns the full task object." />
                <EndpointRow method="POST" path="/tasks" title="Create a task"
                  bodyParams={[
                    { name: 'title', type: 'string', required: true, description: 'Task title' },
                    { name: 'description', type: 'string', description: 'Detailed description' },
                    { name: 'lead_id', type: 'uuid', description: 'Link to a lead' },
                    { name: 'assignee_id', type: 'uuid', description: 'Assign to a team member' },
                    { name: 'due_date', type: 'date', description: 'Due date — YYYY-MM-DD format' },
                    { name: 'priority', type: 'string', description: 'low, medium, or high' },
                    { name: 'is_completed', type: 'boolean', description: 'Defaults to false' },
                  ]}
                />
                <EndpointRow method="PATCH" path="/tasks/:id" title="Update a task"
                  description="Use is_completed: true to mark a task done."
                  bodyParams={[
                    { name: 'title', type: 'string', description: 'Updated title' },
                    { name: 'is_completed', type: 'boolean', description: 'Mark complete or incomplete' },
                    { name: 'due_date', type: 'date', description: 'Updated due date' },
                    { name: 'priority', type: 'string', description: 'low, medium, or high' },
                    { name: 'assignee_id', type: 'uuid', description: 'Reassign task' },
                  ]}
                />
                <EndpointRow method="DELETE" path="/tasks/:id" title="Delete a task" responseExample={`{ "success": true }`} />
              </Accordion>
            </section>

            {/* Follow-ups */}
            <section id="follow-ups" className="scroll-mt-4 space-y-4">
              <h2 className="text-base font-semibold text-foreground flex items-center gap-2 border-b border-border/60 pb-2">
                <CalendarCheck className="h-4 w-4 text-primary" />Follow-ups
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">Scheduled actions linked to a lead. Results are ordered by <code className="bg-muted px-1.5 py-0.5 rounded-md text-xs font-mono">scheduled_at</code> ascending.</p>
              <Accordion type="multiple" className="space-y-2">
                <EndpointRow method="GET" path="/follow_ups" title="List follow-ups"
                  queryParams={[
                    { name: 'lead_id', type: 'uuid', description: 'Filter by lead' },
                    { name: 'user_id', type: 'uuid', description: 'Filter by responsible team member' },
                    { name: 'limit', type: 'number', description: 'Default 50, max 100' },
                    { name: 'offset', type: 'number', description: 'Pagination offset' },
                  ]}
                />
                <EndpointRow method="GET" path="/follow_ups/:id" title="Get a follow-up" />
                <EndpointRow method="POST" path="/follow_ups" title="Schedule a follow-up"
                  bodyParams={[
                    { name: 'lead_id', type: 'uuid', required: true, description: 'The lead this follow-up belongs to' },
                    { name: 'user_id', type: 'uuid', required: true, description: 'Responsible team member' },
                    { name: 'scheduled_at', type: 'datetime', required: true, description: 'ISO 8601 UTC — e.g. 2026-03-10T09:00:00Z' },
                    { name: 'notes', type: 'string', description: 'What to discuss or action' },
                    { name: 'is_completed', type: 'boolean', description: 'Defaults to false' },
                  ]}
                />
                <EndpointRow method="PATCH" path="/follow_ups/:id" title="Update a follow-up"
                  bodyParams={[
                    { name: 'scheduled_at', type: 'datetime', description: 'Reschedule' },
                    { name: 'notes', type: 'string', description: 'Update notes' },
                    { name: 'is_completed', type: 'boolean', description: 'Mark complete' },
                  ]}
                />
                <EndpointRow method="DELETE" path="/follow_ups/:id" title="Delete a follow-up" />
              </Accordion>
            </section>

            {/* Activities */}
            <section id="activities" className="scroll-mt-4 space-y-4">
              <h2 className="text-base font-semibold text-foreground flex items-center gap-2 border-b border-border/60 pb-2">
                <Activity className="h-4 w-4 text-primary" />Activities
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">Timeline entries on a lead — calls, emails, meetings, notes. Results ordered by <code className="bg-muted px-1.5 py-0.5 rounded-md text-xs font-mono">created_at</code> descending.</p>
              <Accordion type="multiple" className="space-y-2">
                <EndpointRow method="GET" path="/activities" title="List activities"
                  queryParams={[
                    { name: 'lead_id', type: 'uuid', description: 'Filter by lead' },
                    { name: 'limit', type: 'number', description: 'Default 50, max 100' },
                    { name: 'offset', type: 'number', description: 'Pagination offset' },
                  ]}
                />
                <EndpointRow method="GET" path="/activities/:id" title="Get an activity" />
                <EndpointRow method="POST" path="/activities" title="Log an activity"
                  bodyParams={[
                    { name: 'lead_id', type: 'uuid', required: true, description: 'The lead this activity is logged against' },
                    { name: 'user_id', type: 'uuid', required: true, description: 'Team member who performed the activity' },
                    { name: 'type', type: 'string', required: true, description: 'call, email, meeting, note, whatsapp, or other' },
                    { name: 'description', type: 'string', description: 'What happened or was discussed' },
                    { name: 'occurred_at', type: 'datetime', description: 'ISO 8601 UTC timestamp. Defaults to now.' },
                  ]}
                />
                <EndpointRow method="PATCH" path="/activities/:id" title="Update an activity"
                  bodyParams={[
                    { name: 'type', type: 'string', description: 'Updated activity type' },
                    { name: 'description', type: 'string', description: 'Updated description' },
                    { name: 'occurred_at', type: 'datetime', description: 'Updated timestamp' },
                  ]}
                />
                <EndpointRow method="DELETE" path="/activities/:id" title="Delete an activity" />
              </Accordion>
            </section>

            {/* Documents */}
            <section id="documents" className="scroll-mt-4 space-y-4">
              <h2 className="text-base font-semibold text-foreground flex items-center gap-2 border-b border-border/60 pb-2">
                <FileText className="h-4 w-4 text-primary" />Documents
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">Files associated with a lead — NDAs, pricing sheets, quotations, and custom files.</p>
              <Accordion type="multiple" className="space-y-2">
                <EndpointRow method="GET" path="/documents" title="List documents for a lead"
                  description="lead_id is required. Results ordered by uploaded_at descending."
                  queryParams={[
                    { name: 'lead_id', type: 'uuid', required: true, description: 'The lead to list documents for' },
                    { name: 'limit', type: 'number', description: 'Default 50, max 100' },
                    { name: 'offset', type: 'number', description: 'Pagination offset' },
                  ]}
                />
                <EndpointRow method="GET" path="/documents/:id" title="Get a document" />
                <EndpointRow method="POST" path="/documents" title="Record a document"
                  bodyParams={[
                    { name: 'lead_id', type: 'uuid', required: true, description: 'Lead this document belongs to' },
                    { name: 'document_type', type: 'string', required: true, description: 'nda, pricing, quotation, or custom' },
                    { name: 'file_path', type: 'string', required: true, description: 'Storage path or URL of the file' },
                    { name: 'file_name', type: 'string', required: true, description: 'Display file name e.g. proposal.pdf' },
                    { name: 'uploaded_by', type: 'uuid', required: true, description: 'User ID of the uploader' },
                    { name: 'file_size', type: 'number', description: 'File size in bytes' },
                    { name: 'custom_name', type: 'string', description: 'Label used when document_type is "custom"' },
                  ]}
                />
                <EndpointRow method="DELETE" path="/documents/:id" title="Delete a document" />
              </Accordion>
            </section>

            {/* Notifications */}
            <section id="notifications" className="scroll-mt-4 space-y-4">
              <h2 className="text-base font-semibold text-foreground flex items-center gap-2 border-b border-border/60 pb-2">
                <Bell className="h-4 w-4 text-primary" />Notifications
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">Push in-app notifications to specific team members from your workflows.</p>
              <Accordion type="multiple" className="space-y-2">
                <EndpointRow method="GET" path="/notifications" title="List notifications for a user"
                  description="user_id is required. Returns notifications ordered by created_at descending."
                  queryParams={[
                    { name: 'user_id', type: 'uuid', required: true, description: 'Team member to list notifications for' },
                    { name: 'limit', type: 'number', description: 'Default 50, max 100' },
                    { name: 'offset', type: 'number', description: 'Pagination offset' },
                  ]}
                />
                <EndpointRow method="POST" path="/notifications" title="Send a notification"
                  description="Creates an in-app notification. The recipient sees it immediately in the notification bell."
                  bodyParams={[
                    { name: 'user_id', type: 'uuid', required: true, description: 'Recipient team member' },
                    { name: 'title', type: 'string', required: true, description: 'Short title shown in the notification bell' },
                    { name: 'message', type: 'string', required: true, description: 'Full notification message' },
                    { name: 'type', type: 'string', description: 'info (default), warning, success, task, lead, or email' },
                    { name: 'metadata', type: 'object', description: 'Any additional JSON data to attach' },
                  ]}
                />
              </Accordion>
            </section>

            {/* Reference */}
            <section id="reference" className="scroll-mt-4 space-y-4">
              <h2 className="text-base font-semibold text-foreground flex items-center gap-2 border-b border-border/60 pb-2">
                <Database className="h-4 w-4 text-primary" />Reference data
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">Use these endpoints to get IDs for status, country, and team fields when creating or updating records.</p>
              <Accordion type="multiple" className="space-y-2">
                <EndpointRow method="GET" path="/team" title="List team members"
                  description="Returns all team members with user_id, role, and full_name. Use user_id values for owner_id, assignee_id, and user_id fields across all endpoints."
                  responseExample={`[ { "user_id": "uuid", "role": "admin", "full_name": "Ranjith Kumar" }, ... ]`}
                />
                <EndpointRow method="GET" path="/statuses" title="List pipeline statuses"
                  description="Returns all pipeline stages ordered by sort_order. Use id values as status_id when creating or moving leads."
                  responseExample={`[ { "id": "uuid", "name": "Prospect", "color": "#6366f1", "sort_order": 1 }, ... ]`}
                />
                <EndpointRow method="GET" path="/countries" title="List countries"
                  description="Returns all countries ordered by name. Use id values as country_id."
                />
                <EndpointRow method="GET" path="/profiles" title="List profiles"
                  description="Returns team member profiles — user_id, full_name, designation, phone."
                />
              </Accordion>
            </section>

            {/* Workflow examples */}
            <section id="workflows" className="scroll-mt-4 space-y-4">
              <h2 className="text-base font-semibold text-foreground flex items-center gap-2 border-b border-border/60 pb-2">
                <Zap className="h-4 w-4 text-primary" />Workflow examples
              </h2>
              <div className="space-y-6">
                {[
                  {
                    title: '1. Create a lead and schedule a follow-up',
                    code: `# Step 1 — get available statuses
curl -H "Authorization: Bearer <key>" ${BASE_URL}/statuses

# Step 2 — get team member IDs
curl -H "Authorization: Bearer <key>" ${BASE_URL}/team

# Step 3 — create the lead
curl -X POST ${BASE_URL}/leads \\
  -H "Authorization: Bearer <key>" \\
  -H "Content-Type: application/json" \\
  -d '{ "company_name": "Acme Corp", "status_id": "<uuid>", "owner_id": "<uuid>" }'

# Step 4 — schedule a follow-up
curl -X POST ${BASE_URL}/follow_ups \\
  -H "Authorization: Bearer <key>" \\
  -H "Content-Type: application/json" \\
  -d '{ "lead_id": "<lead_uuid>", "user_id": "<uuid>", "scheduled_at": "2026-03-10T09:00:00Z", "notes": "Demo call" }'`,
                  },
                  {
                    title: '2. Move a lead to a new pipeline stage',
                    code: `curl -X PATCH ${BASE_URL}/leads/<lead_uuid> \\
  -H "Authorization: Bearer <key>" \\
  -H "Content-Type: application/json" \\
  -d '{ "status_id": "<new_status_uuid>" }'`,
                  },
                  {
                    title: '3. Bulk reassign leads',
                    code: `curl -X PATCH ${BASE_URL}/leads/bulk \\
  -H "Authorization: Bearer <key>" \\
  -H "Content-Type: application/json" \\
  -d '{ "lead_ids": ["<uuid1>", "<uuid2>"], "owner_id": "<new_owner_uuid>" }'`,
                  },
                  {
                    title: '4. Log a call and create a follow-up task',
                    code: `# Log the call
curl -X POST ${BASE_URL}/activities \\
  -H "Authorization: Bearer <key>" \\
  -H "Content-Type: application/json" \\
  -d '{ "lead_id": "<uuid>", "user_id": "<uuid>", "type": "call", "description": "Discussed pricing" }'

# Create a task
curl -X POST ${BASE_URL}/tasks \\
  -H "Authorization: Bearer <key>" \\
  -H "Content-Type: application/json" \\
  -d '{ "title": "Send proposal", "lead_id": "<uuid>", "assignee_id": "<uuid>", "due_date": "2026-03-07", "priority": "high" }'`,
                  },
                  {
                    title: '5. Push an in-app notification',
                    code: `curl -X POST ${BASE_URL}/notifications \\
  -H "Authorization: Bearer <key>" \\
  -H "Content-Type: application/json" \\
  -d '{ "user_id": "<uuid>", "title": "New RFQ received", "message": "Acme Corp submitted a new RFQ.", "type": "lead" }'`,
                  },
                ].map((ex) => (
                  <div key={ex.title} className="space-y-2">
                    <h3 className="text-sm font-semibold text-foreground">{ex.title}</h3>
                    <CodeBlock code={ex.code} language="bash" />
                  </div>
                ))}
              </div>
            </section>

            {/* Status codes */}
            <section id="errors" className="scroll-mt-4 space-y-4">
              <h2 className="text-base font-semibold text-foreground flex items-center gap-2 border-b border-border/60 pb-2">
                <AlertTriangle className="h-4 w-4 text-primary" />Errors & status codes
              </h2>
              <p className="text-sm text-muted-foreground">All error responses use a consistent format:</p>
              <CodeBlock language="json" code={`{ "error": "Description of what went wrong" }`} />
              <div className="rounded-xl border border-border/60 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 border-b border-border/60">
                    <tr>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground w-16">Code</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground w-32">Status</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Meaning</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {[
                      { code: '200', status: 'OK', meaning: 'Request succeeded.' },
                      { code: '201', status: 'Created', meaning: 'Record created. Response contains the new object.' },
                      { code: '400', status: 'Bad Request', meaning: 'Invalid request — missing required fields or bad values. Check the error message.' },
                      { code: '401', status: 'Unauthorized', meaning: 'Missing or invalid API key. Check the Authorization header.' },
                      { code: '403', status: 'Forbidden', meaning: 'Valid key but insufficient permissions.' },
                      { code: '404', status: 'Not Found', meaning: 'The requested resource or ID does not exist.' },
                      { code: '405', status: 'Method Not Allowed', meaning: 'HTTP method not supported on this endpoint.' },
                      { code: '500', status: 'Server Error', meaning: 'Unexpected error. Retry after a short wait; contact support if it persists.' },
                    ].map((r) => (
                      <tr key={r.code} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-2.5 font-mono text-xs font-bold text-foreground">{r.code}</td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground font-medium">{r.status}</td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground">{r.meaning}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* FAQ */}
            <section id="faq" className="scroll-mt-4 space-y-4">
              <h2 className="text-base font-semibold text-foreground flex items-center gap-2 border-b border-border/60 pb-2">
                <HelpCircle className="h-4 w-4 text-primary" />FAQ
              </h2>
              <Accordion type="multiple" className="space-y-2">
                {[
                  {
                    q: 'Where do I create an API key?',
                    a: 'Go to Admin Panel → API for Integrations. Click "Create API key", enter a name, and copy the key — it is shown only once. Store it in a secure secrets manager or environment variable.',
                  },
                  {
                    q: 'How do I find status_id, owner_id, or country_id values?',
                    a: 'Call the reference endpoints: GET /statuses for pipeline stages, GET /team for team member user IDs, and GET /countries for country IDs.',
                  },
                  {
                    q: 'Can I create a lead without a status or owner?',
                    a: 'Yes — only company_name is required when creating a lead. All other fields including status_id, owner_id, and country_id are optional.',
                  },
                  {
                    q: 'What datetime format should I use?',
                    a: 'Use ISO 8601 UTC: YYYY-MM-DDTHH:MM:SSZ — for example 2026-03-10T09:00:00Z. For date-only fields like due_date on tasks, use YYYY-MM-DD.',
                  },
                  {
                    q: 'Can I update multiple leads at once?',
                    a: 'Yes — use PATCH /leads/bulk with a lead_ids array. You can set status_id, owner_id, or country_id in one call. At least one update field is required.',
                  },
                  {
                    q: 'What notification types are supported?',
                    a: 'When creating notifications, the type field accepts: info (default), warning, success, task, lead, or email.',
                  },
                  {
                    q: 'Is there a rate limit?',
                    a: 'There is no hard rate limit currently. Use the API responsibly. For high-volume automations, add short delays between requests.',
                  },
                  {
                    q: 'What happens if I send an unknown field in the request body?',
                    a: 'Unknown fields are silently ignored. Only the fields listed in the request body tables for each endpoint are persisted.',
                  },
                  {
                    q: 'How do I revoke an API key?',
                    a: 'Go to Admin Panel → API for Integrations and click the trash icon next to the key. It is immediately invalidated — further requests using it return 401.',
                  },
                ].map((item) => (
                  <AccordionItem key={item.q} value={item.q} className="border border-border/60 rounded-xl overflow-hidden bg-card/50">
                    <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/30 transition-colors text-sm font-medium text-left [&>svg]:text-muted-foreground">
                      {item.q}
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4 pt-1 text-sm text-muted-foreground leading-relaxed border-t border-border/60 bg-muted/10">
                      {item.a}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </section>

            {/* footer */}
            <Card className="card-shadow border-border/60 p-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <p className="text-sm font-semibold text-foreground">RemoAsset Connect API</p>
                  <p className="text-xs text-muted-foreground">For authorised integrations only · Last updated {LAST_UPDATED}</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="gap-2 text-xs h-8" onClick={() => navigate('/admin')}>
                    <Key className="h-3.5 w-3.5" />Manage API keys
                  </Button>
                  <Button variant="outline" size="sm" className="gap-2 text-xs h-8" onClick={copyBase}>
                    <Copy className="h-3.5 w-3.5" />Copy base URL
                  </Button>
                </div>
              </div>
            </Card>

          </div>
        </div>
      </div>
    </AppLayout>
  );
}
