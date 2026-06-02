import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { fetchAllPaginated } from '@/lib/supabasePaginate';
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

export interface WorldDemographicsCountry {
  countryCode: string;
  countryName: string;
  totalLeads: number;
  statusBreakdown: { statusName: string; count: number; color: string }[];
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
  const [worldDemographics, setWorldDemographics] = useState<WorldDemographicsCountry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const todayEnd = endOfDay(new Date()).toISOString();
    const now = new Date().toISOString();

    (async () => {
      try {
        type LeadStatusRow = { id: string; name: string; color: string };
        type CountryRow = { country_ids: string[] };
        type WorldDemoRow = {
          country_ids: string[];
          status_id: string | null;
          lead_statuses: { name: string; color: string } | null;
        };

        const applyOwnerFilter = <T extends { eq: (col: string, val: string) => T }>(q: T): T =>
          !isAdmin ? q.eq('owner_id', user.id) : q;

        let tasksQuery = supabase
          .from('tasks')
          .select('id', { count: 'exact', head: true })
          .eq('is_completed', false)
          .lte('due_date', todayEnd);
        if (!isAdmin) tasksQuery = tasksQuery.eq('assignee_id', user.id);

        const followUpsQuery = !isAdmin
          ? supabase
              .from('follow_ups')
              .select('id', { count: 'exact', head: true })
              .eq('user_id', user.id)
              .eq('is_completed', false)
              .gte('scheduled_at', now)
          : Promise.resolve({ count: 0 });

        const statusesRes = await supabase.from('lead_statuses').select('id, name, color');
        const statuses = (statusesRes.data ?? []) as LeadStatusRow[];
        const wonStatus = statuses.find((s) => s.name.toLowerCase() === 'won');

        const [
          totalLeadsRes,
          hotLeadsRes,
          wonCountRes,
          tasksRes,
          followUpsRes,
          statusCountResults,
          unassignedRes,
          countryRowsData,
          demoData,
        ] = await Promise.all([
          applyOwnerFilter(supabase.from('leads').select('id', { count: 'exact', head: true }) as any),
          applyOwnerFilter(supabase.from('leads').select('id', { count: 'exact', head: true }).gte('lead_score', 70) as any),
          wonStatus
            ? applyOwnerFilter(supabase.from('leads').select('id', { count: 'exact', head: true }).eq('status_id', wonStatus.id) as any)
            : Promise.resolve({ count: 0 }),
          tasksQuery,
          followUpsQuery,
          Promise.all(
            statuses.map(async (s) => {
              const { count } = await applyOwnerFilter(
                supabase.from('leads').select('id', { count: 'exact', head: true }).eq('status_id', s.id) as any
              );
              return { name: s.name, value: count ?? 0, color: s.color };
            })
          ),
          applyOwnerFilter(supabase.from('leads').select('id', { count: 'exact', head: true }).is('status_id', null) as any),
          fetchAllPaginated<CountryRow>((from, to) => {
            let q = supabase.from('leads').select('country_ids').range(from, to);
            if (!isAdmin) q = q.eq('owner_id', user.id);
            return q;
          }),
          fetchAllPaginated<WorldDemoRow>((from, to) => {
            let q = supabase
              .from('leads')
              .select('country_ids, status_id, lead_statuses(name, color)')
              .range(from, to);
            if (!isAdmin) q = q.eq('owner_id', user.id);
            return q;
          }),
        ]);

        const totalLeads = totalLeadsRes.count ?? 0;
        const wonCount = wonCountRes.count ?? 0;
        const conversionRate = totalLeads > 0 ? ((wonCount / totalLeads) * 100).toFixed(1) + '%' : '0%';
        const hotLeads = hotLeadsRes.count ?? 0;
        const followUps = !isAdmin && followUpsRes.count != null ? followUpsRes.count : 0;

        setKpis({
          totalLeads,
          conversionRate,
          hotLeads,
          tasksDue: tasksRes.count ?? 0,
          followUps,
        });

        const statusChartData = [...statusCountResults];
        const unassignedCount = unassignedRes.count ?? 0;
        if (unassignedCount > 0) {
          statusChartData.push({ name: 'Unassigned', value: unassignedCount, color: '#6E7180' });
        }
        setStatusData(statusChartData.filter((s) => s.value > 0));

        const countryCounts: Record<string, number> = {};
        const allCountryIds = [...new Set(countryRowsData.flatMap((l) => l.country_ids ?? []))];
        let countryCodeMap: Record<string, string> = {};
        if (allCountryIds.length > 0) {
          const { data: cRows } = await supabase.from('countries').select('id, code').in('id', allCountryIds);
          countryCodeMap = (cRows ?? []).reduce((acc: Record<string, string>, c: { id: string; code: string }) => { acc[c.id] = c.code; return acc; }, {});
        }
        countryRowsData.forEach((l) => {
          (l.country_ids ?? []).forEach((cid: string) => {
            const code = countryCodeMap[cid] ?? 'Other';
            countryCounts[code] = (countryCounts[code] ?? 0) + 1;
          });
        });
        setCountryData(Object.entries(countryCounts).map(([name, leads]) => ({ name, leads })));

        // World demographics from paginated lead data
        // Collect all country IDs from world demo data
        const demoCids = [...new Set(demoData.flatMap((r) => r.country_ids ?? []))];
        let demoCountryMap: Record<string, { code: string; name: string }> = {};
        if (demoCids.length > 0) {
          const { data: cRows } = await supabase.from('countries').select('id, code, name').in('id', demoCids);
          demoCountryMap = (cRows ?? []).reduce((acc: Record<string, { code: string; name: string }>, c: { id: string; code: string; name: string }) => { acc[c.id] = { code: c.code, name: c.name }; return acc; }, {});
        }
        const worldMap: Record<string, {
          countryCode: string;
          countryName: string;
          totalLeads: number;
          statuses: Record<string, { name: string; count: number; color: string }>;
        }> = {};
        
        demoData.forEach((row) => {
          (row.country_ids ?? []).forEach((cid: string) => {
            const country = demoCountryMap[cid];
            if (!country) return;
            const code = country.code;
            const name = country.name;
          
            if (!worldMap[code]) {
              worldMap[code] = { countryCode: code, countryName: name, totalLeads: 0, statuses: {} };
            }
          
            worldMap[code].totalLeads++;
          
            const statusName = row.lead_statuses?.name ?? 'Unassigned';
            const statusColor = row.lead_statuses?.color ?? '#6B7280';
          
            if (!worldMap[code].statuses[statusName]) {
              worldMap[code].statuses[statusName] = { name: statusName, count: 0, color: statusColor };
            }
            worldMap[code].statuses[statusName].count++;
          });
        });
        
        const worldDemoArray = Object.values(worldMap).map(country => ({
          countryCode: country.countryCode,
          countryName: country.countryName,
          totalLeads: country.totalLeads,
          statusBreakdown: Object.values(country.statuses).map(s => ({
            statusName: s.name,
            count: s.count,
            color: s.color,
          })),
        }));
        
        setWorldDemographics(worldDemoArray);

        setLoading(false);

        // Batch 2: recent activity, charts, quick access (non-blocking)
        const myLeadIds = !isAdmin
          ? (await fetchAllPaginated<{ id: string }>((from, to) =>
              supabase.from('leads').select('id').eq('owner_id', user.id).range(from, to)
            )).map((l) => l.id)
          : null;

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
            fetchAllPaginated<{ user_id: string }>((from, to) =>
              supabase.from('lead_activities').select('user_id').range(from, to)
            ),
            fetchAllPaginated<{ owner_id: string | null }>((from, to) =>
              supabase.from('leads').select('owner_id').range(from, to)
            ),
          ]);
          setActivityData(activityByDay);
          setQuickAccessLeads((quickLeadsRes.data as QuickAccessLeadItem[]) ?? []);

          // Top performers by activities + leads owned
          const activityCounts: Record<string, number> = {};
          allActivitiesRes.forEach((a) => {
            activityCounts[a.user_id] = (activityCounts[a.user_id] ?? 0) + 1;
          });
          const leadCounts: Record<string, number> = {};
          allLeadsRes.forEach((l) => {
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
            const [tasksData, followUpsData, hotLeadsData, myTasksTotalRes, myTasksCompletedRes] = await Promise.all([
              supabase.from('tasks').select('id, title, due_date, priority').eq('assignee_id', user.id).eq('is_completed', false).gte('due_date', now).order('due_date', { ascending: true }).limit(5),
              supabase.from('follow_ups').select('id, scheduled_at, notes').eq('user_id', user.id).eq('is_completed', false).gte('scheduled_at', now).order('scheduled_at', { ascending: true }).limit(5),
              supabase.from('leads').select('id, company_name, lead_score').eq('owner_id', user.id).gte('lead_score', 70).order('lead_score', { ascending: false }).limit(5),
              supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('assignee_id', user.id),
              supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('assignee_id', user.id).eq('is_completed', true),
            ]);
            setUpcomingTasks((tasksData.data as UpcomingTaskItem[]) ?? []);
            setUpcomingFollowUps((followUpsData.data as UpcomingFollowUpItem[]) ?? []);
            setHotLeadsList((hotLeadsData.data as HotLeadItem[]) ?? []);

            // My activity breakdown — fetch activities for owned leads in chunks
            const myActivities: { activity_type: string }[] = [];
            if (myLeadIds?.length) {
              const CHUNK = 200;
              for (let i = 0; i < myLeadIds.length; i += CHUNK) {
                const chunk = myLeadIds.slice(i, i + CHUNK);
                const batch = await fetchAllPaginated<{ activity_type: string }>((from, to) =>
                  supabase.from('lead_activities').select('activity_type').in('lead_id', chunk).range(from, to)
                );
                myActivities.push(...batch);
              }
            }

            const actCounts = { call: 0, email: 0, meeting: 0, note: 0 };
            myActivities.forEach((a) => {
              if (a.activity_type in actCounts) actCounts[a.activity_type as keyof typeof actCounts]++;
            });
            const colors = { call: 'hsl(var(--primary))', email: 'hsl(var(--accent))', meeting: 'hsl(var(--success))', note: 'hsl(var(--warning))' };
            setMyActivityBreakdown(
              (Object.keys(actCounts) as Array<keyof typeof actCounts>)
                .filter((k) => actCounts[k] > 0)
                .map((k) => ({ type: k, count: actCounts[k], color: colors[k] }))
            );

            setMyTasksTotal(myTasksTotalRes.count ?? 0);
            setMyTasksCompleted(myTasksCompletedRes.count ?? 0);
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
    worldDemographics,
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
  
  // Show "just now" for less than 1 minute
  if (diffMins < 1) return 'just now';
  
  // Show mins ago for 1-60 minutes
  if (diffMins < 60) return `${diffMins} mins ago`;
  
  // Show hrs ago for 60 minutes to 24 hours
  if (diffHours < 24) return `${diffHours} hrs ago`;
  
  // Show days ago for anything over 24 hours
  return `${diffDays} days ago`;
}
