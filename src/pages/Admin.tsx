import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plus, Edit2, Users, User, Sliders, BarChart3, Download, ExternalLink, Settings2, Ban, ShieldCheck, Puzzle, Check, Zap } from 'lucide-react';
import { ProfileCard } from '@/components/settings/ProfileCard';
import { supabase } from '@/integrations/supabase/client';
import { EditUserRoleDialog } from '@/components/admin/EditUserRoleDialog';
import { AddUserDialog } from '@/components/admin/AddUserDialog';
import { UserManagementDialog } from '@/components/admin/UserManagementDialog';
import { StatusFormDialog } from '@/components/admin/StatusFormDialog';
import { CountryFormDialog } from '@/components/admin/CountryFormDialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useGoogleCalendar } from '@/hooks/useGoogleCalendar';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface TeamMember {
  id: string;
  user_id: string;
  role: string;
  full_name: string | null;
  email?: string | null;
  banned_until?: string | null;
}

interface Status {
  id: string;
  name: string;
  color: string;
  sort_order: number;
}

interface Country {
  id: string;
  name: string;
  code: string;
}

export default function Admin() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { connectGoogleCalendar } = useAuth();
  const { isConnected: isCalendarConnected } = useGoogleCalendar();
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [editUser, setEditUser] = useState<TeamMember | null>(null);
  const [manageUser, setManageUser] = useState<TeamMember | null>(null);
  const [addUserOpen, setAddUserOpen] = useState(false);
  const [statusFormOpen, setStatusFormOpen] = useState(false);
  const [editingStatus, setEditingStatus] = useState<Status | null>(null);
  const [countryFormOpen, setCountryFormOpen] = useState(false);
  const [editingCountry, setEditingCountry] = useState<Country | null>(null);
  const [deleteStatus, setDeleteStatus] = useState<Status | null>(null);
  const [deleteCountry, setDeleteCountry] = useState<Country | null>(null);
  const [completeFollowUpsDialog, setCompleteFollowUpsDialog] = useState(false);
  const [completeTasksDialog, setCompleteTasksDialog] = useState(false);
  const [analytics, setAnalytics] = useState<{
    byStatus: { name: string; value: number; color: string }[];
    byCountry: { name: string; leads: number }[];
    teamActivity: { name: string; activities: number }[];
  }>({ byStatus: [], byCountry: [], teamActivity: [] });

  const fetchAuthUsers = async (): Promise<Record<string, { email?: string; banned_until?: string | null; last_sign_in_at?: string | null }>> => {
    try {
      const { data, error } = await supabase.functions.invoke('manage-user', {
        body: { action: 'list_users' },
      });
      if (error || !data?.users) return {};
      return (data.users as { id: string; email?: string; banned_until?: string | null; last_sign_in_at?: string | null }[]).reduce(
        (acc, u) => { acc[u.id] = { email: u.email, banned_until: u.banned_until, last_sign_in_at: u.last_sign_in_at }; return acc; },
        {} as Record<string, { email?: string; banned_until?: string | null; last_sign_in_at?: string | null }>
      );
    } catch { return {}; }
  };

  const fetchData = async () => {
    const [rolesRes, statusRes, countryRes] = await Promise.all([
      supabase.from('user_roles').select('id, user_id, role'),
      supabase.from('lead_statuses').select('*').order('sort_order'),
      supabase.from('countries').select('*').order('name'),
    ]);

    if (rolesRes.data) {
      const userIds = rolesRes.data.map((r) => r.user_id);
      const [{ data: profiles }, authUserMap] = await Promise.all([
        supabase.from('profiles').select('user_id, full_name').in('user_id', userIds),
        fetchAuthUsers(),
      ]);
      const membersWithNames = rolesRes.data.map((r) => ({
        ...r,
        full_name: profiles?.find((p) => p.user_id === r.user_id)?.full_name ?? null,
        email: authUserMap[r.user_id]?.email ?? null,
        banned_until: authUserMap[r.user_id]?.banned_until ?? null,
      }));
      setTeamMembers(membersWithNames);
    }
    if (statusRes.data) setStatuses(statusRes.data);
    if (countryRes.data) setCountries(countryRes.data);
  };

  const fetchAnalytics = async () => {
    const { data: leadsWithStatus } = await supabase
      .from('leads')
      .select('status_id, lead_statuses(name, color)');
    const statusCounts: Record<string, { count: number; color: string }> = {};
    type Row = { lead_statuses: { name: string; color: string } | null };
    (leadsWithStatus ?? []).forEach((l: Row) => {
      const name = l.lead_statuses?.name ?? 'Unassigned';
      const color = l.lead_statuses?.color ?? '#6B7280';
      if (!statusCounts[name]) statusCounts[name] = { count: 0, color };
      statusCounts[name].count++;
    });
    const byStatus = Object.entries(statusCounts).map(([name, { count, color }]) => ({ name, value: count, color }));

    const { data: leadsWithCountry } = await supabase.from('leads').select('country_id, countries(code)');
    const countryCounts: Record<string, number> = {};
    type CountryRow = { countries: { code: string } | null };
    (leadsWithCountry ?? []).forEach((l: CountryRow) => {
      const code = l.countries?.code ?? 'Other';
      countryCounts[code] = (countryCounts[code] ?? 0) + 1;
    });
    const byCountry = Object.entries(countryCounts).map(([name, leads]) => ({ name, leads }));

    const { data: activities } = await supabase
      .from('lead_activities')
      .select('user_id');
    const activityCounts: Record<string, number> = {};
    (activities ?? []).forEach((a: { user_id: string }) => {
      activityCounts[a.user_id] = (activityCounts[a.user_id] ?? 0) + 1;
    });
    const userIds = Object.keys(activityCounts);
    const { data: profiles } = await supabase.from('profiles').select('user_id, full_name').in('user_id', userIds);
    const profileMap = (profiles ?? []).reduce(
      (acc, p) => {
        acc[p.user_id] = p.full_name ?? p.user_id;
        return acc;
      },
      {} as Record<string, string>
    );
    const teamActivity = userIds.map((uid) => ({
      name: profileMap[uid] ?? uid.slice(0, 8),
      activities: activityCounts[uid],
    }));

    setAnalytics({ byStatus, byCountry, teamActivity });
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    fetchAnalytics();
  }, [teamMembers.length, statuses.length, countries.length]);

  const handleDeleteStatus = async () => {
    if (!deleteStatus) return;
    const { error } = await supabase.from('lead_statuses').delete().eq('id', deleteStatus.id);
    setDeleteStatus(null);
    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
      return;
    }
    toast({ title: 'Status deleted' });
    fetchData();
    fetchAnalytics();
  };

  const handleDeleteCountry = async () => {
    if (!deleteCountry) return;
    const { error } = await supabase.from('countries').delete().eq('id', deleteCountry.id);
    setDeleteCountry(null);
    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
      return;
    }
    toast({ title: 'Country deleted' });
    fetchData();
    fetchAnalytics();
  };

  const exportAnalytics = () => {
    const rows = [
      ['Lead status', 'Count'],
      ...analytics.byStatus.map((s) => [s.name, String(s.value)]),
      [],
      ['Country', 'Leads'],
      ...analytics.byCountry.map((c) => [c.name, String(c.leads)]),
      [],
      ['Team member', 'Activities'],
      ...analytics.teamActivity.map((t) => [t.name, String(t.activities)]),
    ];
    const csv = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Report exported' });
  };

  const markAllFollowUpsCompleted = async () => {
    try {
      const now = new Date().toISOString();
      const { error, count } = await supabase
        .from('follow_ups')
        .update({ is_completed: true })
        .eq('is_completed', false)
        .lte('scheduled_at', now);
      
      if (error) {
        toast({ variant: 'destructive', title: 'Error', description: error.message });
        return;
      }

      toast({ title: 'Follow-ups completed', description: `All follow-ups scheduled up to now have been marked as completed.` });
      fetchAnalytics();
    } catch (error) {
      toast({ 
        variant: 'destructive', 
        title: 'Error', 
        description: error instanceof Error ? error.message : 'Failed to complete follow-ups' 
      });
    }
  };

  const markAllTasksCompleted = async () => {
    try {
      const now = new Date().toISOString();
      const { error, count } = await supabase
        .from('tasks')
        .update({ is_completed: true })
        .eq('is_completed', false)
        .lte('due_date', now);
      
      if (error) {
        toast({ variant: 'destructive', title: 'Error', description: error.message });
        return;
      }

      toast({ title: 'Tasks completed', description: `All tasks due up to now have been marked as completed.` });
      fetchAnalytics();
    } catch (error) {
      toast({ 
        variant: 'destructive', 
        title: 'Error', 
        description: error instanceof Error ? error.message : 'Failed to complete tasks' 
      });
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Admin Panel</h1>
          <p className="text-muted-foreground mt-1">Manage users, settings, and system configuration</p>
        </div>

        <Tabs defaultValue="profile">
          <TabsList>
            <TabsTrigger value="profile" className="gap-2">
              <User className="h-4 w-4" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-2">
              <Users className="h-4 w-4" />
              Users
            </TabsTrigger>
            <TabsTrigger value="configuration" className="gap-2">
              <Sliders className="h-4 w-4" />
              Configuration
            </TabsTrigger>
            <TabsTrigger value="integrations" className="gap-2">
              <Puzzle className="h-4 w-4" />
              Integrations
            </TabsTrigger>
            <TabsTrigger value="analytics" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              Analytics
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="mt-6 space-y-6 max-w-2xl">
            <ProfileCard />
          </TabsContent>

          <TabsContent value="users" className="mt-6">
            <Card className="card-shadow">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Team Members</CardTitle>
                <Button size="sm" className="gap-2 gradient-primary" onClick={() => setAddUserOpen(true)}>
                  <Plus className="h-4 w-4" />
                  Add user
                </Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {teamMembers.map((member) => {
                      const isBanned = !!member.banned_until && new Date(member.banned_until) > new Date();
                      return (
                        <TableRow key={member.id} className={isBanned ? 'opacity-60' : ''}>
                          <TableCell>
                            <p className="font-medium">{member.full_name || 'Unknown'}</p>
                          </TableCell>
                          <TableCell>
                            <p className="text-sm text-muted-foreground">{member.email || '—'}</p>
                          </TableCell>
                          <TableCell>
                            <Badge variant={member.role === 'admin' ? 'default' : 'secondary'}>
                              {member.role}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {isBanned ? (
                              <Badge variant="destructive" className="gap-1">
                                <Ban className="h-3 w-3" />
                                Restricted
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="gap-1 border-green-300 text-green-700 dark:border-green-600 dark:text-green-400">
                                <ShieldCheck className="h-3 w-3" />
                                Active
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setEditUser(member)}
                                title="Edit role"
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setManageUser(member)}
                                title="Manage user"
                              >
                                <Settings2 className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => navigate(`/leads?owner=${member.user_id}`)}
                                className="gap-1"
                              >
                                <ExternalLink className="h-4 w-4" />
                                Leads
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="configuration" className="mt-6 space-y-6">
            <Card className="card-shadow">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Lead Statuses</CardTitle>
                <Button size="sm" variant="outline" className="gap-2" onClick={() => { setEditingStatus(null); setStatusFormOpen(true); }}>
                  <Plus className="h-4 w-4" />
                  Add Status
                </Button>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {statuses.map((status) => (
                    <Badge 
                      key={status.id}
                      style={{ backgroundColor: status.color }}
                      className="text-white border-0 gap-2 pr-1"
                    >
                      {status.name}
                      <button
                        className="ml-1 hover:bg-white/20 rounded p-0.5"
                        onClick={() => { setEditingStatus(status); setStatusFormOpen(true); }}
                        title="Edit"
                      >
                        <Edit2 className="h-3 w-3" />
                      </button>
                      <button
                        className="ml-1 hover:bg-white/20 rounded p-0.5"
                        onClick={() => setDeleteStatus(status)}
                        title="Delete"
                      >
                        ×
                      </button>
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="card-shadow">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Countries</CardTitle>
                <Button size="sm" variant="outline" className="gap-2" onClick={() => { setEditingCountry(null); setCountryFormOpen(true); }}>
                  <Plus className="h-4 w-4" />
                  Add Country
                </Button>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {countries.map((country) => (
                    <Badge key={country.id} variant="secondary" className="gap-2 pr-1">
                      <span className="font-bold">{country.code}</span>
                      {country.name}
                      <button
                        className="ml-1 hover:bg-muted rounded p-0.5"
                        onClick={() => { setEditingCountry(country); setCountryFormOpen(true); }}
                        title="Edit"
                      >
                        <Edit2 className="h-3 w-3" />
                      </button>
                      <button
                        className="ml-1 hover:bg-muted rounded p-0.5"
                        onClick={() => setDeleteCountry(country)}
                        title="Delete"
                      >
                        ×
                      </button>
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="integrations" className="mt-6 space-y-6">
            <div className="relative overflow-hidden rounded-2xl border border-border/60">
              <div className="absolute top-0 right-0 w-80 h-80 bg-[#4285F4]/[0.03] rounded-full -translate-y-1/3 translate-x-1/3" />
              <div className="absolute bottom-0 left-0 w-56 h-56 bg-[#34A853]/[0.03] rounded-full translate-y-1/3 -translate-x-1/3" />
              <div className="absolute top-1/2 left-1/2 w-40 h-40 bg-[#FBBC04]/[0.02] rounded-full -translate-x-1/2 -translate-y-1/2" />

              <div className="relative p-8">
                <div className="flex items-start gap-5 mb-8">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white shadow-lg ring-1 ring-black/[0.08]">
                    <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M18.316 5.684H5.684v12.632h12.632V5.684z" fill="#fff" />
                      <path d="M18.316 24l5.684-5.684h-5.684V24z" fill="#EA4335" />
                      <path d="M24 5.684V0h-5.684v5.684H24z" fill="#188038" />
                      <path d="M18.316 18.316H24V5.684h-5.684v12.632z" fill="#34A853" />
                      <path d="M0 18.316v5.684h5.684v-5.684H0z" fill="#4285F4" />
                      <path d="M0 5.684h5.684V0H0v5.684z" fill="#FBBC04" />
                      <path d="M5.684 18.316h12.632v-5.684H5.684v5.684z" fill="#4285F4" opacity=".12" />
                      <path d="M0 18.316h5.684V5.684H0v12.632z" fill="#FBBC04" />
                      <path d="M5.684 5.684h12.632V0H5.684v5.684z" fill="#EA4335" opacity=".25" />
                      <path d="M8.954 16.087c-.618-.42-1.044-1.032-1.278-1.836l1.272-.522c.132.504.36.9.684 1.188.324.288.714.432 1.17.432.468 0 .864-.156 1.188-.468.324-.312.486-.702.486-1.17 0-.48-.168-.87-.504-1.176-.336-.306-.756-.456-1.26-.456h-.78v-1.254h.702c.432 0 .798-.138 1.098-.414.3-.276.45-.636.45-1.08 0-.396-.138-.72-.414-.972s-.63-.378-1.062-.378c-.42 0-.756.126-1.008.378-.252.252-.432.564-.54.936l-1.254-.522c.168-.552.492-1.026.972-1.422.48-.396 1.086-.594 1.818-.594.54 0 1.026.114 1.458.342.432.228.768.546 1.008.954.24.408.36.87.36 1.386 0 .528-.114.984-.342 1.368a2.38 2.38 0 01-.882.888v.072c.42.216.77.54 1.05.972.28.432.42.93.42 1.494 0 .564-.144 1.068-.432 1.512a3.01 3.01 0 01-1.17 1.05c-.492.258-1.044.384-1.656.384-.72 0-1.362-.21-1.98-.63zM16.17 8.646l-1.398 1.008-.696-1.056 2.466-1.776h.96V16.2h-1.332V8.646z" fill="#4285F4" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-xl font-display font-bold text-foreground">Google Workspace</h2>
                    <p className="text-muted-foreground mt-1">
                      Calendar, Meet, and Gmail — one sign-in covers meetings, follow-ups, and lead emails.
                    </p>
                  </div>
                </div>

                <div className="grid gap-8 md:grid-cols-2">
                  <div className="space-y-5">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-muted-foreground">Connection status</span>
                      {isCalendarConnected ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#34A853]/10 px-3 py-1 text-xs font-semibold text-[#188038] ring-1 ring-[#34A853]/20">
                          <span className="h-1.5 w-1.5 rounded-full bg-[#34A853] animate-pulse" />
                          Connected
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground ring-1 ring-border">
                          <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
                          Not connected
                        </span>
                      )}
                    </div>

                    {isCalendarConnected ? (
                      <div className="rounded-xl border border-[#34A853]/20 bg-[#34A853]/[0.04] p-4 space-y-2">
                        <div className="flex items-center gap-2 text-sm font-medium text-[#188038]">
                          <Zap className="h-4 w-4" />
                          Integration active
                        </div>
                        <p className="text-sm text-[#188038]/70">
                          Calendar, Meet links, and Gmail are connected. Send emails, schedule meetings, and manage follow-ups from the app.
                        </p>
                      </div>
                    ) : (
                      <Button
                        onClick={connectGoogleCalendar}
                        size="lg"
                        className="gap-2.5 bg-[#4285F4] hover:bg-[#3367D6] shadow-md shadow-[#4285F4]/20 text-white font-medium"
                      >
                        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none">
                          <path d="M18.316 5.684H5.684v12.632h12.632V5.684z" fill="#fff" />
                          <path d="M18.316 24l5.684-5.684h-5.684V24z" fill="#EA4335" />
                          <path d="M24 5.684V0h-5.684v5.684H24z" fill="#188038" />
                          <path d="M18.316 18.316H24V5.684h-5.684v12.632z" fill="#34A853" />
                          <path d="M0 18.316v5.684h5.684v-5.684H0z" fill="#fff" />
                          <path d="M0 5.684h5.684V0H0v5.684z" fill="#FBBC04" />
                          <path d="M0 18.316h5.684V5.684H0v12.632z" fill="#fff" opacity=".6" />
                          <path d="M5.684 5.684h12.632V0H5.684v5.684z" fill="#EA4335" opacity=".25" />
                        </svg>
                        Sign in with Google
                      </Button>
                    )}

                    {isCalendarConnected && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={connectGoogleCalendar}
                        className="gap-2 text-muted-foreground"
                      >
                        <ExternalLink className="h-4 w-4" />
                        Reconnect
                      </Button>
                    )}
                  </div>

                  <div className="space-y-3">
                    <p className="text-sm font-medium text-foreground">Capabilities</p>
                    <div className="space-y-3">
                      {[
                        { color: '#4285F4', text: 'Creates calendar events for meetings' },
                        { color: '#EA4335', text: 'Auto-generates Google Meet links' },
                        { color: '#34A853', text: 'Send and read Gmail from the Emails tab' },
                        { color: '#FBBC04', text: 'Reply to lead email threads in-app' },
                      ].map((item, i) => (
                        <div key={i} className="flex items-center gap-3 text-sm text-muted-foreground">
                          <div
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                            style={{ backgroundColor: `${item.color}10` }}
                          >
                            <Check className="h-4 w-4" style={{ color: item.color }} />
                          </div>
                          {item.text}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="analytics" className="mt-6 space-y-6">
            <div className="flex justify-between items-start gap-4 flex-wrap">
              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" size="sm" className="gap-2" onClick={exportAnalytics}>
                  <Download className="h-4 w-4" />
                  Export report
                </Button>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="gap-2" 
                  onClick={() => setCompleteFollowUpsDialog(true)}
                >
                  <Check className="h-4 w-4" />
                  Complete all follow-ups
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="gap-2" 
                  onClick={() => setCompleteTasksDialog(true)}
                >
                  <Check className="h-4 w-4" />
                  Complete all tasks
                </Button>
              </div>
            </div>
            <div className="grid gap-6 md:grid-cols-2">
              <Card className="card-shadow">
                <CardHeader>
                  <CardTitle>Leads by status</CardTitle>
                </CardHeader>
                <CardContent>
                  {analytics.byStatus.length > 0 ? (
                    <ResponsiveContainer width="100%" height={240}>
                      <PieChart>
                        <Pie
                          data={analytics.byStatus}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          label
                        >
                          {analytics.byStatus.map((entry, i) => (
                            <Cell key={i} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--popover))', color: 'hsl(var(--popover-foreground))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} labelStyle={{ color: 'hsl(var(--popover-foreground))' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-muted-foreground text-sm py-8 text-center">No data</p>
                  )}
                </CardContent>
              </Card>
              <Card className="card-shadow">
                <CardHeader>
                  <CardTitle>Leads by country</CardTitle>
                </CardHeader>
                <CardContent>
                  {analytics.byCountry.length > 0 ? (
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={analytics.byCountry}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--popover))', color: 'hsl(var(--popover-foreground))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} labelStyle={{ color: 'hsl(var(--popover-foreground))' }} />
                        <Bar dataKey="leads" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-muted-foreground text-sm py-8 text-center">No data</p>
                  )}
                </CardContent>
              </Card>
            </div>
            <Card className="card-shadow">
              <CardHeader>
                <CardTitle>Team activity (lead activities count)</CardTitle>
              </CardHeader>
              <CardContent>
                {analytics.teamActivity.length > 0 ? (
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={analytics.teamActivity} layout="vertical" margin={{ left: 80 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis type="category" dataKey="name" width={80} />
                      <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--popover))', color: 'hsl(var(--popover-foreground))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} labelStyle={{ color: 'hsl(var(--popover-foreground))' }} />
                      <Bar dataKey="activities" fill="hsl(var(--accent))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-muted-foreground text-sm py-8 text-center">No activity yet</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <EditUserRoleDialog
          open={!!editUser}
          onOpenChange={(open) => !open && setEditUser(null)}
          userRoleId={editUser?.id ?? ''}
          userId={editUser?.user_id ?? ''}
          currentRole={editUser?.role ?? 'employee'}
          fullName={editUser?.full_name ?? null}
          onSuccess={fetchData}
        />
        <AddUserDialog open={addUserOpen} onOpenChange={setAddUserOpen} onSuccess={fetchData} />
        {manageUser && (
          <UserManagementDialog
            open={!!manageUser}
            onOpenChange={(open) => !open && setManageUser(null)}
            userId={manageUser.user_id}
            fullName={manageUser.full_name}
            role={manageUser.role}
            isBanned={!!manageUser.banned_until && new Date(manageUser.banned_until) > new Date()}
            onSuccess={fetchData}
          />
        )}
        <StatusFormDialog
          open={statusFormOpen}
          onOpenChange={(open) => { setStatusFormOpen(open); if (!open) setEditingStatus(null); }}
          status={editingStatus}
          onSuccess={() => { fetchData(); fetchAnalytics(); }}
        />
        <CountryFormDialog
          open={countryFormOpen}
          onOpenChange={(open) => { setCountryFormOpen(open); if (!open) setEditingCountry(null); }}
          country={editingCountry}
          onSuccess={() => { fetchData(); fetchAnalytics(); }}
        />
        <AlertDialog open={!!deleteStatus} onOpenChange={(open) => !open && setDeleteStatus(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete status?</AlertDialogTitle>
              <AlertDialogDescription>
                Leads using this status may need to be updated. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteStatus} className="bg-destructive text-destructive-foreground">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <AlertDialog open={!!deleteCountry} onOpenChange={(open) => !open && setDeleteCountry(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete country?</AlertDialogTitle>
              <AlertDialogDescription>
                Leads using this country may need to be updated. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteCountry} className="bg-destructive text-destructive-foreground">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <AlertDialog open={completeFollowUpsDialog} onOpenChange={setCompleteFollowUpsDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Mark all follow-ups as completed?</AlertDialogTitle>
              <AlertDialogDescription>
                This will mark all incomplete follow-ups scheduled up to now as completed. Future follow-ups will remain unchanged.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction 
                onClick={() => {
                  markAllFollowUpsCompleted();
                  setCompleteFollowUpsDialog(false);
                }}
              >
                Complete All
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <AlertDialog open={completeTasksDialog} onOpenChange={setCompleteTasksDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Mark all tasks as completed?</AlertDialogTitle>
              <AlertDialogDescription>
                This will mark all incomplete tasks with a due date up to now as completed. Future tasks will remain unchanged.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction 
                onClick={() => {
                  markAllTasksCompleted();
                  setCompleteTasksDialog(false);
                }}
              >
                Complete All
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
}
