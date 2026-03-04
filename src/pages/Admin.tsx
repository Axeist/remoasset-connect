import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import {
  Plus, Edit2, Users, User, Sliders, BarChart3, Download, ExternalLink,
  Settings2, Ban, ShieldCheck, Puzzle, Check, Zap, Globe, Tag, Building2,
  Activity, MapPin, TrendingUp, ChevronRight, AlertTriangle, ListTodo,
  CalendarCheck, Layers, Database, RefreshCw, UserCheck, Key, Copy, Trash2,
  Loader2, Bell,
} from 'lucide-react';
import { ProfileCard } from '@/components/settings/ProfileCard';
import { supabase } from '@/integrations/supabase/client';
import { refreshSessionWithCooldown } from '@/lib/authRefresh';
import { EditUserRoleDialog } from '@/components/admin/EditUserRoleDialog';
import { AddUserDialog } from '@/components/admin/AddUserDialog';
import { UserManagementDialog } from '@/components/admin/UserManagementDialog';
import { StatusFormDialog } from '@/components/admin/StatusFormDialog';
import { CountryFormDialog } from '@/components/admin/CountryFormDialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useGoogleCalendar } from '@/hooks/useGoogleCalendar';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface TeamMember {
  id: string;
  user_id: string;
  role: string;
  full_name: string | null;
  email?: string | null;
  banned_until?: string | null;
  last_sign_in_at?: string | null;
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

type Tab = 'profile' | 'users' | 'configuration' | 'integrations' | 'api' | 'analytics';

interface ApiKeyRow {
  id: string;
  name: string;
  key_prefix: string;
  created_at: string;
  last_used_at: string | null;
}

const NAV_ITEMS: { id: Tab; icon: React.ElementType; label: string; desc: string }[] = [
  { id: 'profile', icon: User, label: 'Profile', desc: 'Your info & account' },
  { id: 'users', icon: Users, label: 'Users', desc: 'Team management' },
  { id: 'configuration', icon: Sliders, label: 'Configuration', desc: 'Statuses, countries & pipeline' },
  { id: 'integrations', icon: Puzzle, label: 'Integrations', desc: 'Connected services' },
  { id: 'api', icon: Key, label: 'API', desc: 'Keys & integration' },
  { id: 'analytics', icon: BarChart3, label: 'Analytics', desc: 'Reports & insights' },
];

