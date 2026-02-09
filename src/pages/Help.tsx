import { Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import {
  HelpCircle,
  FileUp,
  Shield,
  LayoutDashboard,
  Users,
  CheckSquare,
  Bell,
  BarChart3,
  Globe2,
  Activity,
  BookOpen,
  Zap,
  AlertCircle,
  ChevronRight,
} from 'lucide-react';

export default function Help() {
  return (
    <AppLayout>
      <div className="w-full min-h-[calc(100vh-4rem)]">
        {/* Header - full width */}
        <div className="animate-fade-in-up mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <HelpCircle className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-display font-bold text-foreground tracking-tight">
                Help & Documentation
              </h1>
              <p className="text-muted-foreground text-sm mt-0.5">
                Complete guide to Vendor Resource Management (VRM)
              </p>
            </div>
          </div>
          <p className="text-muted-foreground text-sm leading-relaxed max-w-3xl">
            This guide covers every feature of the platform: managing leads, tracking activities, running reports, and administrative controls. Use the sections below to find step-by-step instructions and best practices.
          </p>
        </div>

        {/* Two-column layout: main content + sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8 lg:gap-10">
          {/* Main content - accordion */}
          <div className="min-w-0">

        <Accordion type="single" collapsible className="w-full space-y-2" defaultValue={['getting-started']}>
          <AccordionItem value="getting-started" id="getting-started" className="border rounded-xl px-4 bg-card/50">
            <AccordionTrigger className="hover:no-underline py-5">
              <span className="flex items-center gap-3 text-left">
                <LayoutDashboard className="h-5 w-5 text-primary shrink-0" />
                <span className="font-semibold">Getting started & navigation</span>
              </span>
            </AccordionTrigger>
            <AccordionContent className="pb-5 text-sm text-muted-foreground space-y-4">
              <p>
                The sidebar gives you access to all main areas. Your role (Admin or Employee) determines which items you see. Below is what each section does and how to use it effectively.
              </p>
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium text-foreground mb-1 flex items-center gap-2">
                    <LayoutDashboard className="h-4 w-4" />
                    Dashboard
                  </h4>
                  <p className="mb-2">
                    Your home view: KPIs (total leads, conversion rate, hot leads, tasks due), lead status and country charts, recent activity, and quick access to leads. Admins see team-wide metrics and top performers; employees see their own pipeline and upcoming tasks/follow-ups. The <strong className="text-foreground">World Demographics</strong> map shows lead distribution by country with zoom controls and a scrollable list of all countries.
                  </p>
                  <p className="text-xs text-muted-foreground/90">
                    <strong>Tip:</strong> Use the dashboard to prioritize: focus on hot leads and overdue tasks first.
                  </p>
                </div>
                <div>
                  <h4 className="font-medium text-foreground mb-1 flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Leads
                  </h4>
                  <p className="mb-2">
                    Central place for all leads. Add leads manually (required: company name, website, email, country, status, vendor types (one or more), notes; optional: phone, contact name, designation). Use filters (search, status, country, vendor type, warehouse, owner, score range) and choose how many rows per page. Open a lead to view or edit details, log activities (call, email, meeting, note), add tasks and follow-ups, upload documents, and see the full activity log with lead score points (+6 for calls, +3 for email, etc.). Admins can delete individual leads or use bulk actions (e.g. change owner); bulk changes are recorded in the activity feed.
                  </p>
                  <p className="text-xs text-muted-foreground/90">
                    <strong>Lead score:</strong> Each activity and task/follow-up contributes points (e.g. Call +6, Email +3, Meeting +5). These are shown on the right of each activity and in the Tasks/Follow-ups tabs.
                  </p>
                </div>
                <div>
                  <h4 className="font-medium text-foreground mb-1 flex items-center gap-2">
                    <CheckSquare className="h-4 w-4" />
                    My Tasks
                  </h4>
                  <p>
                    Tasks assigned to you. Filter by status (upcoming, overdue, completed) and view by list or Kanban. Each task can be linked to a lead; open the lead from the task for context. Overdue tasks are highlighted. Admins see all team tasks with assignee names.
                  </p>
                </div>
                <div>
                  <h4 className="font-medium text-foreground mb-1 flex items-center gap-2">
                    <Activity className="h-4 w-4" />
                    Activity Monitor <Badge variant="secondary" className="text-xs ml-1">Admin</Badge>
                  </h4>
                  <p>
                    Admin-only view of all team tasks and follow-ups in one place. Filter by status, employee, and priority. Overdue items are clearly marked; use it to balance workload and ensure nothing is missed.
                  </p>
                </div>
                <div>
                  <h4 className="font-medium text-foreground mb-1 flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    Reports
                  </h4>
                  <p>
                    Analytics and productivity metrics: leads by status and country, weekly/monthly/yearly productivity charts with time-range and year filters, activity trends, and (for admins) employee productivity scorecard, top performers, and lead velocity. Export data to CSV from the Reports page.
                  </p>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="leads" id="leads" className="border rounded-xl px-4 bg-card/50">
            <AccordionTrigger className="hover:no-underline py-5">
              <span className="flex items-center gap-3 text-left">
                <Users className="h-5 w-5 text-primary shrink-0" />
                <span className="font-semibold">Leads management</span>
              </span>
            </AccordionTrigger>
            <AccordionContent className="pb-5 text-sm text-muted-foreground space-y-4">
              <h4 className="font-medium text-foreground">Adding and editing leads</h4>
              <p>
                Use <strong className="text-foreground">Add lead</strong> to create a new lead. Required fields: Company name, Website, Email, Country, Status, Vendor types — select one or more: New Device, Refurbished, Rental (e.g. both New Device and Refurbished), and Notes. Optional: Phone, Contact name, Designation. If <strong className="text-foreground">Warehouse available</strong> is turned on, you can add Warehouse location, notes, price, and currency. All edits are logged in the lead’s Activity tab with the fields that changed.
              </p>
              <h4 className="font-medium text-foreground mt-4">Lead detail tabs</h4>
              <ul className="list-disc list-inside space-y-1">
                <li><strong className="text-foreground">Overview</strong> — Company info, contact, country, status, vendor types, warehouse details (if any).</li>
                <li><strong className="text-foreground">Activity</strong> — Full log of calls, emails, meetings, notes, and system events (e.g. lead updated, task created). Each row shows the lead score impact (e.g. +6, +3). Filter by type and add new activities.</li>
                <li><strong className="text-foreground">Tasks</strong> — Tasks linked to this lead. Pending tasks show +3, completed +5. Create tasks from the lead or link existing ones from My Tasks.</li>
                <li><strong className="text-foreground">Follow-ups</strong> — Scheduled follow-ups. Scheduled items show +2, completed +5. Mark done from here or from the Follow-ups page.</li>
                <li><strong className="text-foreground">Documents</strong> — Upload files or links (e.g. NDA, proposal). Choose document type and optional custom name.</li>
                <li><strong className="text-foreground">Notes</strong> — Free-form notes for the lead.</li>
              </ul>
              <h4 className="font-medium text-foreground mt-4">Bulk actions (Admin)</h4>
              <p>
                Select multiple leads and use <strong className="text-foreground">Bulk actions</strong> to change owner. The new owner and the change are recorded in each lead’s activity feed. Admins can also delete a single lead from its detail page or use the bulk delete option on the Leads list.
              </p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="import" id="import" className="border rounded-xl px-4 bg-card/50">
            <AccordionTrigger className="hover:no-underline py-5">
              <span className="flex items-center gap-3 text-left">
                <FileUp className="h-5 w-5 text-primary shrink-0" />
                <span className="font-semibold">CSV import & export</span>
              </span>
            </AccordionTrigger>
            <AccordionContent className="pb-5 text-sm text-muted-foreground space-y-4">
              <h4 className="font-medium text-foreground">Importing leads</h4>
              <p>
                Go to <strong className="text-foreground">Leads → Import</strong>. Your CSV must include a column for <strong className="text-foreground">company name</strong> (or Vendor Name). Supported optional columns: country, website, email, phone, contact name, designation, status, lead score, lead owner, notes. Headers can vary (e.g. &quot;Company name&quot;, &quot;Vendor Name&quot;) as long as the mapping is correct in the import dialog.
              </p>
              <ul className="list-disc list-inside space-y-1">
                <li><strong className="text-foreground">Country and status</strong> — Values must match existing countries and statuses in the system. Add new ones under Admin Panel → Settings (or equivalent) before importing.</li>
                <li><strong className="text-foreground">Lead owner</strong> — Use the exact full name of the user as shown in Admin → Users. If left blank, the importing user is set as owner.</li>
                <li>Use the <strong className="text-foreground">Download sample CSV</strong> option in the Import dialog to get the correct format and column names.</li>
              </ul>
              <h4 className="font-medium text-foreground mt-4">Export & sample data (Admin)</h4>
              <p>
                From <strong className="text-foreground">Reports</strong>, use <strong className="text-foreground">Export Report</strong> to download productivity and lead data as CSV. In the <strong className="text-foreground">Admin Panel → Analytics</strong>, admins can generate sample lead CSVs (e.g. 100 leads per user) with simulated activity logs, and generate sample follow-ups and tasks for testing. Bulk delete of all follow-ups or all tasks is also available there for admins.
              </p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="tasks-followups" id="tasks-followups" className="border rounded-xl px-4 bg-card/50">
            <AccordionTrigger className="hover:no-underline py-5">
              <span className="flex items-center gap-3 text-left">
                <CheckSquare className="h-5 w-5 text-primary shrink-0" />
                <span className="font-semibold">Tasks & follow-ups</span>
              </span>
            </AccordionTrigger>
            <AccordionContent className="pb-5 text-sm text-muted-foreground space-y-4">
              <h4 className="font-medium text-foreground">Tasks</h4>
              <p>
                Create tasks from <strong className="text-foreground">My Tasks</strong> or from a lead’s Tasks tab. Set title, description, due date, priority (low / medium / high / urgent), and optionally link to a lead. Completing or reopening a task logs an activity on the lead (if linked) and contributes to lead score (+5 when completed, +3 for creation). Overdue tasks are highlighted; admins can see all team tasks and assignees.
              </p>
              <h4 className="font-medium text-foreground mt-4">Follow-ups</h4>
              <p>
                Schedule follow-ups from a lead’s Follow-ups tab or from the main Follow-ups page. Set date/time, reminder type (one-time or recurring), and notes. Mark as done when completed; this logs an activity and adds +5 to lead score. Scheduled follow-ups show +2. Admins see all team follow-ups with assignee and overdue badges.
              </p>
              <p className="text-xs text-muted-foreground/90 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>Use the Activity Monitor (Admin) to get a single view of all tasks and follow-ups across the team and to spot overdue items quickly.</span>
              </p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="reports" id="reports" className="border rounded-xl px-4 bg-card/50">
            <AccordionTrigger className="hover:no-underline py-5">
              <span className="flex items-center gap-3 text-left">
                <BarChart3 className="h-5 w-5 text-primary shrink-0" />
                <span className="font-semibold">Reports & analytics</span>
              </span>
            </AccordionTrigger>
            <AccordionContent className="pb-5 text-sm text-muted-foreground space-y-4">
              <p>
                The Reports page provides productivity and pipeline analytics for both admins and employees, with export to CSV.
              </p>
              <h4 className="font-medium text-foreground">Metrics and charts</h4>
              <ul className="list-disc list-inside space-y-1">
                <li><strong className="text-foreground">Productivity KPIs</strong> — Average response time, follow-up completion rate, task completion rate, daily activity average, leads per day, activities per lead.</li>
                <li><strong className="text-foreground">Productivity overview chart</strong> — Filter by Hourly, Weekly, Monthly, or Yearly; use the year selector for monthly/yearly. Shows activities, tasks, and follow-ups over time.</li>
                <li><strong className="text-foreground">Leads by status & by country</strong> — Distribution of your pipeline.</li>
                <li><strong className="text-foreground">Activity time distribution</strong> — When activity happens during the day.</li>
              </ul>
              <h4 className="font-medium text-foreground mt-4">Admin-only</h4>
              <p>
                Lead velocity by stage, employee productivity scorecard (response time, follow-up rate, task rate, efficiency), activity trends (14 days), and top performers table. Use <strong className="text-foreground">Export Report</strong> to download all metrics and country/team data as CSV.
              </p>
              <h4 className="font-medium text-foreground mt-4">Dashboard demographics</h4>
              <p>
                The <strong className="text-foreground">World Demographics</strong> map on the Dashboard shows lead distribution by country with color intensity. Use zoom in/out and reset view; the list below shows all countries with leads and status breakdown. Scroll the list to see every country in the database.
              </p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="admin" id="admin" className="border rounded-xl px-4 bg-card/50">
            <AccordionTrigger className="hover:no-underline py-5">
              <span className="flex items-center gap-3 text-left">
                <Shield className="h-5 w-5 text-primary shrink-0" />
                <span className="font-semibold">Admin panel</span>
                <Badge variant="secondary" className="text-xs">Admin only</Badge>
              </span>
            </AccordionTrigger>
            <AccordionContent className="pb-5 text-sm text-muted-foreground space-y-4">
              <h4 className="font-medium text-foreground">User management</h4>
              <p>
                Add new users (admin or employee) from the Admin Panel. The app uses a <strong className="text-foreground">create-user</strong> Edge Function: ensure it is deployed and that the required Supabase secrets (e.g. service role) are set. The first admin can be created via a one-time script: in the project root, add <code className="bg-muted px-1.5 py-0.5 rounded text-xs">SUPABASE_SERVICE_ROLE_KEY</code> to <code className="bg-muted px-1.5 py-0.5 rounded text-xs">.env</code>, then run <code className="bg-muted px-1.5 py-0.5 rounded text-xs">npm run create-admin</code>. See <code className="bg-muted px-1.5 py-0.5 rounded text-xs">docs/ADMIN_SETUP.md</code> for full details.
              </p>
              <h4 className="font-medium text-foreground mt-4">Analytics & sample data</h4>
              <p>
                Under Analytics, admins can generate sample leads (CSV) for specific users, generate sample follow-ups and tasks for existing leads, and bulk delete all follow-ups or all tasks. Use these for demos or testing; bulk delete is irreversible.
              </p>
              <h4 className="font-medium text-foreground mt-4">Activity Monitor</h4>
              <p>
                Available in the sidebar for admins only. Shows all team tasks and follow-ups with filters (status, employee, priority), overdue highlighting, and links to leads. Use it to monitor workload and follow-up compliance.
              </p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="notifications" id="notifications" className="border rounded-xl px-4 bg-card/50">
            <AccordionTrigger className="hover:no-underline py-5">
              <span className="flex items-center gap-3 text-left">
                <Bell className="h-5 w-5 text-primary shrink-0" />
                <span className="font-semibold">Notifications</span>
              </span>
            </AccordionTrigger>
            <AccordionContent className="pb-5 text-sm text-muted-foreground">
              <p>
                You receive in-app notifications when a lead is assigned to you and for other configured events. Open the <strong className="text-foreground">bell icon</strong> in the header for a quick list, or go to <strong className="text-foreground">Notifications</strong> in the sidebar for the full history. Mark individual items as read or use &quot;Mark all as read&quot; to clear the list. Notifications help you stay on top of new assignments and follow-ups without leaving the app.
              </p>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
          </div>

          {/* Sidebar - Contents & Quick links */}
          <aside className="space-y-6 lg:sticky lg:top-24 self-start">
            <Card className="card-shadow rounded-xl border-border/80">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <BookOpen className="h-4 w-4" />
                  Contents
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2">
                <a href="#getting-started" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors py-1">
                  <ChevronRight className="h-4 w-4 shrink-0" />
                  Getting started & navigation
                </a>
                <a href="#leads" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors py-1">
                  <ChevronRight className="h-4 w-4 shrink-0" />
                  Leads management
                </a>
                <a href="#import" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors py-1">
                  <ChevronRight className="h-4 w-4 shrink-0" />
                  CSV import & export
                </a>
                <a href="#tasks-followups" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors py-1">
                  <ChevronRight className="h-4 w-4 shrink-0" />
                  Tasks & follow-ups
                </a>
                <a href="#reports" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors py-1">
                  <ChevronRight className="h-4 w-4 shrink-0" />
                  Reports & analytics
                </a>
                <a href="#admin" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors py-1">
                  <ChevronRight className="h-4 w-4 shrink-0" />
                  Admin panel
                </a>
                <a href="#notifications" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors py-1">
                  <ChevronRight className="h-4 w-4 shrink-0" />
                  Notifications
                </a>
                <a href="#quick-links" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors py-1">
                  <ChevronRight className="h-4 w-4 shrink-0" />
                  Quick links
                </a>
              </CardContent>
            </Card>
            <Card id="quick-links" className="card-shadow rounded-xl border-border/80">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  Quick links
                </CardTitle>
                <CardDescription>Jump to the main sections of the application</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-x-3 gap-y-2 text-sm">
                  <Link to="/dashboard" className="text-primary hover:underline font-medium">Dashboard</Link>
                  <Link to="/leads" className="text-primary hover:underline font-medium">Leads</Link>
                  <Link to="/tasks" className="text-primary hover:underline font-medium">My Tasks</Link>
                  <Link to="/follow-ups" className="text-primary hover:underline font-medium">Follow-ups</Link>
                  <Link to="/admin/team-activity" className="text-primary hover:underline font-medium">Activity</Link>
                  <Link to="/reports" className="text-primary hover:underline font-medium">Reports</Link>
                  <Link to="/notifications" className="text-primary hover:underline font-medium">Notifications</Link>
                  <Link to="/settings" className="text-primary hover:underline font-medium">Settings</Link>
                  <Link to="/admin" className="text-primary hover:underline font-medium">Admin</Link>
                </div>
                <div className="rounded-lg border border-border/60 bg-muted/20 p-4 text-sm">
                  <h4 className="font-medium text-foreground mb-2 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    Best practices
                  </h4>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                    <li>Log every call, email, and meeting on the lead so the activity feed and lead score stay accurate.</li>
                    <li>Use filters on the Leads page to focus on a status, owner, or vendor type instead of scrolling.</li>
                    <li>Schedule follow-ups right after a call or meeting so you don’t lose track of next steps.</li>
                    <li>Check the Activity Monitor (admins) and Reports regularly to spot overdue items and trends.</li>
                    <li>Export reports periodically for your own records or for sharing with stakeholders.</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>
    </AppLayout>
  );
}
