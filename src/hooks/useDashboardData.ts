import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';

export interface DashboardKpis {
  totalLeads: number;
  conversionRate: string;
  hotLeads: number;
  tasksDue: number;
  followUps?: number;
}

export interface StatusChartItem {
  name: string;
  value: number;
  color: string;
}

export interface CountryChartItem {
  name: string;
  leads: number;
}

export interface ActivityChartItem {
  name: string;
  calls: number;
  emails: number;
  meetings: number;
}

export interface RecentActivityItem {
  id: string;
  type: string;
  description: string;
  user: string;
  time: string;
  leadName?: string;
  leadId?: string;
}

export interface UpcomingTaskItem {
  id: string;
  title: string;
  due_date: string | null;
  priority: string;
}

export interface UpcomingFollowUpItem {
  id: string;
  scheduled_at: string;
  notes: string | null;
}

export interface HotLeadItem {
  id: string;
  company_name: string;
  lead_score: number | null;
}

export interface QuickAccessLeadItem {
  id: string;
  company_name: string;
  status: { name: string; color: string } | null;
}

export interface TopPerformerItem {
  userId: string;
  name: string;
  activities: number;
  leads: number;
}

export interface ActivityBreakdownItem {
  type: string;
  count: number;
  color: string;
}

export function useDashboardData() {
  const { user, role } = useAuth();
  const isAdmin = role === 'admin';

  const [kpis, setKpis] = useState<DashboardKpis>({
    totalLeads: 0,
    conversionRate: '0%',
    hotLeads: 0,
    tasksDue: 0,
    followUps: 0,
  });
  const [statusData, setStatusData] = useState<StatusChartItem[]>([]);
  const [countryData, setCountryData] = useState<CountryChartItem[]>([]);
  const [activityData, setActivityData] = useState<ActivityChartItem[]>([]);
  const [recentActivities, setRecentActivities] = useState<RecentActivityItem[]>([]);
  const [upcomingTasks, setUpcomingTasks] = useState<UpcomingTaskItem[]>([]);
  const [upcomingFollowUps, setUpcomingFollowUps] = useState<UpcomingFollowUpItem[]>([]);
  const [hotLeadsList, setHotLeadsList] = useState<HotLeadItem[]>([]);
  const [quickAccessLeads, setQuickAccessLeads] = useState<QuickAccessLeadItem[]>([]);
  const [topPerformers, setTopPerformers] = useState<TopPerformerItem[]>([]);
  const [myActivityBreakdown, setMyActivityBreakdown] = useState<ActivityBreakdownItem[]>([]);
  const [myTasksCompleted, setMyTasksCompleted] = useState(0);
  const [myTasksTotal, setMyTasksTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const todayEnd = endOfDay(new Date()).toISOString();
    const now = new Date().toISOString();

    (async () => {
      try {
        // Batch 1: KPIs + status/country charts in parallel so widgets show fast
        const leadsQuery = supabase
          .from('leads')
          .select('id, lead_score, status_id, owner_id');
        if (!isAdmin) (leadsQuery as any).eq('owner_id', user.id);

        const tasksQuery = supabase
          .from('tasks')
          .select('id', { count: 'exact', head: true })
          .eq('is_completed', false)
          .lte('due_date', todayEnd);
        if (!isAdmin) (tasksQuery as any).eq('assignee_id', user.id);

        const countryQuery = supabase.from('leads').select('country_id, countries(code)');
        if (!isAdmin) (countryQuery as any).eq('owner_id', user.id);

        const [leadsRes, statusesRes, tasksRes, followUpsRes, countryRes] = await Promise.all([
          leadsQuery,
          supabase.from('lead_statuses').select('id, name, color'),
          tasksQuery,
          !isAdmin
            ? supabase
                .from('follow_ups')
                .select('id', { count: 'exact', head: true })
                .eq('user_id', user.id)
                .eq('is_completed', false)
                .gte('scheduled_at', now)
            : Promise.resolve({ count: 0 }),
          countryQuery,
        ]);

        const leadList = leadsRes.data ?? [];
        const totalLeads = leadList.length;
        const statuses = (statusesRes.data ?? []) as { id: string; name: string; color: string }[];
        const wonStatus = statuses.find((s) => s.name.toLowerCase() === 'won');
        const wonCount = wonStatus ? leadList.filter((l) => l.status_id === wonStatus.id).length : 0;
        const conversionRate = totalLeads > 0 ? ((wonCount / totalLeads) * 100).toFixed(1) + '%' : '0%';
        const hotLeads = leadList.filter((l) => (l.lead_score ?? 0) >= 70).length;
        const followUps = !isAdmin && followUpsRes.count != null ? followUpsRes.count : 0;

        setKpis({
          totalLeads,
          conversionRate,
          hotLeads,
          tasksDue: tasksRes.count ?? 0,
          followUps,
        });

        const statusCounts: Record<string, { count: number; color: string }> = {};
        const statusById = Object.fromEntries(statuses.map((s) => [s.id, s]));
        leadList.forEach((l: { status_id: string | null }) => {
          const s = l.status_id ? statusById[l.status_id] : null;
          const name = s?.name ?? 'Unassigned';
          const color = s?.color ?? '#6B7280';
          if (!statusCounts[name]) statusCounts[name] = { count: 0, color };
          statusCounts[name].count++;
        });
        setStatusData(Object.entries(statusCounts).map(([name, { count, color }]) => ({ name, value: count, color })));

        const countryCounts: Record<string, number> = {};
        type CountryRow = { countries: { code: string } | null };
        ((countryRes as { data?: CountryRow[] }).data ?? []).forEach((l: CountryRow) => {
          const code = l.countries?.code ?? 'Other';
          countryCounts[code] = (countryCounts[code] ?? 0) + 1;
        });
        setCountryData(Object.entries(countryCounts).map(([name, leads]) => ({ name, leads })));

        setLoading(false);

        // Batch 2: recent activity, charts, quick access (non-blocking)
        const myLeadIds = !isAdmin ? leadList.map((l: { id: string }) => l.id) : null;

        let activityQuery = supabase
          .from('lead_activities')
          .select('id, lead_id, activity_type, description, created_at, user_id')
          .order('created_at', { ascending: false })
          .limit(10);
        if (!isAdmin && myLeadIds?.length === 0) {
          setRecentActivities([]);
        } else {
          if (!isAdmin && myLeadIds?.length) (activityQuery as any).in('lead_id', myLeadIds);
          const { data: activities } = await activityQuery;
          if (activities?.length) {
            const leadIds = [...new Set(activities.map((a) => a.lead_id))];
            const [leadsNamesRes, profilesRes] = await Promise.all([
              supabase.from('leads').select('id, company_name').in('id', leadIds),
              supabase.from('profiles').select('user_id, full_name').in('user_id', [...new Set(activities.map((a) => a.user_id))]),
            ]);
            const leadMap = ((leadsNamesRes.data ?? []) as { id: string; company_name: string }[]).reduce((acc, l) => {
              acc[l.id] = l.company_name;
              return acc;
            }, {} as Record<string, string>);
            const profileMap = ((profilesRes.data ?? []) as { user_id: string; full_name: string | null }[]).reduce((acc, p) => {
              acc[p.user_id] = p.full_name ?? 'Unknown';
              return acc;
            }, {} as Record<string, string>);
            setRecentActivities(
              activities.map((a) => ({
                id: a.id,
                type: a.activity_type,
                description: a.description,
                user: profileMap[a.user_id] ?? 'Unknown',
                time: formatDistanceToNowShort(new Date(a.created_at)),
                leadName: leadMap[a.lead_id],
                leadId: a.lead_id,
              }))
            );
          } else {
            setRecentActivities([]);
          }
        }

        if (isAdmin) {
          const days = Array.from({ length: 7 }, (_, i) => subDays(new Date(), 6 - i));
          const [activityByDay, quickLeadsRes, allActivitiesRes, allLeadsRes] = await Promise.all([
            Promise.all(
              days.map(async (day) => {
                const start = startOfDay(day).toISOString();
                const end = endOfDay(day).toISOString();
                const { data } = await supabase.from('lead_activities').select('activity_type').gte('created_at', start).lte('created_at', end);
                const counts = { calls: 0, emails: 0, meetings: 0 };
                (data ?? []).forEach((a: { activity_type: string }) => {
                  if (a.activity_type === 'call') counts.calls++;
                  else if (a.activity_type === 'email') counts.emails++;
                  else if (a.activity_type === 'meeting') counts.meetings++;
                });
                return { name: format(day, 'EEE'), ...counts };
              })
            ),
            supabase.from('leads').select('id, company_name, status:lead_statuses(name, color)').order('updated_at', { ascending: false }).limit(10),
            supabase.from('lead_activities').select('user_id'),
            supabase.from('leads').select('owner_id'),
          ]);
          setActivityData(activityByDay);
          setQuickAccessLeads((quickLeadsRes.data as QuickAccessLeadItem[]) ?? []);

          // Top performers by activities + leads owned
          const activityCounts: Record<string, number> = {};
          ((allActivitiesRes.data ?? []) as { user_id: string }[]).forEach((a) => {
            activityCounts[a.user_id] = (activityCounts[a.user_id] ?? 0) + 1;
          });
          const leadCounts: Record<string, number> = {};
          ((allLeadsRes.data ?? []) as { owner_id: string | null }[]).forEach((l) => {
            if (l.owner_id) leadCounts[l.owner_id] = (leadCounts[l.owner_id] ?? 0) + 1;
          });
          const allUserIds = [...new Set([...Object.keys(activityCounts), ...Object.keys(leadCounts)])];
          if (allUserIds.length > 0) {
            const { data: allProfiles } = await supabase.from('profiles').select('user_id, full_name').in('user_id', allUserIds);
            const profileNames = ((allProfiles ?? []) as { user_id: string; full_name: string | null }[]).reduce((acc, p) => {
              acc[p.user_id] = p.full_name ?? 'Unknown';
              return acc;
            }, {} as Record<string, string>);
            const performers = allUserIds
              .map((uid) => ({
                userId: uid,
                name: profileNames[uid] ?? uid.slice(0, 8),
                activities: activityCounts[uid] ?? 0,
                leads: leadCounts[uid] ?? 0,
              }))
              .sort((a, b) => b.activities - a.activities)
              .slice(0, 5);
            setTopPerformers(performers);
          }
        } else {
          setActivityData([]);
          setQuickAccessLeads([]);
          setTopPerformers([]);
          if (user) {
            const [tasksData, followUpsData, hotLeadsData, myActivitiesRes, myTasksStatsRes] = await Promise.all([
              supabase.from('tasks').select('id, title, due_date, priority').eq('assignee_id', user.id).eq('is_completed', false).gte('due_date', now).order('due_date', { ascending: true }).limit(5),
              supabase.from('follow_ups').select('id, scheduled_at, notes').eq('user_id', user.id).eq('is_completed', false).gte('scheduled_at', now).order('scheduled_at', { ascending: true }).limit(5),
              supabase.from('leads').select('id, company_name, lead_score').eq('owner_id', user.id).gte('lead_score', 70).order('lead_score', { ascending: false }).limit(5),
              myLeadIds?.length ? supabase.from('lead_activities').select('activity_type').in('lead_id', myLeadIds) : Promise.resolve({ data: [] }),
              supabase.from('tasks').select('id, is_completed').eq('assignee_id', user.id),
            ]);
            setUpcomingTasks((tasksData.data as UpcomingTaskItem[]) ?? []);
            setUpcomingFollowUps((followUpsData.data as UpcomingFollowUpItem[]) ?? []);
            setHotLeadsList((hotLeadsData.data as HotLeadItem[]) ?? []);

            // My activity breakdown
            const actCounts = { call: 0, email: 0, meeting: 0, note: 0 };
            ((myActivitiesRes.data ?? []) as { activity_type: string }[]).forEach((a) => {
              if (a.activity_type in actCounts) actCounts[a.activity_type as keyof typeof actCounts]++;
            });
            const colors = { call: 'hsl(var(--primary))', email: 'hsl(var(--accent))', meeting: 'hsl(var(--success))', note: 'hsl(var(--warning))' };
            setMyActivityBreakdown(
              (Object.keys(actCounts) as Array<keyof typeof actCounts>)
                .filter((k) => actCounts[k] > 0)
                .map((k) => ({ type: k, count: actCounts[k], color: colors[k] }))
            );

            // Task completion
            const tasks = ((myTasksStatsRes.data ?? []) as { is_completed: boolean }[]);
            setMyTasksTotal(tasks.length);
            setMyTasksCompleted(tasks.filter((t) => t.is_completed).length);
          }
        }
      } catch {
        setLoading(false);
      }
    })();
  }, [user?.id, role, isAdmin]);

  return {
    kpis,
    statusData,
    countryData,
    activityData,
    recentActivities,
    upcomingTasks,
    upcomingFollowUps,
    hotLeadsList,
    quickAccessLeads,
    topPerformers,
    myActivityBreakdown,
    myTasksCompleted,
    myTasksTotal,
    loading,
    isAdmin,
  };
}

function formatDistanceToNowShort(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
  return format(date, 'MMM d');
}
