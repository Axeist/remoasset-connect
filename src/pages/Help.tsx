import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { HelpCircle, FileUp, Shield, LayoutDashboard, Users, CheckSquare, Bell } from 'lucide-react';

export default function Help() {
  return (
    <AppLayout>
      <div className="space-y-8 max-w-3xl">
        <div className="animate-fade-in-up">
          <h1 className="text-2xl font-display font-bold text-foreground tracking-tight flex items-center gap-2">
            <HelpCircle className="h-8 w-8" />
            Help
          </h1>
          <p className="text-muted-foreground mt-1.5">Getting started and common tasks</p>
        </div>

        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="getting-started">
            <AccordionTrigger className="flex items-center gap-2">
              <LayoutDashboard className="h-4 w-4" />
              Getting started
            </AccordionTrigger>
            <AccordionContent>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                <li><strong className="text-foreground">Dashboard</strong> — Overview of your leads, tasks, and follow-ups. Admins see team-wide metrics.</li>
                <li><strong className="text-foreground">Leads</strong> — Add leads manually, import from CSV, or filter and export. Open a lead to log activities, tasks, and follow-ups.</li>
                <li><strong className="text-foreground">My Tasks</strong> — Tasks assigned to you. Filter by due date, priority, or linked lead. Switch between list and Kanban view.</li>
                <li><strong className="text-foreground">Follow-ups</strong> — Central list of your scheduled follow-ups with links to the lead.</li>
                <li><strong className="text-foreground">Settings</strong> — Update your profile (name, designation, phone, avatar URL).</li>
              </ul>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="import">
            <AccordionTrigger className="flex items-center gap-2">
              <FileUp className="h-4 w-4" />
              Importing leads from CSV
            </AccordionTrigger>
            <AccordionContent>
              <p className="text-sm text-muted-foreground mb-2">
                Use <strong className="text-foreground">Leads → Import</strong> to upload a CSV. Required column: <strong>company name</strong> (or Vendor Name). Optional: country, website, email, phone, contact name, designation, status, lead score, lead owner, notes.
              </p>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                <li>Country and status must match entries in <strong className="text-foreground">Admin → Settings</strong> (add them there first if needed).</li>
                <li>Lead owner: use the exact full name from Admin → Users. If empty, the lead is assigned to you.</li>
                <li>Download the sample CSV from the Import dialog to see the expected format.</li>
              </ul>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="admin">
            <AccordionTrigger className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Admin setup
            </AccordionTrigger>
            <AccordionContent>
              <p className="text-sm text-muted-foreground mb-2">
                The first admin is created via a one-time script. In project root, add <code className="bg-muted px-1 rounded">SUPABASE_SERVICE_ROLE_KEY</code> to <code className="bg-muted px-1 rounded">.env</code>, then run:
              </p>
              <pre className="bg-muted p-3 rounded-md text-sm overflow-x-auto">npm run create-admin</pre>
              <p className="text-sm text-muted-foreground mt-2">
                To let admins add more users from the app, deploy the <code className="bg-muted px-1 rounded">create-user</code> Edge Function and set the service role secret. See <code className="bg-muted px-1 rounded">docs/ADMIN_SETUP.md</code> for details.
              </p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="notifications">
            <AccordionTrigger className="flex items-center gap-2">
              <Bell className="h-4 w-4" />
              Notifications
            </AccordionTrigger>
            <AccordionContent>
              <p className="text-sm text-muted-foreground">
                You get notified when a lead is assigned to you. Open the bell icon in the header to see recent notifications, or go to <strong className="text-foreground">Notifications</strong> in the sidebar for the full list. Mark items as read or mark all as read.
              </p>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <Card className="card-shadow">
          <CardHeader>
            <CardTitle className="text-base">Quick links</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <a href="/leads" className="text-sm text-primary hover:underline">Leads</a>
            <span className="text-muted-foreground">·</span>
            <a href="/tasks" className="text-sm text-primary hover:underline">My Tasks</a>
            <span className="text-muted-foreground">·</span>
            <a href="/follow-ups" className="text-sm text-primary hover:underline">Follow-ups</a>
            <span className="text-muted-foreground">·</span>
            <a href="/reports" className="text-sm text-primary hover:underline">Reports</a>
            <span className="text-muted-foreground">·</span>
            <a href="/settings" className="text-sm text-primary hover:underline">Settings</a>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
