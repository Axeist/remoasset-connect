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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    (async () => {
      const todayStart = startOfDay(new Date()).toISOString();
      const todayEnd = endOfDay(new Date()).toISOString();

      // Base leads query - admin sees all, employee sees own
      const leadsQuery = supabase
        .from('leads')
        .select('id, lead_score, status_id, owner_id', { count: 'exact', head: false });
      if (!isAdmin) {
        leadsQuery.eq('owner_id', user.id);
      }
      const { data: leads } = await leadsQuery;

      const leadList = leads ?? [];
      const totalLeads = leadList.length;

      // Won count for conversion (need status name "Won" - we'll get status_ids from lead_statuses)
      const { data: wonStatus } = await supabase
        .from('lead_statuses')
        .select('id')
        .ilike('name', 'Won')
        .maybeSingle();
      const wonCount = wonStatus
        ? leadList.filter((l) => l.status_id === wonStatus.id).length
        : 0;
      const conversionRate = totalLeads > 0 ? ((wonCount / totalLeads) * 100).toFixed(1) + '%' : '0%';

      const hotLeads = leadList.filter((l) => (l.lead_score ?? 0) >= 70).length;

      // Tasks due (not completed, due_date <= end of today)
      const tasksQuery = supabase
        .from('tasks')
        .select('id', { count: 'exact', head: true })
        .eq('is_completed', false)
        .lte('due_date', todayEnd);
      if (!isAdmin) {
        tasksQuery.eq('assignee_id', user.id);
      }
      const { count: tasksDue } = await tasksQuery;

      let followUps = 0;
      if (!isAdmin) {
        const { count } = await supabase
          .from('follow_ups')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('is_completed', false)
          .gte('scheduled_at', new Date().toISOString());
        followUps = count ?? 0;
      }

      setKpis({
        totalLeads,
        conversionRate,
        hotLeads,
        tasksDue: tasksDue ?? 0,
        followUps,
      });

      // Chart: leads by status
      const { data: leadsWithStatus } = await supabase
        .from('leads')
        .select('status_id, lead_statuses(name, color)');
      const statusCounts: Record<string, { count: number; color: string }> = {};
      type LeadRow = { status_id: string | null; lead_statuses: { name: string; color: string } | null };
      (leadsWithStatus ?? []).forEach((l: LeadRow) => {
        const name = l.lead_statuses?.name ?? 'Unassigned';
        const color = l.lead_statuses?.color ?? '#6B7280';
        if (!statusCounts[name]) statusCounts[name] = { count: 0, color };
        statusCounts[name].count++;
      });
      setStatusData(
        Object.entries(statusCounts).map(([name, { count, color }]) => ({ name, value: count, color }))
      );

      // Chart: leads by country
      const { data: leadsWithCountry } = await supabase
        .from('leads')
        .select('country_id, countries(code)');
      const countryCounts: Record<string, number> = {};
      type CountryRow = { countries: { code: string } | null };
      (leadsWithCountry ?? []).forEach((l: CountryRow) => {
        const code = l.countries?.code ?? 'Other';
        countryCounts[code] = (countryCounts[code] ?? 0) + 1;
      });
      setCountryData(
        Object.entries(countryCounts).map(([name, leads]) => ({ name, leads }))
      );

      // Activity over time (last 7 days) - admin only
      if (isAdmin) {
        const days = Array.from({ length: 7 }, (_, i) => subDays(new Date(), 6 - i));
        const activityByDay = await Promise.all(
          days.map(async (day) => {
            const start = startOfDay(day).toISOString();
            const end = endOfDay(day).toISOString();
            const { data: activities } = await supabase
              .from('lead_activities')
              .select('activity_type')
              .gte('created_at', start)
              .lte('created_at', end);
            const counts = { calls: 0, emails: 0, meetings: 0 };
            (activities ?? []).forEach((a: { activity_type: string }) => {
              if (a.activity_type === 'call') counts.calls++;
              else if (a.activity_type === 'email') counts.emails++;
              else if (a.activity_type === 'meeting') counts.meetings++;
            });
            return {
              name: format(day, 'EEE'),
              ...counts,
            };
          })
        );
        setActivityData(activityByDay);
      }

      // Recent activity (last 10)
      let activityQuery = supabase
        .from('lead_activities')
        .select('id, lead_id, activity_type, description, created_at, user_id')
        .order('created_at', { ascending: false })
        .limit(10);
      let skipActivityFetch = false;
      if (!isAdmin) {
        const { data: myLeadIds } = await supabase
          .from('leads')
          .select('id')
          .eq('owner_id', user.id);
        const ids = (myLeadIds ?? []).map((l) => l.id);
        if (ids.length === 0) {
          setRecentActivities([]);
          skipActivityFetch = true;
        } else {
          activityQuery = activityQuery.in('lead_id', ids);
        }
      }
      if (!skipActivityFetch) {
      const { data: activities } = await activityQuery;
      if (activities?.length) {
        const leadIds = [...new Set(activities.map((a) => a.lead_id))];
        const { data: leadsNames } = await supabase
          .from('leads')
          .select('id, company_name')
          .in('id', leadIds);
        const leadMap = (leadsNames ?? []).reduce(
          (acc, l) => {
            acc[l.id] = l.company_name;
            return acc;
          },
          {} as Record<string, string>
        );
        const userIds = [...new Set(activities.map((a) => a.user_id))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', userIds);
        const profileMap = (profiles ?? []).reduce(
          (acc, p) => {
            acc[p.user_id] = p.full_name ?? 'Unknown';
            return acc;
          },
          {} as Record<string, string>
        );
        const items: RecentActivityItem[] = activities.map((a) => ({
          id: a.id,
          type: a.activity_type,
          description: a.description,
          user: profileMap[a.user_id] ?? 'Unknown',
          time: formatDistanceToNowShort(new Date(a.created_at)),
          leadName: leadMap[a.lead_id],
        }));
        setRecentActivities(items);
      } else {
        setRecentActivities([]);
      }
      }

      // Employee: upcoming tasks & follow-ups, hot leads
      if (!isAdmin && user) {
        const now = new Date().toISOString();
        const { data: tasksData } = await supabase
          .from('tasks')
          .select('id, title, due_date, priority')
          .eq('assignee_id', user.id)
          .eq('is_completed', false)
          .gte('due_date', now)
          .order('due_date', { ascending: true })
          .limit(5);
        setUpcomingTasks((tasksData as UpcomingTaskItem[]) ?? []);

        const { data: followUpsData } = await supabase
          .from('follow_ups')
          .select('id, scheduled_at, notes')
          .eq('user_id', user.id)
          .eq('is_completed', false)
          .gte('scheduled_at', now)
          .order('scheduled_at', { ascending: true })
          .limit(5);
        setUpcomingFollowUps((followUpsData as UpcomingFollowUpItem[]) ?? []);

        const { data: hotLeadsData } = await supabase
          .from('leads')
          .select('id, company_name, lead_score')
          .eq('owner_id', user.id)
          .gte('lead_score', 70)
          .order('lead_score', { ascending: false })
          .limit(5);
        setHotLeadsList((hotLeadsData as HotLeadItem[]) ?? []);
      } else {
        setUpcomingTasks([]);
        setUpcomingFollowUps([]);
        setHotLeadsList([]);
      }

      // Admin: quick access leads (recent 10)
      if (isAdmin) {
        const { data: quickLeads } = await supabase
          .from('leads')
          .select('id, company_name, status:lead_statuses(name, color)')
          .order('updated_at', { ascending: false })
          .limit(10);
        setQuickAccessLeads((quickLeads as QuickAccessLeadItem[]) ?? []);
      } else {
        setQuickAccessLeads([]);
      }

      setLoading(false);
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
