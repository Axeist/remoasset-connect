import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from '@/components/ui/accordion';
import {
  HelpCircle, FileUp, Shield, LayoutDashboard, Users, CheckSquare, Bell,
  BarChart3, Activity, BookOpen, Zap, AlertCircle, ChevronRight, Globe2,
  Mail, Calendar, Key, MessageCircle, FileText, Star, TrendingUp, Search,
  Filter, Download, Upload, UserPlus, Settings, RefreshCw, Eye, Edit2,
  Trash2, CheckCircle2, Clock, Kanban, MapPin, Phone, Link as LinkIcon,
  Paperclip, ShieldCheck, Linkedin, Info, ArrowRight, Inbox,
} from 'lucide-react';

// ─── tiny reusable pieces ──────────────────────────────────────────────────

function SectionHeading({ icon: Icon, title, badge }: { icon: React.ElementType; title: string; badge?: string }) {
  return (
    <span className="flex items-center gap-3 text-left">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 shrink-0">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <span className="font-semibold text-base">{title}</span>
      {badge && <Badge variant="secondary" className="text-xs ml-1">{badge}</Badge>}
    </span>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg bg-primary/5 border border-primary/20 px-3.5 py-3 text-sm">
      <Zap className="h-4 w-4 text-primary shrink-0 mt-0.5" />
      <p className="text-muted-foreground leading-relaxed">{children}</p>
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg bg-amber-500/5 border border-amber-500/20 px-3.5 py-3 text-sm">
      <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
      <p className="text-muted-foreground leading-relaxed">{children}</p>
    </div>
  );
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return <h4 className="font-semibold text-foreground text-sm mt-5 mb-2 flex items-center gap-2">{children}</h4>;
}

function StepList({ steps }: { steps: string[] }) {
  return (
    <ol className="space-y-2">
      {steps.map((s, i) => (
        <li key={i} className="flex items-start gap-3 text-sm text-muted-foreground">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary text-[10px] font-bold mt-0.5">{i + 1}</span>
          <span className="leading-relaxed" dangerouslySetInnerHTML={{ __html: s }} />
        </li>
      ))}
    </ol>
  );
}

function BulletList({ items }: { items: (string | React.ReactNode)[] }) {
  return (
    <ul className="space-y-1.5">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
          <ChevronRight className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <span className="leading-relaxed">{item}</span>
        </li>
      ))}
    </ul>
  );
}

function ScoreRow({ type, points, desc }: { type: string; points: string; desc: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/40 last:border-0 text-sm gap-3">
      <span className="text-foreground font-medium w-28 shrink-0">{type}</span>
      <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 w-12 shrink-0">{points}</span>
      <span className="text-muted-foreground text-xs">{desc}</span>
    </div>
  );
}

// ─── sections config for sidebar ──────────────────────────────────────────

const SECTIONS = [
  { id: 'getting-started', label: 'Getting started', icon: LayoutDashboard },
  { id: 'leads',           label: 'Leads',            icon: Users },
  { id: 'activities',      label: 'Activities & score',icon: Activity },
  { id: 'import',          label: 'CSV import & export',icon: FileUp },
  { id: 'tasks-followups', label: 'Tasks & follow-ups',icon: CheckSquare },
  { id: 'pipeline',        label: 'Pipeline',          icon: Kanban },
  { id: 'inbox',           label: 'Inbox & Gmail',     icon: Mail },
  { id: 'reports',         label: 'Reports',           icon: BarChart3 },
  { id: 'admin',           label: 'Admin panel',       icon: Shield },
  { id: 'integrations',    label: 'Integrations',      icon: Zap },
  { id: 'notifications',   label: 'Notifications',     icon: Bell },
  { id: 'tips',            label: 'Tips & shortcuts',  icon: Star },
];

// ─── page ─────────────────────────────────────────────────────────────────