export default function Admin() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { connectGoogleCalendar, disconnectGoogleCalendar } = useAuth();
  const { isConnected: isCalendarConnected } = useGoogleCalendar();
  const [activeTab, setActiveTab] = useState<Tab>('profile');
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [totalLeads, setTotalLeads] = useState(0);
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
    totalActivities: number;
  }>({ byStatus: [], byCountry: [], teamActivity: [], totalActivities: 0 });
  const [apiKeys, setApiKeys] = useState<ApiKeyRow[]>([]);
  const [apiKeyLoading, setApiKeyLoading] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [createKeyOpen, setCreateKeyOpen] = useState(false);
  const [createdKeyOnce, setCreatedKeyOnce] = useState<{ api_key: string; name: string; key_prefix: string } | null>(null);
  const [revokeKeyId, setRevokeKeyId] = useState<string | null>(null);

  // Slack integration state
  const [slackEnabled, setSlackEnabled] = useState(false);
  const [slackWebhookUrl, setSlackWebhookUrl] = useState('');
  const [slackSaving, setSlackSaving] = useState(false);
  const [slackTesting, setSlackTesting] = useState(false);
  const [slackDigestTesting, setSlackDigestTesting] = useState(false);
  const [slackSettingsId, setSlackSettingsId] = useState<string | null>(null);
  const [slackToggles, setSlackToggles] = useState({
    slack_notify_lead_created: true,
    slack_notify_stage_changed: true,
    slack_notify_activity_logged: true,
    slack_notify_task_created: true,
    slack_notify_task_completed: true,
    slack_notify_followup_created: true,
    slack_notify_lead_assigned: true,
    slack_notify_document_sent: true,
    slack_notify_daily_digest: false,
  });
  const [slackDigestHour, setSlackDigestHour] = useState(9);
  const [slackReminderMinutes, setSlackReminderMinutes] = useState(30);

  useEffect(() => {
    const loadSlackSettings = async () => {
      const { data } = await supabase.from('app_settings').select('id, slack_enabled, slack_webhook_url, slack_notify_lead_created, slack_notify_stage_changed, slack_notify_activity_logged, slack_notify_task_created, slack_notify_task_completed, slack_notify_followup_created, slack_notify_lead_assigned, slack_notify_document_sent, slack_notify_daily_digest, slack_digest_hour, slack_reminder_minutes_before').limit(1).single();
      if (data) {
        setSlackSettingsId(data.id);
        setSlackEnabled(data.slack_enabled ?? false);
        setSlackWebhookUrl(data.slack_webhook_url ?? '');
        setSlackToggles({
          slack_notify_lead_created: data.slack_notify_lead_created ?? true,
          slack_notify_stage_changed: data.slack_notify_stage_changed ?? true,
          slack_notify_activity_logged: data.slack_notify_activity_logged ?? true,
          slack_notify_task_created: data.slack_notify_task_created ?? true,
          slack_notify_task_completed: data.slack_notify_task_completed ?? true,
          slack_notify_followup_created: data.slack_notify_followup_created ?? true,
          slack_notify_lead_assigned: data.slack_notify_lead_assigned ?? true,
          slack_notify_document_sent: data.slack_notify_document_sent ?? true,
          slack_notify_daily_digest: data.slack_notify_daily_digest ?? false,
        });
        setSlackDigestHour(data.slack_digest_hour ?? 9);
        setSlackReminderMinutes(data.slack_reminder_minutes_before ?? 30);
      }
    };
    loadSlackSettings();
  }, []);

  const saveSlackSettings = async () => {
    setSlackSaving(true);
    const updates = {
      slack_enabled: slackEnabled,
      slack_webhook_url: slackWebhookUrl,
      ...slackToggles,
      slack_digest_hour: slackDigestHour,
      slack_reminder_minutes_before: slackReminderMinutes,
    };
    try {
      if (slackSettingsId) {
        await supabase.from('app_settings').update(updates).eq('id', slackSettingsId);
      } else {
        const { data } = await supabase.from('app_settings').insert(updates).select('id').single();
        if (data) setSlackSettingsId(data.id);
      }
      toast({ title: 'Slack settings saved' });
    } catch {
      toast({ variant: 'destructive', title: 'Failed to save Slack settings' });
    } finally {
      setSlackSaving(false);
    }
  };

  const testSlackWebhook = async () => {
    if (!slackWebhookUrl.trim()) return;
    setSlackTesting(true);
    try {
      const { error } = await supabase.functions.invoke('slack-notify', {
        body: {
          event: 'activity_logged',
          payload: {
            company_name: 'Test Lead',
            activity_type: 'note',
            description: '✅ Slack integration is working! Notifications from RemoAsset CRM are live.',
            logged_by: 'Admin',
            lead_id: 'test',
          },
        },
      });
      if (error) throw error;
      toast({ title: 'Test message sent!', description: 'Check your Slack channel.' });
    } catch {
      toast({ variant: 'destructive', title: 'Test failed', description: 'Check the webhook URL and try again.' });
    } finally {
      setSlackTesting(false);
    }
  };

  const testSlackDigest = async () => {
    if (!slackWebhookUrl.trim()) return;
    setSlackDigestTesting(true);
    try {
      const { error } = await supabase.functions.invoke('slack-digest', { body: { force: true } });
      if (error) throw error;
      toast({ title: 'Daily digest sent!', description: 'Check your Slack channel.' });
    } catch {
      toast({ variant: 'destructive', title: 'Digest test failed', description: 'Make sure the slack-digest function is deployed.' });
    } finally {
      setSlackDigestTesting(false);
    }
  };

  const fetchAuthUsers = async (): Promise<Record<string, { email?: string; banned_until?: string | null; last_sign_in_at?: string | null }>> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const body = { action: 'list_users', ...(session?.access_token ? { __auth_token: session.access_token } : {}) };
      const { data, error } = await supabase.functions.invoke('manage-user', { body, headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {} });
      if (error || !data?.users) return {};
      return (data.users as { id: string; email?: string; banned_until?: string | null; last_sign_in_at?: string | null }[]).reduce(
        (acc, u) => { acc[u.id] = { email: u.email, banned_until: u.banned_until, last_sign_in_at: u.last_sign_in_at }; return acc; },
        {} as Record<string, { email?: string; banned_until?: string | null; last_sign_in_at?: string | null }>
      );
    } catch { return {}; }
  };

  const fetchData = async () => {
    const [rolesRes, statusRes, countryRes, leadsCountRes] = await Promise.all([
      supabase.from('user_roles').select('id, user_id, role'),
      supabase.from('lead_statuses').select('*').order('sort_order'),
      supabase.from('countries').select('*').order('name'),
      supabase.from('leads').select('id', { count: 'exact', head: true }),
    ]);

    if (rolesRes.data) {
      const userIds = rolesRes.data.map((r) => r.user_id);
      const [{ data: profiles }, authUserMap] = await Promise.all([
        supabase.from('profiles').select('user_id, full_name').in('user_id', userIds),
        fetchAuthUsers(),
      ]);
      setTeamMembers(rolesRes.data.map((r) => ({
        ...r,
        full_name: profiles?.find((p) => p.user_id === r.user_id)?.full_name ?? null,
        email: authUserMap[r.user_id]?.email ?? null,
        banned_until: authUserMap[r.user_id]?.banned_until ?? null,
        last_sign_in_at: authUserMap[r.user_id]?.last_sign_in_at ?? null,
      })));
    }
    if (statusRes.data) setStatuses(statusRes.data);
    if (countryRes.data) setCountries(countryRes.data);
    if (leadsCountRes.count !== null) setTotalLeads(leadsCountRes.count);
  };

  const fetchAnalytics = async () => {
    const { data: leadsWithStatus } = await supabase.from('leads').select('status_id, lead_statuses(name, color)');
    const statusCounts: Record<string, { count: number; color: string }> = {};
    type Row = { lead_statuses: { name: string; color: string } | null };
    (leadsWithStatus ?? []).forEach((l: Row) => {
      const name = l.lead_statuses?.name ?? 'Unassigned';
      const color = l.lead_statuses?.color ?? '#6E7180';
      if (!statusCounts[name]) statusCounts[name] = { count: 0, color };
      statusCounts[name].count++;
    });
    const byStatus = Object.entries(statusCounts).map(([name, { count, color }]) => ({ name, value: count, color }));

    const { data: leadsWithCountry } = await supabase.from('leads').select('country_id, countries(code)');
    const countryCounts: Record<string, number> = {};
    (leadsWithCountry ?? []).forEach((l: { countries: { code: string } | null }) => {
      const code = l.countries?.code ?? 'Other';
      countryCounts[code] = (countryCounts[code] ?? 0) + 1;
    });
    const byCountry = Object.entries(countryCounts).map(([name, leads]) => ({ name, leads }));

    const { data: activities } = await supabase.from('lead_activities').select('user_id');
    const activityCounts: Record<string, number> = {};
    (activities ?? []).forEach((a: { user_id: string }) => {
      activityCounts[a.user_id] = (activityCounts[a.user_id] ?? 0) + 1;
    });
    const userIds = Object.keys(activityCounts);
    const { data: profiles } = await supabase.from('profiles').select('user_id, full_name').in('user_id', userIds);
    const profileMap = (profiles ?? []).reduce((acc, p) => { acc[p.user_id] = p.full_name ?? p.user_id; return acc; }, {} as Record<string, string>);
    const teamActivity = userIds.map((uid) => ({ name: profileMap[uid] ?? uid.slice(0, 8), activities: activityCounts[uid] }));
    const totalActivities = Object.values(activityCounts).reduce((s, n) => s + n, 0);

    setAnalytics({ byStatus, byCountry, teamActivity, totalActivities });
  };

  const fetchApiKeys = async () => {
    setApiKeyLoading(true);
    try {
      let { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        const { data: refData, error: refreshError } = await refreshSessionWithCooldown();
        if (refreshError?.status === 429) {
          toast({ variant: 'destructive', title: 'Too many requests', description: 'Wait a minute and try again, or sign out and sign back in.' });
          setApiKeyLoading(false);
          return;
        }
        session = refData.session;
      }
      const token = session?.access_token ?? '';
      if (!token) {
        setApiKeys([]);
        setApiKeyLoading(false);
        return;
      }
      const baseUrl = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, '') ?? '';
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';
      if (!baseUrl || !anonKey) {
        toast({ variant: 'destructive', title: 'Config missing', description: 'VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set.' });
        setApiKeyLoading(false);
        return;
      }
      const res = await fetch(`${baseUrl}/functions/v1/api-keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Apikey: anonKey, Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'list', __auth_token: token }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data?.error ?? data?.message ?? data?.hint ?? `HTTP ${res.status}`;
        throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
      }
      setApiKeys((data?.keys ?? []) as ApiKeyRow[]);
    } catch (e) {
      toast({ variant: 'destructive', title: 'Failed to load API keys', description: (e as Error)?.message });
    } finally {
      setApiKeyLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);
  useEffect(() => { fetchAnalytics(); }, [teamMembers.length, statuses.length, countries.length]);
  useEffect(() => { if (activeTab === 'api') fetchApiKeys(); }, [activeTab]);

  const handleCreateApiKey = async () => {
    const name = newKeyName.trim();
    if (!name) {
      toast({ variant: 'destructive', title: 'Name required' });
      return;
    }
    setApiKeyLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? '';
      if (!token) {
        toast({ variant: 'destructive', title: 'Session expired', description: 'Please sign in again.' });
        setApiKeyLoading(false);
        return;
      }
      const baseUrl = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, '') ?? '';
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';
      const res = await fetch(`${baseUrl}/functions/v1/api-keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Apikey: anonKey, Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name, __auth_token: token }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
      setCreatedKeyOnce({ api_key: data.api_key, name: data.name, key_prefix: data.key_prefix });
      fetchApiKeys();
    } catch (e) {
      toast({ variant: 'destructive', title: 'Failed to create API key', description: (e as Error)?.message });
    } finally {
      setApiKeyLoading(false);
    }
  };

  const handleRevokeApiKey = async () => {
    if (!revokeKeyId) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? '';
      if (!token) {
        toast({ variant: 'destructive', title: 'Session expired', description: 'Please sign in again.' });
        return;
      }
      const baseUrl = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, '') ?? '';
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';
      const res = await fetch(`${baseUrl}/functions/v1/api-keys`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Apikey: anonKey, Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id: revokeKeyId, __auth_token: token }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
      setRevokeKeyId(null);
      fetchApiKeys();
      toast({ title: 'API key revoked' });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Failed to revoke', description: (e as Error)?.message });
    }
  };

  const handleDeleteStatus = async () => {
    if (!deleteStatus) return;
    const { error } = await supabase.from('lead_statuses').delete().eq('id', deleteStatus.id);
    setDeleteStatus(null);
    if (error) { toast({ variant: 'destructive', title: 'Error', description: error.message }); return; }
    toast({ title: 'Status deleted' });
    fetchData(); fetchAnalytics();
  };

  const handleDeleteCountry = async () => {
    if (!deleteCountry) return;
    const { error } = await supabase.from('countries').delete().eq('id', deleteCountry.id);
    setDeleteCountry(null);
    if (error) { toast({ variant: 'destructive', title: 'Error', description: error.message }); return; }
    toast({ title: 'Country deleted' });
    fetchData(); fetchAnalytics();
  };

  const exportAnalytics = () => {
    const rows = [
      ['Lead status', 'Count'], ...analytics.byStatus.map((s) => [s.name, String(s.value)]),
      [], ['Country', 'Leads'], ...analytics.byCountry.map((c) => [c.name, String(c.leads)]),
      [], ['Team member', 'Activities'], ...analytics.teamActivity.map((t) => [t.name, String(t.activities)]),
    ];
    const csv = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `analytics-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Report exported' });
  };

  const markAllFollowUpsCompleted = async () => {
    const now = new Date().toISOString();
    const { error } = await supabase.from('follow_ups').update({ is_completed: true }).eq('is_completed', false).lte('scheduled_at', now);
    if (error) { toast({ variant: 'destructive', title: 'Error', description: error.message }); return; }
    toast({ title: 'Follow-ups completed', description: 'All overdue follow-ups marked as completed.' });
    fetchAnalytics();
  };

  const markAllTasksCompleted = async () => {
    const now = new Date().toISOString();
    const { error } = await supabase.from('tasks').update({ is_completed: true }).eq('is_completed', false).lte('due_date', now);
    if (error) { toast({ variant: 'destructive', title: 'Error', description: error.message }); return; }
    toast({ title: 'Tasks completed', description: 'All overdue tasks marked as completed.' });
    fetchAnalytics();
  };

  const activeCount = teamMembers.filter((m) => !m.banned_until || new Date(m.banned_until) < new Date()).length;

  const tooltipStyle = {
    backgroundColor: 'hsl(var(--popover))',
    color: 'hsl(var(--popover-foreground))',
    border: '1px solid hsl(var(--border))',
    borderRadius: '8px',
  };

  return (
    <AppLayout>
      <div className="space-y-5 animate-fade-in">
        {/* Page header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">Admin Panel</h1>
            <p className="text-muted-foreground mt-0.5 text-sm">Manage users, system configuration, and analytics</p>
          </div>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { icon: Users, label: 'Team Members', value: teamMembers.length, sub: `${activeCount} active`, color: 'text-primary', bg: 'bg-primary/10' },
            { icon: TrendingUp, label: 'Total Leads', value: totalLeads, sub: `${analytics.byStatus.length} statuses`, color: 'text-orange-500', bg: 'bg-orange-500/10' },
            { icon: MapPin, label: 'Countries', value: countries.length, sub: 'In the system', color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
            { icon: Activity, label: 'Activities', value: analytics.totalActivities, sub: 'All time', color: 'text-purple-500', bg: 'bg-purple-500/10' },
          ].map((stat) => (
            <div key={stat.label} className="rounded-xl border bg-card p-4 flex items-center gap-3">
              <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg shrink-0', stat.bg)}>
                <stat.icon className={cn('h-5 w-5', stat.color)} />
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-bold tabular-nums leading-none">{stat.value}</p>
                <p className="text-xs text-muted-foreground mt-1 truncate">{stat.label}</p>
                <p className="text-xs text-muted-foreground/60 truncate">{stat.sub}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Landscape layout: side nav + content */}
        <div className="flex rounded-xl border bg-card overflow-hidden min-h-[600px]">
          {/* Side nav */}
          <div className="w-52 border-r bg-muted/20 shrink-0 flex flex-col py-3 px-2 gap-0.5">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors group',
                  activeTab === item.id
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <item.icon className={cn('h-4 w-4 shrink-0', activeTab === item.id ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground')} />
                <div className="min-w-0">
                  <p className={cn('text-sm font-medium leading-none', activeTab === item.id ? 'text-primary' : '')}>{item.label}</p>
                  <p className="text-[11px] text-muted-foreground/70 mt-0.5 leading-none truncate">{item.desc}</p>
                </div>
              </button>
            ))}
          </div>

          {/* Content area */}
          <div className="flex-1 overflow-auto p-6">

            {/* ── PROFILE ── */}
            {activeTab === 'profile' && (
              <div className="max-w-2xl space-y-6">
                <ProfileCard />
              </div>
            )}

            {/* ── USERS ── */}
            {activeTab === 'users' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">Team Members</h2>
                    <p className="text-sm text-muted-foreground">{teamMembers.length} members · {activeCount} active</p>
                  </div>
                  <Button size="sm" className="gap-2 gradient-primary" onClick={() => setAddUserOpen(true)}>
                    <Plus className="h-4 w-4" />
                    Add user
                  </Button>
                </div>
                <div className="rounded-xl border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30 hover:bg-muted/30">
                        <TableHead>Member</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {teamMembers.map((member) => {
                        const isBanned = !!member.banned_until && new Date(member.banned_until) > new Date();
                        const initials = (member.full_name || member.email || 'U').slice(0, 2).toUpperCase();
                        return (
                          <TableRow key={member.id} className={isBanned ? 'opacity-50' : ''}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary shrink-0">
                                  {initials}
                                </div>
                                <div>
                                  <p className="font-medium text-sm">{member.full_name || 'Unknown'}</p>
                                  <p className="text-xs text-muted-foreground">{member.email || '—'}</p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={member.role === 'admin' ? 'default' : 'secondary'} className="capitalize">
                                {member.role}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {isBanned ? (
                                <Badge variant="destructive" className="gap-1"><Ban className="h-3 w-3" />Restricted</Badge>
                              ) : (
                                <Badge variant="outline" className="gap-1 border-emerald-300 text-emerald-700 dark:border-emerald-600 dark:text-emerald-400">
                                  <ShieldCheck className="h-3 w-3" />Active
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button variant="ghost" size="icon" onClick={() => setEditUser(member)} title="Edit role">
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => setManageUser(member)} title="Manage user">
                                  <Settings2 className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => navigate(`/leads?owner=${member.user_id}`)} className="gap-1 text-xs">
                                  <ExternalLink className="h-3.5 w-3.5" />Leads
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {/* ── CONFIGURATION ── */}
            {activeTab === 'configuration' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-semibold">Configuration</h2>
                  <p className="text-sm text-muted-foreground">Manage pipeline statuses, regions, and bulk actions</p>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  {/* Lead Statuses */}
                  <div className="rounded-xl border overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-b">
                      <div className="flex items-center gap-2">
                        <Tag className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium text-sm">Lead Statuses</span>
                        <Badge variant="secondary" className="text-xs ml-1">{statuses.length}</Badge>
                      </div>
                      <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => { setEditingStatus(null); setStatusFormOpen(true); }}>
                        <Plus className="h-3.5 w-3.5" />Add
                      </Button>
                    </div>
                    <div className="divide-y">
                      {statuses.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-8 text-center">No statuses yet</p>
                      ) : (
                        statuses.map((status) => (
                          <div key={status.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors group">
                            <div className="h-3 w-3 rounded-full shrink-0 ring-2 ring-white/10" style={{ backgroundColor: status.color }} />
                            <span className="text-sm flex-1 font-medium">{status.name}</span>
                            <span className="text-xs text-muted-foreground/50 font-mono">#{status.sort_order}</span>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => { setEditingStatus(status); setStatusFormOpen(true); }} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground">
                                <Edit2 className="h-3.5 w-3.5" />
                              </button>
                              <button onClick={() => setDeleteStatus(status)} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
                                <span className="text-xs font-bold leading-none">✕</span>
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Countries */}
                  <div className="rounded-xl border overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-b">
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium text-sm">Countries / Regions</span>
                        <Badge variant="secondary" className="text-xs ml-1">{countries.length}</Badge>
                      </div>
                      <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => { setEditingCountry(null); setCountryFormOpen(true); }}>
                        <Plus className="h-3.5 w-3.5" />Add
                      </Button>
                    </div>
                    <div className="divide-y max-h-80 overflow-y-auto">
                      {countries.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-8 text-center">No countries yet</p>
                      ) : (
                        countries.map((country) => (
                          <div key={country.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30 transition-colors group">
                            <span className="text-xs font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-mono w-10 text-center">{country.code}</span>
                            <span className="text-sm flex-1">{country.name}</span>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => { setEditingCountry(country); setCountryFormOpen(true); }} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground">
                                <Edit2 className="h-3.5 w-3.5" />
                              </button>
                              <button onClick={() => setDeleteCountry(country)} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
                                <span className="text-xs font-bold leading-none">✕</span>
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                {/* Pipeline settings */}
                <div className="rounded-xl border overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-3 bg-muted/30 border-b">
                    <Layers className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium text-sm">Pipeline Visualisation</span>
                  </div>
                  <div className="p-4">
                    <p className="text-xs text-muted-foreground mb-3">Current pipeline stages in order</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      {statuses.map((s, i) => (
                        <div key={s.id} className="flex items-center gap-1.5">
                          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium text-white" style={{ backgroundColor: s.color }}>
                            <span className="opacity-60">{i + 1}.</span>
                            {s.name}
                          </div>
                          {i < statuses.length - 1 && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                        </div>
                      ))}
                      {statuses.length === 0 && <p className="text-sm text-muted-foreground">No statuses configured</p>}
                    </div>
                  </div>
                </div>

                {/* Bulk actions */}
                <div className="rounded-xl border overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-3 bg-muted/30 border-b">
                    <Database className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium text-sm">Bulk Actions</span>
                    <Badge variant="outline" className="text-xs ml-1">Admin only</Badge>
                  </div>
                  <div className="p-4 grid sm:grid-cols-2 gap-3">
                    <div className="rounded-lg border p-4 space-y-2">
                      <div className="flex items-center gap-2">
                        <CalendarCheck className="h-4 w-4 text-orange-500" />
                        <span className="text-sm font-medium">Complete Overdue Follow-ups</span>
                      </div>
                      <p className="text-xs text-muted-foreground">Mark all incomplete follow-ups scheduled up to now as completed.</p>
                      <Button size="sm" variant="outline" className="gap-2 w-full mt-2" onClick={() => setCompleteFollowUpsDialog(true)}>
                        <Check className="h-3.5 w-3.5" />Run action
                      </Button>
                    </div>
                    <div className="rounded-lg border p-4 space-y-2">
                      <div className="flex items-center gap-2">
                        <ListTodo className="h-4 w-4 text-primary" />
                        <span className="text-sm font-medium">Complete Overdue Tasks</span>
                      </div>
                      <p className="text-xs text-muted-foreground">Mark all incomplete tasks with a past due date as completed.</p>
                      <Button size="sm" variant="outline" className="gap-2 w-full mt-2" onClick={() => setCompleteTasksDialog(true)}>
                        <Check className="h-3.5 w-3.5" />Run action
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── INTEGRATIONS ── */}
            {activeTab === 'integrations' && (
              <div className="space-y-4 max-w-2xl">
                <div>
                  <h2 className="text-lg font-semibold">Integrations</h2>
                  <p className="text-sm text-muted-foreground">Connect external services to enhance your workflow</p>
                </div>

                {/* Google Workspace card */}
                <div className="relative overflow-hidden rounded-xl border border-border/60">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-primary/[0.03] rounded-full -translate-y-1/3 translate-x-1/3" />
                  <div className="absolute bottom-0 left-0 w-44 h-44 bg-[#34A853]/[0.03] rounded-full translate-y-1/3 -translate-x-1/3" />
                  <div className="relative p-6">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-start gap-4">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white shadow-md ring-1 ring-black/[0.08]">
                          <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none"><path d="M18.316 5.684H5.684v12.632h12.632V5.684z" fill="#fff" /><path d="M18.316 24l5.684-5.684h-5.684V24z" fill="#EA4335" /><path d="M24 5.684V0h-5.684v5.684H24z" fill="#188038" /><path d="M18.316 18.316H24V5.684h-5.684v12.632z" fill="#34A853" /><path d="M0 18.316v5.684h5.684v-5.684H0z" fill="#4285F4" /><path d="M0 5.684h5.684V0H0v5.684z" fill="#FBBC04" /><path d="M0 18.316h5.684V5.684H0v12.632z" fill="#FBBC04" /><path d="M5.684 5.684h12.632V0H5.684v5.684z" fill="#EA4335" opacity=".25" /><path d="M8.954 16.087c-.618-.42-1.044-1.032-1.278-1.836l1.272-.522c.132.504.36.9.684 1.188.324.288.714.432 1.17.432.468 0 .864-.156 1.188-.468.324-.312.486-.702.486-1.17 0-.48-.168-.87-.504-1.176-.336-.306-.756-.456-1.26-.456h-.78v-1.254h.702c.432 0 .798-.138 1.098-.414.3-.276.45-.636.45-1.08 0-.396-.138-.72-.414-.972s-.63-.378-1.062-.378c-.42 0-.756.126-1.008.378-.252.252-.432.564-.54.936l-1.254-.522c.168-.552.492-1.026.972-1.422.48-.396 1.086-.594 1.818-.594.54 0 1.026.114 1.458.342.432.228.768.546 1.008.954.24.408.36.87.36 1.386 0 .528-.114.984-.342 1.368a2.38 2.38 0 01-.882.888v.072c.42.216.77.54 1.05.972.28.432.42.93.42 1.494 0 .564-.144 1.068-.432 1.512a3.01 3.01 0 01-1.17 1.05c-.492.258-1.044.384-1.656.384-.72 0-1.362-.21-1.98-.63zM16.17 8.646l-1.398 1.008-.696-1.056 2.466-1.776h.96V16.2h-1.332V8.646z" fill="#4285F4" /></svg>
                        </div>
                        <div>
                          <h3 className="font-semibold text-base">Google Workspace</h3>
                          <p className="text-sm text-muted-foreground mt-0.5">Calendar, Meet, and Gmail — one sign-in</p>
                        </div>
                      </div>
                      {isCalendarConnected ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#34A853]/10 px-3 py-1 text-xs font-semibold text-[#188038] ring-1 ring-[#34A853]/20 shrink-0">
                          <span className="h-1.5 w-1.5 rounded-full bg-[#34A853] animate-pulse" />Connected
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground ring-1 ring-border shrink-0">
                          <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />Not connected
                        </span>
                      )}
                    </div>

                    <div className="grid sm:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        {[
                          { color: 'var(--color-primary)', text: 'Creates calendar events for meetings' },
                          { color: '#EA4335', text: 'Auto-generates Google Meet links' },
                          { color: '#34A853', text: 'Send and read Gmail from Emails tab' },
                          { color: '#E8943A', text: 'Reply to lead threads in-app' },
                        ].map((item, i) => (
                          <div key={i} className="flex items-center gap-2.5 text-sm text-muted-foreground">
                            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md" style={{ backgroundColor: `${item.color}18` }}>
                              <Check className="h-3.5 w-3.5" style={{ color: item.color }} />
                            </div>
                            {item.text}
                          </div>
                        ))}
                      </div>
                      <div className="flex flex-col justify-center gap-2">
                        {isCalendarConnected ? (
                          <>
                            <div className="rounded-lg border border-[#34A853]/20 bg-[#34A853]/[0.04] p-3 flex items-start gap-2.5 flex-1">
                              <Zap className="h-4 w-4 text-[#188038] mt-0.5 shrink-0" />
                              <p className="text-sm text-[#188038]/80"><span className="font-medium text-[#188038]">Active.</span> All Google services are connected.</p>
                            </div>
                            <div className="flex gap-2 flex-wrap">
                              <Button variant="outline" size="sm" onClick={connectGoogleCalendar} className="gap-2 text-muted-foreground">
                                <RefreshCw className="h-4 w-4" />Reconnect
                              </Button>
                              <Button variant="outline" size="sm" onClick={disconnectGoogleCalendar} className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10">
                                Disconnect
                              </Button>
                            </div>
                          </>
                        ) : (
                          <Button onClick={connectGoogleCalendar} size="lg" className="gap-2.5 bg-primary hover:bg-primary/90 shadow-md shadow-primary/20 text-white font-medium w-fit">
                            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none"><path d="M18.316 5.684H5.684v12.632h12.632V5.684z" fill="#fff" /><path d="M18.316 24l5.684-5.684h-5.684V24z" fill="#EA4335" /><path d="M24 5.684V0h-5.684v5.684H24z" fill="#188038" /><path d="M18.316 18.316H24V5.684h-5.684v12.632z" fill="#34A853" /><path d="M0 18.316h5.684V5.684H0v12.632z" fill="#fff" opacity=".6" /><path d="M5.684 5.684h12.632V0H5.684v5.684z" fill="#EA4335" opacity=".25" /></svg>
                            Sign in with Google
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Slack integration card */}
                <div className="rounded-xl border border-border/60 overflow-hidden">
                  <div className="p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#4A154B]/10">
                          <svg className="h-5 w-5" viewBox="0 0 54 54" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M19.712.133a5.381 5.381 0 0 0-5.376 5.387 5.381 5.381 0 0 0 5.376 5.386h5.376V5.52A5.381 5.381 0 0 0 19.712.133m0 14.365H5.376A5.381 5.381 0 0 0 0 19.884a5.381 5.381 0 0 0 5.376 5.387h14.336a5.381 5.381 0 0 0 5.376-5.387 5.381 5.381 0 0 0-5.376-5.386" fill="#36C5F0"/>
                            <path d="M53.76 19.884a5.381 5.381 0 0 0-5.376-5.386 5.381 5.381 0 0 0-5.376 5.386v5.387h5.376a5.381 5.381 0 0 0 5.376-5.387m-14.336 0V5.52A5.381 5.381 0 0 0 34.048.133a5.381 5.381 0 0 0-5.376 5.387v14.364a5.381 5.381 0 0 0 5.376 5.387 5.381 5.381 0 0 0 5.376-5.387" fill="#2EB67D"/>
                            <path d="M34.048 54a5.381 5.381 0 0 0 5.376-5.387 5.381 5.381 0 0 0-5.376-5.386h-5.376v5.386A5.381 5.381 0 0 0 34.048 54m0-14.365h14.336a5.381 5.381 0 0 0 5.376-5.386 5.381 5.381 0 0 0-5.376-5.387H34.048a5.381 5.381 0 0 0-5.376 5.387 5.381 5.381 0 0 0 5.376 5.386" fill="#ECB22E"/>
                            <path d="M0 34.249a5.381 5.381 0 0 0 5.376 5.386 5.381 5.381 0 0 0 5.376-5.386v-5.387H5.376A5.381 5.381 0 0 0 0 34.249m14.336 0v14.364A5.381 5.381 0 0 0 19.712 54a5.381 5.381 0 0 0 5.376-5.387V34.249a5.381 5.381 0 0 0-5.376-5.387 5.381 5.381 0 0 0-5.376 5.387" fill="#E01E5A"/>
                          </svg>
                        </div>
                        <div>
                          <h3 className="font-semibold text-base">Slack</h3>
                          <p className="text-sm text-muted-foreground">Team notifications for leads, tasks, and reminders</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {slackEnabled && slackWebhookUrl ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-green-500/10 px-3 py-1 text-xs font-semibold text-green-700 ring-1 ring-green-500/20 shrink-0">
                            <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />Connected
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground ring-1 ring-border shrink-0">
                            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />Not connected
                          </span>
                        )}
                        <Switch checked={slackEnabled} onCheckedChange={setSlackEnabled} />
                      </div>
                    </div>

                    {slackEnabled && (
                      <div className="space-y-4 pt-2 border-t border-border/50">
                        {/* Webhook URL */}
                        <div className="space-y-1.5">
                          <Label className="text-sm">Webhook URL</Label>
                          <Input
                            type="url"
                            placeholder="https://hooks.slack.com/services/..."
                            value={slackWebhookUrl}
                            onChange={(e) => setSlackWebhookUrl(e.target.value)}
                            className="font-mono text-xs"
                          />
                          <p className="text-xs text-muted-foreground">
                            Get this from your Slack App → Incoming Webhooks.
                          </p>
                        </div>

                        {/* Per-event toggles */}
                        <div className="rounded-lg border overflow-hidden">
                          <div className="px-3 py-2 bg-muted/40 border-b">
                            <p className="text-xs font-medium flex items-center gap-1.5"><Bell className="h-3.5 w-3.5" />Notification events</p>
                          </div>
                          <div className="divide-y">
                            {([
                              { key: 'slack_notify_lead_created',    label: '🆕 New lead created' },
                              { key: 'slack_notify_stage_changed',   label: '🔀 Lead stage changed' },
                              { key: 'slack_notify_activity_logged', label: '📌 Activity logged (call, meeting, etc.)' },
                              { key: 'slack_notify_lead_assigned',   label: '👤 Lead assigned / reassigned' },
                              { key: 'slack_notify_task_created',    label: '✅ Task created' },
                              { key: 'slack_notify_task_completed',  label: '🎉 Task completed' },
                              { key: 'slack_notify_followup_created',label: '📅 Follow-up scheduled' },
                              { key: 'slack_notify_document_sent',   label: '📄 Document uploaded (NDA, quotation, etc.)' },
                            ] as { key: keyof typeof slackToggles; label: string }[]).map(({ key, label }) => (
                              <div key={key} className="flex items-center justify-between px-3 py-2 hover:bg-muted/20 transition-colors">
                                <span className="text-xs text-muted-foreground">{label}</span>
                                <Switch
                                  checked={slackToggles[key]}
                                  onCheckedChange={(v) => setSlackToggles((prev) => ({ ...prev, [key]: v }))}
                                />
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Reminders config */}
                        <div className="rounded-lg border overflow-hidden">
                          <div className="px-3 py-2 bg-muted/40 border-b">
                            <p className="text-xs font-medium flex items-center gap-1.5">⏰ Scheduled reminders</p>
                            <p className="text-xs text-muted-foreground mt-0.5">Requires deploying <code className="rounded bg-muted px-1">slack-reminders</code> function on a 15-min cron.</p>
                          </div>
                          <div className="p-3 space-y-3">
                            <div className="flex items-center gap-3">
                              <Label className="text-xs text-muted-foreground w-44 shrink-0">Remind before due (minutes)</Label>
                              <Input
                                type="number"
                                min={5}
                                max={120}
                                value={slackReminderMinutes}
                                onChange={(e) => setSlackReminderMinutes(Number(e.target.value))}
                                className="w-24 h-8 text-sm"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Daily digest config */}
                        <div className="rounded-lg border overflow-hidden">
                          <div className="flex items-center justify-between px-3 py-2 bg-muted/40 border-b">
                            <div>
                              <p className="text-xs font-medium flex items-center gap-1.5">📊 Daily digest</p>
                              <p className="text-xs text-muted-foreground mt-0.5">Morning summary: new leads, tasks due today, overdue items.</p>
                            </div>
                            <Switch
                              checked={slackToggles.slack_notify_daily_digest}
                              onCheckedChange={(v) => setSlackToggles((prev) => ({ ...prev, slack_notify_daily_digest: v }))}
                            />
                          </div>
                          {slackToggles.slack_notify_daily_digest && (
                            <div className="p-3 space-y-3">
                              <div className="flex items-center gap-3">
                                <Label className="text-xs text-muted-foreground w-44 shrink-0">Send at (UTC hour, 0–23)</Label>
                                <Input
                                  type="number"
                                  min={0}
                                  max={23}
                                  value={slackDigestHour}
                                  onChange={(e) => setSlackDigestHour(Number(e.target.value))}
                                  className="w-24 h-8 text-sm"
                                />
                              </div>
                              <p className="text-xs text-muted-foreground">Requires deploying <code className="rounded bg-muted px-1">slack-digest</code> function on an hourly cron.</p>
                              <Button size="sm" variant="outline" onClick={testSlackDigest} disabled={slackDigestTesting || !slackWebhookUrl.trim()} className="gap-2 h-7 text-xs">
                                {slackDigestTesting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
                                Send test digest now
                              </Button>
                            </div>
                          )}
                        </div>

                        <div className="flex gap-2 pt-1">
                          <Button size="sm" onClick={saveSlackSettings} disabled={slackSaving} className="gap-2">
                            {slackSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                            Save settings
                          </Button>
                          <Button size="sm" variant="outline" onClick={testSlackWebhook} disabled={slackTesting || !slackWebhookUrl.trim()} className="gap-2">
                            {slackTesting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
                            Send test message
                          </Button>
                        </div>
                      </div>
                    )}

                    {!slackEnabled && (
                      <div className="pt-2 border-t border-border/50">
                        <Button size="sm" onClick={() => setSlackEnabled(true)} variant="outline" className="gap-2">
                          <Zap className="h-3.5 w-3.5" />Configure Slack
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Other placeholder integrations */}
                {[
                  { name: 'HubSpot', desc: 'Bi-directional CRM sync for contacts and deals', soon: true },
                  { name: 'Zapier', desc: 'Connect with 5000+ apps via automation workflows', soon: true },
                ].map((int) => (
                  <div key={int.name} className="rounded-xl border p-4 flex items-center justify-between opacity-60">
                    <div>
                      <p className="text-sm font-medium">{int.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{int.desc}</p>
                    </div>
                    <Badge variant="secondary" className="text-xs shrink-0">Coming soon</Badge>
                  </div>
                ))}
              </div>
            )}

            {/* ── API ── */}
            {activeTab === 'api' && (
              <div className="space-y-6 max-w-3xl">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">API for integrations</h2>
                    <p className="text-sm text-muted-foreground">Create API keys and integrate external apps with Connect (leads, tasks, follow-ups, activities)</p>
                  </div>
                  <Button size="sm" className="gap-2 gradient-primary text-white" onClick={() => { setCreatedKeyOnce(null); setNewKeyName(''); setCreateKeyOpen(true); }}>
                    <Plus className="h-4 w-4" />Create API key
                  </Button>
                </div>

                <div className="rounded-xl border overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-3 bg-muted/30 border-b">
                    <Key className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium text-sm">Your API keys</span>
                    <Button variant="ghost" size="icon" className="h-7 w-7 ml-1" onClick={fetchApiKeys} disabled={apiKeyLoading}>
                      <RefreshCw className={cn('h-3.5 w-3.5', apiKeyLoading && 'animate-spin')} />
                    </Button>
                  </div>
                  {apiKeyLoading ? (
                    <p className="text-sm text-muted-foreground py-6 text-center">Loading…</p>
                  ) : apiKeys.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-6 text-center">No API keys yet. Create one to let external apps access the API.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/20 hover:bg-muted/20">
                          <TableHead>Name</TableHead>
                          <TableHead>Key prefix</TableHead>
                          <TableHead>Created</TableHead>
                          <TableHead>Last used</TableHead>
                          <TableHead className="w-20" />
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
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setRevokeKeyId(k.id)} title="Revoke key">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>

                <div className="rounded-xl border p-4 space-y-3">
                  <h3 className="font-medium text-sm flex items-center gap-2">
                    <Database className="h-4 w-4 text-primary" />
                    API base URL
                  </h3>
                  <p className="text-xs text-muted-foreground">Use this URL as the base for all API requests. Send your API key in the <code className="rounded bg-muted px-1 py-0.5">Authorization: Bearer &lt;api_key&gt;</code> header.</p>
                  {!import.meta.env.VITE_SUPABASE_URL?.includes('jiobase.com') && (
                    <p className="text-xs text-amber-600 dark:text-amber-500">Using direct Supabase URL. For proxy (JioBase), set VITE_SUPABASE_URL to https://remoasset.jiobase.com in Vercel and redeploy.</p>
                  )}
                  <div className="flex items-center gap-2">
                    <code className="flex-1 rounded-lg bg-muted px-3 py-2 text-sm font-mono break-all">
                      {import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, '')}/functions/v1/api
                    </code>
                    <Button variant="outline" size="icon" className="shrink-0" onClick={() => { navigator.clipboard.writeText(`${import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, '')}/functions/v1/api`); toast({ title: 'Copied' }); }}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="rounded-xl border p-4 space-y-2">
                  <h3 className="font-medium text-sm">Endpoints (Zapier & internal apps)</h3>
                  <ul className="text-xs text-muted-foreground space-y-1 font-mono">
                    <li><strong className="text-foreground">GET /leads</strong> — List (limit, offset, status_id, owner_id, search or q)</li>
                    <li><strong className="text-foreground">POST /leads</strong> · <strong className="text-foreground">GET/PATCH/DELETE /leads/:id</strong></li>
                    <li><strong className="text-foreground">PATCH /leads/bulk</strong> — Body: lead_ids[], status_id or owner_id or country_id</li>
                    <li><strong className="text-foreground">GET /tasks</strong> — List (assignee_id, lead_id, is_completed) · <strong className="text-foreground">POST /tasks</strong> · <strong className="text-foreground">PATCH/DELETE /tasks/:id</strong></li>
                    <li><strong className="text-foreground">GET /follow_ups</strong> — List (lead_id, user_id) · <strong className="text-foreground">POST /follow_ups</strong> · <strong className="text-foreground">PATCH/DELETE /follow_ups/:id</strong></li>
                    <li><strong className="text-foreground">GET /activities</strong> — List (lead_id) · <strong className="text-foreground">POST /activities</strong> · <strong className="text-foreground">PATCH/DELETE /activities/:id</strong></li>
                    <li><strong className="text-foreground">GET /documents?lead_id=</strong> · <strong className="text-foreground">POST /documents</strong> (lead_id, document_type, file_path, file_name, uploaded_by) · <strong className="text-foreground">GET/DELETE /documents/:id</strong></li>
                    <li><strong className="text-foreground">GET /notifications?user_id=</strong> · <strong className="text-foreground">POST /notifications</strong> (user_id, title, message, type, metadata)</li>
                    <li><strong className="text-foreground">GET /team</strong> — List team (user_id, role, full_name) for owner/assignee dropdowns</li>
                    <li><strong className="text-foreground">GET /statuses</strong> · <strong className="text-foreground">GET /countries</strong> · <strong className="text-foreground">GET /profiles</strong></li>
                  </ul>
                </div>
              </div>
            )}

            {/* ── ANALYTICS ── */}
            {activeTab === 'analytics' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">Analytics</h2>
                    <p className="text-sm text-muted-foreground">Lead distribution, geography, and team performance</p>
                  </div>
                  <Button variant="outline" size="sm" className="gap-2" onClick={exportAnalytics}>
                    <Download className="h-4 w-4" />Export CSV
                  </Button>
                </div>

                {/* Mini stats */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Total leads', value: totalLeads, icon: Building2, color: 'text-orange-500', bg: 'bg-orange-500/10' },
                    { label: 'Status groups', value: analytics.byStatus.length, icon: Tag, color: 'text-primary', bg: 'bg-primary/10' },
                    { label: 'Countries active', value: analytics.byCountry.length, icon: Globe, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
                  ].map((s) => (
                    <div key={s.label} className="rounded-xl border p-4 flex items-center gap-3">
                      <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg shrink-0', s.bg)}>
                        <s.icon className={cn('h-4 w-4', s.color)} />
                      </div>
                      <div>
                        <p className="text-xl font-bold leading-none">{s.value}</p>
                        <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-xl border p-4">
                    <h3 className="text-sm font-semibold mb-4">Leads by Status</h3>
                    {analytics.byStatus.length > 0 ? (
                      <ResponsiveContainer width="100%" height={220}>
                        <PieChart>
                          <Pie data={analytics.byStatus} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} innerRadius={40} paddingAngle={2}>
                            {analytics.byStatus.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                          </Pie>
                          <Tooltip contentStyle={tooltipStyle} />
                          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : <p className="text-muted-foreground text-sm py-8 text-center">No data</p>}
                  </div>
                  <div className="rounded-xl border p-4">
                    <h3 className="text-sm font-semibold mb-4">Leads by Country</h3>
                    {analytics.byCountry.length > 0 ? (
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={analytics.byCountry}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} />
                          <Tooltip contentStyle={tooltipStyle} />
                          <Bar dataKey="leads" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : <p className="text-muted-foreground text-sm py-8 text-center">No data</p>}
                  </div>
                </div>

                <div className="rounded-xl border p-4">
                  <h3 className="text-sm font-semibold mb-4">Team Activity</h3>
                  {analytics.teamActivity.length > 0 ? (
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={analytics.teamActivity} layout="vertical" margin={{ left: 90 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis type="number" tick={{ fontSize: 11 }} />
                        <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11 }} />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Bar dataKey="activities" fill="hsl(var(--accent))" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : <p className="text-muted-foreground text-sm py-8 text-center">No activity yet</p>}
                </div>
              </div>
            )}

          </div>
        </div>
      </div>

      {/* Dialogs */}
      <EditUserRoleDialog open={!!editUser} onOpenChange={(open) => !open && setEditUser(null)} userRoleId={editUser?.id ?? ''} userId={editUser?.user_id ?? ''} currentRole={editUser?.role ?? 'employee'} fullName={editUser?.full_name ?? null} onSuccess={fetchData} />
      <AddUserDialog open={addUserOpen} onOpenChange={setAddUserOpen} onSuccess={fetchData} />
      {manageUser && (
        <UserManagementDialog open={!!manageUser} onOpenChange={(open) => !open && setManageUser(null)} userId={manageUser.user_id} fullName={manageUser.full_name} role={manageUser.role} isBanned={!!manageUser.banned_until && new Date(manageUser.banned_until) > new Date()} onSuccess={fetchData} />
      )}
      <StatusFormDialog open={statusFormOpen} onOpenChange={(open) => { setStatusFormOpen(open); if (!open) setEditingStatus(null); }} status={editingStatus} onSuccess={() => { fetchData(); fetchAnalytics(); }} />
      <CountryFormDialog open={countryFormOpen} onOpenChange={(open) => { setCountryFormOpen(open); if (!open) setEditingCountry(null); }} country={editingCountry} onSuccess={() => { fetchData(); fetchAnalytics(); }} />

      <AlertDialog open={!!deleteStatus} onOpenChange={(open) => !open && setDeleteStatus(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete status?</AlertDialogTitle><AlertDialogDescription>Leads using this status may need to be updated. This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDeleteStatus} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={!!deleteCountry} onOpenChange={(open) => !open && setDeleteCountry(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete country?</AlertDialogTitle><AlertDialogDescription>Leads using this country may need to be updated. This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDeleteCountry} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={completeFollowUpsDialog} onOpenChange={setCompleteFollowUpsDialog}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Mark all follow-ups as completed?</AlertDialogTitle><AlertDialogDescription>All incomplete follow-ups scheduled up to now will be marked completed. Future ones remain unchanged.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => { markAllFollowUpsCompleted(); setCompleteFollowUpsDialog(false); }}>Complete All</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={completeTasksDialog} onOpenChange={setCompleteTasksDialog}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Mark all tasks as completed?</AlertDialogTitle><AlertDialogDescription>All incomplete tasks due up to now will be marked completed. Future tasks remain unchanged.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => { markAllTasksCompleted(); setCompleteTasksDialog(false); }}>Complete All</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={createKeyOpen} onOpenChange={(open) => { setCreateKeyOpen(open); if (!open) { setCreatedKeyOnce(null); setNewKeyName(''); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{createdKeyOnce ? 'API key created' : 'Create API key'}</DialogTitle>
          </DialogHeader>
          {createdKeyOnce ? (
            <div className="space-y-3 py-2">
              <p className="text-sm text-muted-foreground">Copy this key now. It won’t be shown again.</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded-lg bg-muted px-3 py-2 text-sm font-mono break-all">{createdKeyOnce.api_key}</code>
                <Button variant="outline" size="icon" onClick={() => { navigator.clipboard.writeText(createdKeyOnce.api_key); toast({ title: 'Copied' }); }}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <DialogFooter>
                <Button onClick={() => { setCreateKeyOpen(false); setCreatedKeyOnce(null); }}>Done</Button>
              </DialogFooter>
            </div>
          ) : (
            <>
              <div className="space-y-2 py-2">
                <Label htmlFor="api-key-name">Key name</Label>
                <Input id="api-key-name" placeholder="e.g. Production app" value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)} />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateKeyOpen(false)}>Cancel</Button>
                <Button onClick={handleCreateApiKey} disabled={apiKeyLoading}>{apiKeyLoading ? 'Creating…' : 'Create key'}</Button>
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
            <AlertDialogAction onClick={handleRevokeApiKey} className="bg-destructive text-destructive-foreground">Revoke</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