export default function Help() {
  const [openSections, setOpenSections] = useState<string[]>(['getting-started']);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <AppLayout>
      <div className="w-full space-y-8 animate-fade-in-up">

        {/* ── hero ── */}
        <div className="relative rounded-2xl overflow-hidden border border-border/60 bg-gradient-to-br from-card via-card to-primary/5 p-8">
          <div className="absolute inset-0 pointer-events-none opacity-30"
            style={{ background: 'radial-gradient(ellipse at 80% 50%, hsl(var(--primary)/0.15) 0%, transparent 60%)' }} />
          <div className="relative flex items-start gap-5">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15 shrink-0">
              <HelpCircle className="h-7 w-7 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-3xl font-display font-bold tracking-tight mb-1">Help & Documentation</h1>
              <p className="text-muted-foreground text-sm mb-5">Complete guide to RemoAsset Connect — Vendor Resource Management</p>
              {/* feature pills */}
              <div className="flex flex-wrap gap-2">
                {[
                  { icon: Users,        label: 'Lead management' },
                  { icon: Activity,     label: 'Activity tracking' },
                  { icon: BarChart3,    label: 'Reports & analytics' },
                  { icon: Mail,         label: 'Gmail integration' },
                  { icon: Calendar,     label: 'Google Calendar' },
                  { icon: CheckSquare,  label: 'Tasks & follow-ups' },
                  { icon: Globe2,       label: 'Pipeline' },
                  { icon: Shield,       label: 'Admin tools' },
                  { icon: Key,          label: 'API access' },
                ].map(({ icon: Icon, label }) => (
                  <span key={label} className="inline-flex items-center gap-1.5 rounded-full bg-muted/60 border border-border/60 px-3 py-1 text-xs font-medium text-muted-foreground">
                    <Icon className="h-3 w-3 text-primary" />{label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── quick nav cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { icon: LayoutDashboard, label: 'Getting started', id: 'getting-started', color: 'text-blue-500 bg-blue-500/10' },
            { icon: Users,           label: 'Leads',           id: 'leads',           color: 'text-violet-500 bg-violet-500/10' },
            { icon: Activity,        label: 'Activities',      id: 'activities',      color: 'text-primary bg-primary/10' },
            { icon: CheckSquare,     label: 'Tasks',           id: 'tasks-followups', color: 'text-emerald-500 bg-emerald-500/10' },
            { icon: BarChart3,       label: 'Reports',         id: 'reports',         color: 'text-amber-500 bg-amber-500/10' },
            { icon: Shield,          label: 'Admin',           id: 'admin',           color: 'text-rose-500 bg-rose-500/10' },
          ].map(({ icon: Icon, label, id, color }) => (
            <button key={id} onClick={() => scrollTo(id)}
              className="flex flex-col items-center gap-2 p-4 rounded-xl border border-border/60 bg-card/50 hover:bg-card hover:border-primary/30 hover:shadow-sm transition-all group text-center">
              <div className={cn('flex h-9 w-9 items-center justify-center rounded-xl', color)}>
                <Icon className="h-4 w-4" />
              </div>
              <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors">{label}</span>
            </button>
          ))}
        </div>

        {/* ── two-column layout ── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-8 items-start">

          {/* ── main accordion ── */}
          <div className="min-w-0">
            <Accordion type="multiple" value={openSections} onValueChange={setOpenSections} className="space-y-3">

              {/* GETTING STARTED */}
              <AccordionItem value="getting-started" id="getting-started" className="border rounded-xl overflow-hidden bg-card/50 scroll-mt-4">
                <AccordionTrigger className="hover:no-underline px-5 py-4 hover:bg-muted/20 transition-colors [&>svg]:text-muted-foreground">
                  <SectionHeading icon={LayoutDashboard} title="Getting started & navigation" />
                </AccordionTrigger>
                <AccordionContent className="px-5 pb-6 space-y-5 border-t border-border/60 bg-muted/5">
                  <p className="text-sm text-muted-foreground leading-relaxed pt-4">
                    RemoAsset Connect is a Vendor Resource Management platform. Your role — <strong className="text-foreground">Admin</strong> or <strong className="text-foreground">Employee</strong> — determines which pages you can access. Use the sidebar to navigate.
                  </p>

                  <div className="grid sm:grid-cols-2 gap-3">
                    {[
                      { icon: LayoutDashboard, title: 'Dashboard', desc: 'KPIs, charts, recent activity, lead distribution map. Admins see team-wide metrics; employees see their own pipeline.' },
                      { icon: Users,           title: 'Leads',     desc: 'Full lead list with filters, search, bulk actions, and access to each lead\'s detail page.' },
                      { icon: Kanban,          title: 'Pipeline',  desc: 'Kanban board view of your (or all team\'s) leads sorted by status column.' },
                      { icon: CheckSquare,     title: 'Tasks',     desc: 'Tasks assigned to you. List and Kanban views, overdue highlighting, priority labels.' },
                      { icon: CheckSquare,     title: 'Follow-ups',desc: 'Scheduled follow-up calls/meetings. Overdue alerts, mark done, link to lead.' },
                      { icon: Inbox,           title: 'Inbox',     desc: 'Gmail integration — all email threads with your leads in one place without leaving the app.' },
                      { icon: BarChart3,       title: 'Reports',   desc: 'Productivity charts, lead velocity, employee scorecards, and CSV export.' },
                      { icon: Activity,        title: 'Activity Monitor', desc: 'Admin-only: all team tasks and follow-ups with overdue filtering and workload view.' },
                      { icon: Bell,            title: 'Notifications', desc: 'In-app alerts for assignments, overdue items, and configured events.' },
                      { icon: Shield,          title: 'Admin Panel', desc: 'User management, pipeline statuses, countries, integrations, API keys, analytics.' },
                    ].map((item) => (
                      <div key={item.title} className="flex gap-3 rounded-xl border border-border/60 bg-card p-3.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 shrink-0 mt-0.5">
                          <item.icon className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">{item.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{item.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <Tip>Start by logging activities on every lead interaction — calls, emails, meetings. This keeps the activity feed accurate and the lead score up-to-date.</Tip>
                </AccordionContent>
              </AccordionItem>

              {/* LEADS */}
              <AccordionItem value="leads" id="leads" className="border rounded-xl overflow-hidden bg-card/50 scroll-mt-4">
                <AccordionTrigger className="hover:no-underline px-5 py-4 hover:bg-muted/20 transition-colors [&>svg]:text-muted-foreground">
                  <SectionHeading icon={Users} title="Leads management" />
                </AccordionTrigger>
                <AccordionContent className="px-5 pb-6 space-y-5 border-t border-border/60 bg-muted/5">
                  <div className="pt-4 space-y-5">
                    <SubHeading><UserPlus className="h-4 w-4 text-primary" />Adding a lead</SubHeading>
                    <StepList steps={[
                      'Click <strong class="text-foreground">+ Add lead</strong> in the top-right of the Leads page.',
                      '<strong class="text-foreground">Required:</strong> Company name, Website, Country, Status, Vendor type(s).',
                      '<strong class="text-foreground">Optional:</strong> Email, Phone, Contact name, Designation, Notes.',
                      'Toggle <strong class="text-foreground">Warehouse available</strong> to add warehouse location, notes, price, and currency.',
                      'Click <strong class="text-foreground">Save lead</strong>. The lead appears in the list immediately.',
                    ]} />

                    <SubHeading><Filter className="h-4 w-4 text-primary" />Filtering & searching leads</SubHeading>
                    <div className="grid sm:grid-cols-2 gap-2">
                      {[
                        ['Search box', 'Full-text search across company name, contact, email'],
                        ['Status filter', 'Filter by one or more pipeline stages'],
                        ['Country filter', 'Show leads from specific countries'],
                        ['Owner filter', 'See only leads assigned to a specific team member'],
                        ['Vendor type', 'Filter by the vendor category'],
                        ['Score range', 'Show leads above/below a score threshold'],
                        ['Rows per page', 'Choose 10, 25, 50, or 100 leads per page'],
                        ['Reset', 'Clear all filters at once'],
                      ].map(([label, desc]) => (
                        <div key={label} className="flex gap-2 text-sm">
                          <span className="font-medium text-foreground shrink-0 w-28">{label}</span>
                          <span className="text-muted-foreground">{desc}</span>
                        </div>
                      ))}
                    </div>

                    <SubHeading><Eye className="h-4 w-4 text-primary" />Lead detail tabs</SubHeading>
                    <div className="space-y-2">
                      {[
                        { tab: 'Overview',    desc: 'Company info, contact details, country, status, vendor types, warehouse. Click any field to edit inline.' },
                        { tab: 'Activity',    desc: 'Full log of all interactions. Filter by type. Each row shows lead score impact. Add new activities here.' },
                        { tab: 'Emails',      desc: 'All Gmail threads with this lead. Read conversations, compose, reply — without leaving the app. Requires Google connection.' },
                        { tab: 'Tasks',       desc: 'Tasks linked to this lead. Pending +3 pts, completed +5 pts. Create from here or link existing tasks.' },
                        { tab: 'Follow-ups',  desc: 'Scheduled follow-ups for this lead. Mark done, reschedule, or delete.' },
                        { tab: 'Documents',   desc: 'Upload NDAs, proposals, quotations, or custom files. All documents appear here and in the activity feed.' },
                        { tab: 'Notes',       desc: 'Free-form notes area. Useful for internal context not tied to a specific activity.' },
                      ].map(({ tab, desc }) => (
                        <div key={tab} className="flex items-start gap-3 text-sm rounded-lg border border-border/40 bg-card px-3.5 py-2.5">
                          <span className="font-semibold text-primary shrink-0 w-24">{tab}</span>
                          <span className="text-muted-foreground leading-relaxed">{desc}</span>
                        </div>
                      ))}
                    </div>

                    <SubHeading><Edit2 className="h-4 w-4 text-primary" />Bulk actions (Admin)</SubHeading>
                    <BulletList items={[
                      'Check the boxes on the left to select multiple leads.',
                      'Use Bulk actions → Change owner to reassign selected leads. The change is logged in each lead\'s activity feed.',
                      'Admins can also bulk delete leads from the list page.',
                      'Bulk updates are recorded as system events in the activity log.',
                    ]} />

                    <Tip>Use the lead score to prioritise outreach. Leads with high scores have more recent and meaningful interactions — focus new efforts on mid-score leads to move them forward.</Tip>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* ACTIVITIES & LEAD SCORE */}
              <AccordionItem value="activities" id="activities" className="border rounded-xl overflow-hidden bg-card/50 scroll-mt-4">
                <AccordionTrigger className="hover:no-underline px-5 py-4 hover:bg-muted/20 transition-colors [&>svg]:text-muted-foreground">
                  <SectionHeading icon={Activity} title="Activities & lead score" />
                </AccordionTrigger>
                <AccordionContent className="px-5 pb-6 space-y-5 border-t border-border/60 bg-muted/5">
                  <div className="pt-4 space-y-5">
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Every interaction with a lead is logged as an activity. Activities build the lead's score — the higher the score, the more engaged the lead is. Scores cap at 100.
                    </p>

                    <SubHeading><Star className="h-4 w-4 text-primary" />Activity types & score points</SubHeading>
                    <div className="rounded-xl border border-border/60 overflow-hidden">
                      <div className="grid grid-cols-3 px-4 py-2 bg-muted/40 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        <span>Type</span><span>Points</span><span>Notes</span>
                      </div>
                      <div className="px-4 divide-y divide-border/40">
                        <ScoreRow type="Meeting"    points="+10" desc="Highest value — a scheduled meeting shows strong intent" />
                        <ScoreRow type="NDA"        points="+8"  desc="NDA activity; +7 bonus if description includes 'NDA Received'" />
                        <ScoreRow type="Call"       points="+6"  desc="Phone call logged" />
                        <ScoreRow type="Quotation"  points="+7"  desc="Quotation received and filed" />
                        <ScoreRow type="WhatsApp"   points="+5"  desc="WhatsApp conversation logged" />
                        <ScoreRow type="LinkedIn"   points="+4"  desc="LinkedIn outreach or message" />
                        <ScoreRow type="Email"      points="+3"  desc="+8 bonus if reply keywords detected (e.g. 'agreed', 'confirmed')" />
                        <ScoreRow type="Note"       points="+1"  desc="Internal note with no direct lead interaction" />
                        <ScoreRow type="Task done"  points="+5"  desc="When a linked task is marked complete" />
                        <ScoreRow type="Follow-up done" points="+5" desc="When a scheduled follow-up is marked complete" />
                      </div>
                    </div>

                    <SubHeading><FileText className="h-4 w-4 text-primary" />Logging an activity</SubHeading>
                    <StepList steps={[
                      'Open a lead → go to the <strong class="text-foreground">Activity</strong> tab.',
                      'Click <strong class="text-foreground">Add activity</strong>.',
                      'Choose the type: Call, Email, Meeting, WhatsApp, LinkedIn, NDA, Quotation, or Note.',
                      'Fill in the relevant fields (each type has unique fields — e.g. NDA has Sent/Received toggle, Quotation has file upload, Meeting has date/time picker).',
                      'Attach URLs or files if needed (up to 10 files, 10 MB each).',
                      'Click <strong class="text-foreground">Add activity</strong>. The score updates instantly.',
                    ]} />

                    <SubHeading>Special activity types</SubHeading>
                    <div className="grid sm:grid-cols-2 gap-3">
                      {[
                        { icon: Mail,        color: 'bg-blue-500/10 text-blue-500',   title: 'Email',     desc: 'Send via Gmail directly or just log it. Supports Cc/Bcc, rich text, file attachments, and auto-links to the Gmail thread.' },
                        { icon: Calendar,    color: 'bg-violet-500/10 text-violet-500',title: 'Meeting',  desc: 'Set event name, start/end time, attendees. Optionally sync to Google Calendar with a Meet link and email invites.' },
                        { icon: ShieldCheck, color: 'bg-primary/10 text-primary',     title: 'NDA',       desc: 'Choose NDA Sent or Received. Upload the signed document — it saves to the Documents tab. NDA Received auto-moves the lead to Closed Won.' },
                        { icon: FileText,    color: 'bg-amber-500/10 text-amber-500', title: 'Quotation', desc: 'Upload quotation files (PDF, Word, Excel, images). Files save to the Documents tab automatically.' },
                        { icon: Linkedin,    color: 'bg-sky-500/10 text-sky-500',     title: 'LinkedIn',  desc: 'Enter the contact\'s LinkedIn URL and the message you sent. Opens the profile in a new tab.' },
                        { icon: MessageCircle, color:'bg-emerald-500/10 text-emerald-500', title: 'WhatsApp', desc: 'Log the conversation. If the lead has a phone number, opens WhatsApp chat directly.' },
                      ].map(({ icon: Icon, color, title, desc }) => (
                        <div key={title} className="flex gap-3 rounded-xl border border-border/60 bg-card p-3.5">
                          <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg shrink-0 mt-0.5', color)}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-foreground">{title}</p>
                            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    <Note>Lead score is updated by a database trigger — it's always accurate even if multiple team members log activities simultaneously.</Note>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* CSV IMPORT & EXPORT */}
              <AccordionItem value="import" id="import" className="border rounded-xl overflow-hidden bg-card/50 scroll-mt-4">
                <AccordionTrigger className="hover:no-underline px-5 py-4 hover:bg-muted/20 transition-colors [&>svg]:text-muted-foreground">
                  <SectionHeading icon={FileUp} title="CSV import & export" />
                </AccordionTrigger>
                <AccordionContent className="px-5 pb-6 space-y-5 border-t border-border/60 bg-muted/5">
                  <div className="pt-4 space-y-5">
                    <SubHeading><Upload className="h-4 w-4 text-primary" />Importing leads from CSV</SubHeading>
                    <StepList steps={[
                      'Go to <strong class="text-foreground">Leads</strong> and click the <strong class="text-foreground">Import</strong> button.',
                      'Download the <strong class="text-foreground">sample CSV</strong> from the dialog to get the correct column format.',
                      'Prepare your file. Required column: <code class="bg-muted px-1 py-0.5 rounded text-xs">company_name</code> (or "Vendor Name"). All others are optional.',
                      'Upload your CSV. The dialog maps columns — verify each mapping before proceeding.',
                      'Click <strong class="text-foreground">Import</strong>. Errors (e.g. unknown country) are shown per-row.',
                    ]} />

                    <div className="rounded-xl border border-border/60 overflow-hidden">
                      <div className="px-4 py-2.5 bg-muted/40 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Supported CSV columns</div>
                      <div className="divide-y divide-border/40">
                        {[
                          ['company_name', 'Required', 'Also accepts "Vendor Name"'],
                          ['country',      'Optional', 'Must match an existing country in the system'],
                          ['website',      'Optional', 'Full URL e.g. https://example.com'],
                          ['email',        'Optional', 'Primary contact email'],
                          ['phone',        'Optional', 'Phone number with country code'],
                          ['contact_name', 'Optional', 'Primary contact person'],
                          ['designation',  'Optional', 'Contact job title'],
                          ['status',       'Optional', 'Must match an existing pipeline status'],
                          ['lead_score',   'Optional', 'Number 1–100'],
                          ['lead_owner',   'Optional', 'Exact full name of a team member'],
                          ['notes',        'Optional', 'Free-form notes'],
                        ].map(([col, req, note]) => (
                          <div key={col} className="flex items-start gap-3 px-4 py-2.5 text-sm">
                            <code className="font-mono text-xs text-primary w-32 shrink-0 mt-0.5">{col}</code>
                            <span className={cn('text-xs shrink-0 w-16', req === 'Required' ? 'text-rose-500 font-semibold' : 'text-muted-foreground')}>{req}</span>
                            <span className="text-muted-foreground text-xs">{note}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <SubHeading><Download className="h-4 w-4 text-primary" />Exporting data</SubHeading>
                    <BulletList items={[
                      <><strong className="text-foreground">Reports → Export Report</strong> — Downloads a CSV with productivity metrics, lead counts, and team data.</>,
                      <><strong className="text-foreground">Admin Panel → Analytics</strong> (admin only) — Generate sample lead CSVs for testing (100 leads per user with simulated activities).</>,
                      <>Also generates sample follow-ups and tasks on existing leads for demo purposes.</>,
                      <><strong className="text-foreground">Bulk delete</strong> of all follow-ups or all tasks is available in Admin → Analytics (irreversible).</>,
                    ]} />

                    <Tip>Before importing, add any new countries or pipeline statuses under Admin Panel → Configuration. Unknown values in the CSV will cause row-level import errors.</Tip>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* TASKS & FOLLOW-UPS */}
              <AccordionItem value="tasks-followups" id="tasks-followups" className="border rounded-xl overflow-hidden bg-card/50 scroll-mt-4">
                <AccordionTrigger className="hover:no-underline px-5 py-4 hover:bg-muted/20 transition-colors [&>svg]:text-muted-foreground">
                  <SectionHeading icon={CheckSquare} title="Tasks & follow-ups" />
                </AccordionTrigger>
                <AccordionContent className="px-5 pb-6 space-y-5 border-t border-border/60 bg-muted/5">
                  <div className="pt-4 space-y-5">
                    <div className="grid sm:grid-cols-2 gap-5">
                      <div className="space-y-3">
                        <SubHeading><CheckSquare className="h-4 w-4 text-emerald-500" />Tasks</SubHeading>
                        <BulletList items={[
                          'Create from My Tasks or from a lead\'s Tasks tab.',
                          <>Set title, description, due date, priority (<strong className="text-foreground">low / medium / high / urgent</strong>), link to a lead.</>,
                          'Completing a linked task logs a system activity (+5 pts) on the lead.',
                          'Overdue tasks are highlighted in red.',
                          'View as List or Kanban board.',
                          'Admins see all team tasks with assignee names.',
                        ]} />
                      </div>
                      <div className="space-y-3">
                        <SubHeading><Clock className="h-4 w-4 text-amber-500" />Follow-ups</SubHeading>
                        <BulletList items={[
                          'Schedule from a lead\'s Follow-ups tab or the main Follow-ups page.',
                          'Set date/time, reminder type (one-time or recurring), and notes.',
                          'Marking done logs an activity (+5 pts) on the linked lead.',
                          'Scheduled follow-ups show +2 pts until completed.',
                          'Overdue follow-ups show a warning badge.',
                          'Admins see all team follow-ups with assignee details.',
                        ]} />
                      </div>
                    </div>

                    <SubHeading><Activity className="h-4 w-4 text-primary" />Activity Monitor (Admin)</SubHeading>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Admins get a unified view of all tasks and follow-ups across the whole team. Filter by status, employee, and priority. Overdue items are clearly marked with a badge. Use it to rebalance workload and ensure deadlines are being met. Link directly to the related lead from any row.
                    </p>

                    <Note>Use the Activity Monitor weekly to spot employees with too many overdue items and proactively redistribute leads or tasks before they slip.</Note>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* PIPELINE */}
              <AccordionItem value="pipeline" id="pipeline" className="border rounded-xl overflow-hidden bg-card/50 scroll-mt-4">
                <AccordionTrigger className="hover:no-underline px-5 py-4 hover:bg-muted/20 transition-colors [&>svg]:text-muted-foreground">
                  <SectionHeading icon={Kanban} title="Pipeline" />
                </AccordionTrigger>
                <AccordionContent className="px-5 pb-6 space-y-5 border-t border-border/60 bg-muted/5">
                  <div className="pt-4 space-y-4">
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      The Pipeline is a Kanban-style board view of leads grouped by their current status. Each column represents one pipeline stage (e.g. New, Contacted, Qualified, Proposal).
                    </p>
                    <div className="grid sm:grid-cols-2 gap-3">
                      {[
                        { icon: Kanban,     title: 'My Pipeline',       desc: 'Employees see only their own leads. Drag cards between columns to move a lead to a new stage.' },
                        { icon: Globe2,     title: 'Pipeline Overview', desc: 'Admins see all leads from all team members. Filter by owner. Full team visibility in one board.' },
                        { icon: TrendingUp, title: 'Drag to move',      desc: 'Drag a lead card from one column to another to change its status. The change is logged as a system activity.' },
                        { icon: Eye,        title: 'Lead cards',        desc: 'Each card shows company name, lead score, contact, and country. Click to open the full lead detail.' },
                      ].map(({ icon: Icon, title, desc }) => (
                        <div key={title} className="flex gap-3 rounded-xl border border-border/60 bg-card p-3.5">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 shrink-0 mt-0.5">
                            <Icon className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-foreground">{title}</p>
                            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    <Tip>Keep the pipeline statuses updated — the Reports page and Dashboard use status to calculate lead velocity and conversion rates.</Tip>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* INBOX & GMAIL */}
              <AccordionItem value="inbox" id="inbox" className="border rounded-xl overflow-hidden bg-card/50 scroll-mt-4">
                <AccordionTrigger className="hover:no-underline px-5 py-4 hover:bg-muted/20 transition-colors [&>svg]:text-muted-foreground">
                  <SectionHeading icon={Mail} title="Inbox & Gmail integration" />
                </AccordionTrigger>
                <AccordionContent className="px-5 pb-6 space-y-5 border-t border-border/60 bg-muted/5">
                  <div className="pt-4 space-y-4">
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Connect your Google account (Admin Panel → Integrations) to unlock email and calendar features inside the app.
                    </p>

                    <SubHeading><Inbox className="h-4 w-4 text-primary" />Inbox page</SubHeading>
                    <BulletList items={[
                      'See all Gmail threads with your leads in one unified inbox.',
                      'Click any thread to read the full conversation.',
                      'Reply to threads without switching to Gmail.',
                      'Compose new emails to leads directly from the Inbox.',
                    ]} />

                    <SubHeading><Mail className="h-4 w-4 text-primary" />Lead Emails tab</SubHeading>
                    <BulletList items={[
                      <>Open a lead → <strong className="text-foreground">Emails</strong> tab: shows all Gmail threads with this lead's email address.</>,
                      'Read full conversation threads, compose new emails, reply — all in context.',
                      'Emails sent from here are logged as Email activities automatically.',
                    ]} />

                    <SubHeading><Calendar className="h-4 w-4 text-primary" />Google Calendar sync</SubHeading>
                    <BulletList items={[
                      <>When logging a <strong className="text-foreground">Meeting</strong> activity, check <strong className="text-foreground">"Add to Google Calendar"</strong>.</>,
                      'A Google Calendar event is created with the meeting title, time, and attendees.',
                      'A Google Meet link is generated automatically and attached to the activity.',
                      'Attendees receive calendar invitations via email.',
                    ]} />

                    <Note>Gmail and Calendar require the Google connection. Go to Admin Panel → Integrations and click Connect Google. One sign-in enables both Gmail and Calendar features.</Note>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* REPORTS */}
              <AccordionItem value="reports" id="reports" className="border rounded-xl overflow-hidden bg-card/50 scroll-mt-4">
                <AccordionTrigger className="hover:no-underline px-5 py-4 hover:bg-muted/20 transition-colors [&>svg]:text-muted-foreground">
                  <SectionHeading icon={BarChart3} title="Reports & analytics" />
                </AccordionTrigger>
                <AccordionContent className="px-5 pb-6 space-y-5 border-t border-border/60 bg-muted/5">
                  <div className="pt-4 space-y-5">
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {[
                        { icon: TrendingUp, title: 'Productivity KPIs',       desc: 'Avg response time, follow-up completion %, task completion %, daily activity avg, leads/day, activities/lead.' },
                        { icon: BarChart3,  title: 'Productivity chart',       desc: 'Hourly, Weekly, Monthly, Yearly view. Filter by year. Shows activities, tasks, and follow-ups over time.' },
                        { icon: Globe2,     title: 'Leads by country',         desc: 'Bar chart of lead distribution across countries.' },
                        { icon: Users,      title: 'Leads by status',          desc: 'Pie chart of pipeline stage distribution.' },
                        { icon: Clock,      title: 'Activity time distribution',desc: 'When during the day your team is most active.' },
                        { icon: MapPin,     title: 'World Demographics map',   desc: 'Color-intensity map on Dashboard showing lead concentration by country with zoom controls.' },
                      ].map(({ icon: Icon, title, desc }) => (
                        <div key={title} className="rounded-xl border border-border/60 bg-card p-3.5 space-y-1.5">
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4 text-primary" />
                            <span className="text-sm font-semibold text-foreground">{title}</span>
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
                        </div>
                      ))}
                    </div>

                    <SubHeading><Shield className="h-4 w-4 text-primary" />Admin-only reports</SubHeading>
                    <BulletList items={[
                      <><strong className="text-foreground">Employee productivity scorecard</strong> — Response time, follow-up rate, task completion rate, and efficiency score per team member.</>,
                      <><strong className="text-foreground">Top performers</strong> — Ranked table of who has the most activities, completed tasks, and closed leads.</>,
                      <><strong className="text-foreground">Lead velocity by stage</strong> — Average time a lead spends in each pipeline stage before moving on.</>,
                      <><strong className="text-foreground">Activity trends (14 days)</strong> — Day-by-day activity volume with team breakdown.</>,
                    ]} />

                    <SubHeading><Download className="h-4 w-4 text-primary" />Exporting</SubHeading>
                    <p className="text-sm text-muted-foreground">Click <strong className="text-foreground">Export Report</strong> on the Reports page to download all visible metrics and data as a CSV. Useful for sharing with management or archiving.</p>

                    <Tip>Check Reports weekly — lead velocity tells you which pipeline stages are bottlenecks. If leads are stuck in "Contacted" for too long, schedule more follow-ups.</Tip>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* ADMIN PANEL */}
              <AccordionItem value="admin" id="admin" className="border rounded-xl overflow-hidden bg-card/50 scroll-mt-4">
                <AccordionTrigger className="hover:no-underline px-5 py-4 hover:bg-muted/20 transition-colors [&>svg]:text-muted-foreground">
                  <SectionHeading icon={Shield} title="Admin panel" badge="Admin only" />
                </AccordionTrigger>
                <AccordionContent className="px-5 pb-6 space-y-5 border-t border-border/60 bg-muted/5">
                  <div className="pt-4 space-y-5">
                    <div className="grid sm:grid-cols-2 gap-3">
                      {[
                        { icon: Users,       title: 'Users',         desc: 'Add, invite, and manage team members. Set roles (Admin/Employee), ban/unban accounts, resend invites to pending users.' },
                        { icon: Settings,    title: 'Configuration', desc: 'Add and edit pipeline statuses (with colors and sort order) and countries. These are used across the entire app.' },
                        { icon: Zap,         title: 'Integrations',  desc: 'Connect Google Workspace (Gmail + Calendar), configure Slack notifications (lead events, daily digest, reminders).' },
                        { icon: Key,         title: 'API',           desc: 'Create and manage API keys for external integrations. View full API documentation.' },
                        { icon: BarChart3,   title: 'Analytics',     desc: 'Admin-level reports, sample data generation, and bulk data management tools.' },
                        { icon: Settings,    title: 'Developer',     desc: 'Enable/disable Developer mode — shows the Developer page in the sidebar with API tester, docs, and debug tools.' },
                      ].map(({ icon: Icon, title, desc }) => (
                        <div key={title} className="flex gap-3 rounded-xl border border-border/60 bg-card p-3.5">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 shrink-0 mt-0.5">
                            <Icon className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-foreground">{title}</p>
                            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    <SubHeading><UserPlus className="h-4 w-4 text-primary" />Inviting users</SubHeading>
                    <StepList steps={[
                      'Go to Admin Panel → Users.',
                      'Click <strong class="text-foreground">Invite user</strong>, enter their full name, email, and role.',
                      'An invitation email is sent via Resend SMTP with a secure link.',
                      'The invited user clicks the link, sets their password, and is auto-logged into the dashboard.',
                      'Pending invites show an amber <strong class="text-foreground">Pending</strong> badge. Use the <strong class="text-foreground">Resend invite</strong> button if they haven\'t accepted yet.',
                    ]} />

                    <Note>Admins cannot be banned or have their role changed by other admins from the UI — this prevents accidental lockouts. Use the Supabase dashboard for emergency role changes.</Note>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* INTEGRATIONS */}
              <AccordionItem value="integrations" id="integrations" className="border rounded-xl overflow-hidden bg-card/50 scroll-mt-4">
                <AccordionTrigger className="hover:no-underline px-5 py-4 hover:bg-muted/20 transition-colors [&>svg]:text-muted-foreground">
                  <SectionHeading icon={Zap} title="Integrations" />
                </AccordionTrigger>
                <AccordionContent className="px-5 pb-6 space-y-5 border-t border-border/60 bg-muted/5">
                  <div className="pt-4 space-y-5">
                    <div className="grid sm:grid-cols-3 gap-3">
                      {[
                        { icon: Mail,     color: 'bg-blue-500/10 text-blue-500',   title: 'Gmail',          desc: 'Read and send emails within the app. All threads with lead emails are synced to the Inbox and Lead Emails tab.' },
                        { icon: Calendar, color: 'bg-violet-500/10 text-violet-500',title: 'Google Calendar',desc: 'Sync meeting activities to Calendar. Auto-generate Meet links and send invites to attendees.' },
                        { icon: MessageCircle, color:'bg-emerald-500/10 text-emerald-500',title: 'Slack',    desc: 'Post notifications to a Slack channel for lead events, stage changes, tasks, follow-ups, and a daily digest.' },
                      ].map(({ icon: Icon, color, title, desc }) => (
                        <div key={title} className="flex flex-col gap-2 rounded-xl border border-border/60 bg-card p-4">
                          <div className={cn('flex h-9 w-9 items-center justify-center rounded-xl', color)}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <p className="text-sm font-semibold text-foreground">{title}</p>
                          <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
                        </div>
                      ))}
                    </div>

                    <SubHeading>Connecting Google</SubHeading>
                    <StepList steps={[
                      'Go to Admin Panel → Integrations.',
                      'Click <strong class="text-foreground">Connect Google</strong> and sign in with your Google account.',
                      'Grant the required permissions (Gmail read/send, Calendar events).',
                      'One sign-in enables both Gmail and Calendar features.',
                      'To switch accounts, click <strong class="text-foreground">Reconnect</strong> on the same page.',
                    ]} />

                    <SubHeading>Slack setup</SubHeading>
                    <StepList steps={[
                      'Create an incoming webhook in your Slack workspace (Apps → Incoming Webhooks).',
                      'Copy the webhook URL and paste it in Admin Panel → Integrations → Slack.',
                      'Toggle Slack notifications on and choose which events to notify about.',
                      'Optionally enable <strong class="text-foreground">Daily digest</strong> and set the hour for a summary message.',
                      'Use <strong class="text-foreground">Send test</strong> to verify the connection before saving.',
                    ]} />
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* NOTIFICATIONS */}
              <AccordionItem value="notifications" id="notifications" className="border rounded-xl overflow-hidden bg-card/50 scroll-mt-4">
                <AccordionTrigger className="hover:no-underline px-5 py-4 hover:bg-muted/20 transition-colors [&>svg]:text-muted-foreground">
                  <SectionHeading icon={Bell} title="Notifications" />
                </AccordionTrigger>
                <AccordionContent className="px-5 pb-6 space-y-4 border-t border-border/60 bg-muted/5">
                  <div className="pt-4 space-y-3">
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      In-app notifications keep you updated on new assignments, overdue items, and other events configured by your admin.
                    </p>
                    <BulletList items={[
                      <>Click the <strong className="text-foreground">bell icon</strong> in the top-right header for a quick dropdown of recent notifications.</>,
                      <>Go to <strong className="text-foreground">Notifications</strong> in the sidebar for the full history with type badges (info, warning, success, task, lead, email).</>,
                      'Click an individual notification to mark it as read.',
                      'Use "Mark all as read" to clear the entire list.',
                      'Notification count badge on the bell updates in real time.',
                      'Admins can also send notifications to team members via the API.',
                    ]} />
                    <Tip>Check the Notifications page at the start of each day to catch any new lead assignments or overdue alerts you may have missed.</Tip>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* TIPS & SHORTCUTS */}
              <AccordionItem value="tips" id="tips" className="border rounded-xl overflow-hidden bg-card/50 scroll-mt-4">
                <AccordionTrigger className="hover:no-underline px-5 py-4 hover:bg-muted/20 transition-colors [&>svg]:text-muted-foreground">
                  <SectionHeading icon={Star} title="Tips, best practices & shortcuts" />
                </AccordionTrigger>
                <AccordionContent className="px-5 pb-6 space-y-5 border-t border-border/60 bg-muted/5">
                  <div className="pt-4 space-y-5">
                    <SubHeading><CheckCircle2 className="h-4 w-4 text-emerald-500" />Daily workflow</SubHeading>
                    <div className="grid sm:grid-cols-2 gap-2">
                      {[
                        { n: '1', tip: 'Start with Dashboard — check hot leads and overdue tasks' },
                        { n: '2', tip: 'Open Activity Monitor (admin) to rebalance team workload' },
                        { n: '3', tip: 'Check Notifications for new assignments or alerts' },
                        { n: '4', tip: 'Review Inbox for unread lead emails' },
                        { n: '5', tip: 'Log every call, email, or WhatsApp on the lead the same day' },
                        { n: '6', tip: 'Schedule a follow-up immediately after any meeting or call' },
                        { n: '7', tip: 'Move leads through the pipeline after each meaningful interaction' },
                        { n: '8', tip: 'Check Reports weekly for pipeline health and velocity' },
                      ].map(({ n, tip }) => (
                        <div key={n} className="flex items-center gap-3 rounded-lg border border-border/40 bg-card px-3.5 py-2.5 text-sm">
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold shrink-0">{n}</span>
                          <span className="text-muted-foreground">{tip}</span>
                        </div>
                      ))}
                    </div>

                    <SubHeading><Search className="h-4 w-4 text-primary" />Search tips</SubHeading>
                    <BulletList items={[
                      <>The <strong className="text-foreground">search bar</strong> at the top of any page searches globally — leads, tasks, and notes.</>,
                      <>On the <strong className="text-foreground">Leads page</strong>, the search box queries company name, contact name, email, phone, and notes simultaneously.</>,
                      'Combine search with filters (status + country) to narrow results quickly.',
                    ]} />

                    <SubHeading><RefreshCw className="h-4 w-4 text-primary" />Lead score best practices</SubHeading>
                    <BulletList items={[
                      'A score of 70+ indicates a highly engaged lead — prioritise follow-up calls.',
                      'Score 30–60: regular engagement, keep nurturing with emails and WhatsApp.',
                      'Score below 30: low engagement — consider reassigning or a re-engagement campaign.',
                      'NDA Received is the strongest signal (+15 pts total) — leads here should be fast-tracked.',
                    ]} />

                    <Note>Lead scores are cumulative. A lead that's been around for months may have a high score from old activities. Always check the <strong className="text-foreground">last activity date</strong> alongside the score to judge recency.</Note>
                  </div>
                </AccordionContent>
              </AccordionItem>

            </Accordion>
          </div>

          {/* ── sidebar ── */}
          <aside className="space-y-4 lg:sticky lg:top-4 self-start">

            {/* contents */}
            <div className="rounded-xl border border-border/60 bg-card/50 overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-border/60 bg-muted/30">
                <BookOpen className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold">Contents</span>
              </div>
              <nav className="p-2 space-y-0.5">
                {SECTIONS.map(({ id, label, icon: Icon }) => (
                  <button key={id} onClick={() => { scrollTo(id); setOpenSections((p) => p.includes(id) ? p : [...p, id]); }}
                    className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all text-left group">
                    <Icon className="h-3.5 w-3.5 text-primary shrink-0" />
                    {label}
                    <ArrowRight className="h-3 w-3 ml-auto opacity-0 group-hover:opacity-60 transition-opacity" />
                  </button>
                ))}
              </nav>
            </div>

            {/* quick links */}
            <div className="rounded-xl border border-border/60 bg-card/50 overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-border/60 bg-muted/30">
                <Zap className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold">Quick links</span>
              </div>
              <div className="p-3 grid grid-cols-2 gap-1.5">
                {[
                  { label: 'Dashboard',  to: '/dashboard' },
                  { label: 'Leads',      to: '/leads' },
                  { label: 'My Tasks',   to: '/tasks' },
                  { label: 'Follow-ups', to: '/follow-ups' },
                  { label: 'Inbox',      to: '/inbox' },
                  { label: 'Pipeline',   to: '/pipeline' },
                  { label: 'Reports',    to: '/reports' },
                  { label: 'Notifications', to: '/notifications' },
                  { label: 'Admin',      to: '/admin' },
                  { label: 'Settings',   to: '/settings' },
                ].map(({ label, to }) => (
                  <Link key={to} to={to}
                    className="flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-medium text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors">
                    <ChevronRight className="h-3 w-3 text-primary shrink-0" />{label}
                  </Link>
                ))}
              </div>
            </div>

            {/* score reference */}
            <div className="rounded-xl border border-border/60 bg-card/50 overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-border/60 bg-muted/30">
                <Star className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold">Score reference</span>
              </div>
              <div className="px-4 py-2 space-y-0.5">
                {[
                  ['Meeting',   '+10'], ['Quotation', '+7'], ['NDA', '+8'],
                  ['Call',      '+6'], ['WhatsApp',  '+5'], ['LinkedIn', '+4'],
                  ['Email',     '+3'], ['Note',      '+1'], ['Task done', '+5'],
                ].map(([type, pts]) => (
                  <div key={type} className="flex items-center justify-between py-1.5 text-xs border-b border-border/30 last:border-0">
                    <span className="text-muted-foreground">{type}</span>
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{pts}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* need help */}
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">Need more help?</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                For issues not covered here, contact your admin or reach out via the email linked to your account.
              </p>
            </div>

          </aside>
        </div>
      </div>
    </AppLayout>
  );
}
