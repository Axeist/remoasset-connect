import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { 
  BarChart3, Download, PieChart, TrendingUp, Activity, Award, Target, 
  Clock, CheckCircle2, Users, TrendingDown, Calendar, Phone, Mail, 
  MessageSquare, AlertCircle, Zap, Timer
} from 'lucide-react';
import { 
  PieChart as RechartsPie, Pie, Cell, BarChart, Bar, XAxis, YAxis, 
  CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend, 
  Area, AreaChart, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from 'recharts';
import { format, subDays, startOfDay, endOfDay, differenceInDays } from 'date-fns';

export default function Reports() {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const isAdmin = role === 'admin';
  const [loading, setLoading] = useState(true);
  
  // Existing state
  const [byStatus, setByStatus] = useState<{ name: string; value: number; color: string }[]>([]);
  const [byCountry, setByCountry] = useState<{ name: string; leads: number }[]>([]);
  const [teamActivity, setTeamActivity] = useState<{ name: string; activities: number }[]>([]);
  const [leadScoreDistribution, setLeadScoreDistribution] = useState<{ range: string; count: number }[]>([]);
  const [activityTrends, setActivityTrends] = useState<{ date: string; calls: number; emails: number; meetings: number }[]>([]);
  const [topPerformers, setTopPerformers] = useState<{ name: string; activities: number; leads: number; conversionRate: string }[]>([]);
  const [myActivityBreakdown, setMyActivityBreakdown] = useState<{ name: string; value: number; color: string }[]>([]);
  const [myPerformance, setMyPerformance] = useState({ totalActivities: 0, avgLeadScore: 0, tasksCompleted: 0, conversionRate: '0%' });

  // New productivity tracking state
  const [productivityMetrics, setProductivityMetrics] = useState({
    avgResponseTime: 0,
    followUpCompletionRate: 0,
    taskCompletionRate: 0,
    dailyActivityAvg: 0,
    leadsPerDay: 0,
    activitiesPerLead: 0,
  });
  const [employeeProductivity, setEmployeeProductivity] = useState<{
    name: string;
    responseTime: number;
    followUpRate: number;
    taskRate: number;
    efficiency: number;
  }[]>([]);
  const [timeDistribution, setTimeDistribution] = useState<{ hour: string; activities: number }[]>([]);
  const [weeklyProductivity, setWeeklyProductivity] = useState<{ 
    day: string; 
    activities: number; 
    tasks: number; 
    followUps: number 
  }[]>([]);
  const [leadVelocity, setLeadVelocity] = useState<{ stage: string; avgDays: number }[]>([]);
  const [activityHeatmap, setActivityHeatmap] = useState<{ name: string; value: number }[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        // Batch 1: Fetch basic data in parallel
        const leadsQuery = supabase.from('leads').select('id, status_id, country_id, owner_id, lead_score, created_at');
        if (!isAdmin) {
          leadsQuery.eq('owner_id', user.id);
        }

        const [leadsRes, statusRows, countryRows] = await Promise.all([
          leadsQuery,
          supabase.from('lead_statuses').select('id, name, color'),
          supabase.from('countries').select('id, code, name'),
        ]);

        const leadList = leadsRes.data ?? [];

        // Process status data
        const statusMap = (statusRows.data ?? []).reduce((acc, s) => { acc[s.id] = { name: s.name, color: s.color }; return acc; }, {} as Record<string, { name: string; color: string }>);
        const statusCounts: Record<string, { count: number; color: string }> = {};
        leadList.forEach((l: { status_id: string | null }) => {
          const s = l.status_id ? statusMap[l.status_id] : null;
          const name = s?.name ?? 'Unassigned';
          const color = s?.color ?? '#6B7280';
          if (!statusCounts[name]) statusCounts[name] = { count: 0, color };
          statusCounts[name].count++;
        });
        setByStatus(Object.entries(statusCounts).map(([name, { count, color }]) => ({ name, value: count, color })));

        // Process country data
        const countryMap = (countryRows.data ?? []).reduce((acc, c) => { acc[c.id] = c.code; return acc; }, {} as Record<string, string>);
        const countryCounts: Record<string, number> = {};
        leadList.forEach((l: { country_id: string | null }) => {
          const code = l.country_id ? (countryMap[l.country_id] ?? 'Other') : 'Other';
          countryCounts[code] = (countryCounts[code] ?? 0) + 1;
        });
        setByCountry(Object.entries(countryCounts).map(([name, leads]) => ({ name, leads })));

        // Show initial charts immediately
        setLoading(false);

        // Batch 2: Fetch productivity analytics
        if (isAdmin) {
          // Admin: Fetch comprehensive team productivity data
          const [activitiesRes, allLeadsForConv, statusesForConv, tasksRes, followUpsRes] = await Promise.all([
            supabase.from('lead_activities').select('user_id, activity_type, created_at, lead_id'),
            supabase.from('leads').select('owner_id, status_id, created_at'),
            supabase.from('lead_statuses').select('id, name'),
            supabase.from('tasks').select('assignee_id, is_completed, created_at, due_date, updated_at'),
            supabase.from('follow_ups').select('user_id, is_completed, scheduled_at, created_at, completed_at'),
          ]);

          const activities = activitiesRes.data ?? [];
          const tasks = tasksRes.data ?? [];
          const followUps = followUpsRes.data ?? [];

          // Team activity counts
          const counts: Record<string, number> = {};
          activities.forEach((a: { user_id: string }) => {
            counts[a.user_id] = (counts[a.user_id] ?? 0) + 1;
          });
          const userIds = Object.keys(counts);
          
          // Fetch profiles for users
          let names: Record<string, string> = {};
          if (userIds.length > 0) {
            const { data: profiles } = await supabase.from('profiles').select('user_id, full_name').in('user_id', userIds);
            names = (profiles ?? []).reduce((acc, p) => { acc[p.user_id] = p.full_name || 'Unknown'; return acc; }, {} as Record<string, string>);
            setTeamActivity(userIds.map((uid) => ({ name: names[uid] ?? uid.slice(0, 8), activities: counts[uid] })));
          }

          // Lead score distribution
          const scoreCounts = { '0-25': 0, '26-50': 0, '51-75': 0, '76-100': 0 };
          leadList.forEach((l: { lead_score?: number | null }) => {
            const score = l.lead_score ?? 0;
            if (score <= 25) scoreCounts['0-25']++;
            else if (score <= 50) scoreCounts['26-50']++;
            else if (score <= 75) scoreCounts['51-75']++;
            else scoreCounts['76-100']++;
          });
          setLeadScoreDistribution(Object.entries(scoreCounts).map(([range, count]) => ({ range, count })));

          // Activity trends over last 14 days
          const days = Array.from({ length: 14 }, (_, i) => subDays(new Date(), 13 - i));
          const trends = days.map(day => {
            const start = startOfDay(day);
            const end = endOfDay(day);
            const dayActivities = activities.filter((a: { created_at: string }) => {
              const actDate = new Date(a.created_at);
              return actDate >= start && actDate <= end;
            });
            const counts = { calls: 0, emails: 0, meetings: 0 };
            dayActivities.forEach((a: { activity_type: string }) => {
              if (a.activity_type === 'call') counts.calls++;
              else if (a.activity_type === 'email') counts.emails++;
              else if (a.activity_type === 'meeting') counts.meetings++;
            });
            return { date: format(day, 'MM/dd'), ...counts };
          });
          setActivityTrends(trends);

          // Top performers with conversion rate
          const statusNames = (statusesForConv.data ?? []).reduce((acc, s) => { acc[s.id] = s.name; return acc; }, {} as Record<string, string>);
          const leadsPerUser: Record<string, number> = {};
          const wonPerUser: Record<string, number> = {};
          (allLeadsForConv.data ?? []).forEach((l: { owner_id: string | null; status_id: string | null }) => {
            if (!l.owner_id) return;
            leadsPerUser[l.owner_id] = (leadsPerUser[l.owner_id] ?? 0) + 1;
            const statusName = l.status_id ? statusNames[l.status_id] : null;
            if (statusName?.toLowerCase().includes('won')) wonPerUser[l.owner_id] = (wonPerUser[l.owner_id] ?? 0) + 1;
          });
          const performers = userIds.map((uid) => ({
            name: names[uid] ?? uid.slice(0, 8),
            activities: counts[uid],
            leads: leadsPerUser[uid] ?? 0,
            conversionRate: leadsPerUser[uid] ? `${Math.round(((wonPerUser[uid] ?? 0) / leadsPerUser[uid]) * 100)}%` : '0%',
          })).sort((a, b) => b.activities - a.activities).slice(0, 5);
          setTopPerformers(performers);

          // NEW: Employee Productivity Metrics
          const empProductivity = userIds.map(uid => {
            const userActivities = activities.filter((a: { user_id: string }) => a.user_id === uid);
            const userTasks = tasks.filter((t: { assignee_id: string | null }) => t.assignee_id === uid);
            const userFollowUps = followUps.filter((f: { user_id: string }) => f.user_id === uid);

            // Average response time (days between lead creation and first activity)
            const leadIds = new Set(userActivities.map((a: { lead_id: string }) => a.lead_id));
            let totalResponseDays = 0;
            let responseCount = 0;
            leadIds.forEach(leadId => {
              const lead = (allLeadsForConv.data ?? []).find((l: { owner_id: string }) => l.owner_id === uid);
              if (!lead) return;
              const firstActivity = userActivities
                .filter((a: { lead_id: string }) => a.lead_id === leadId)
                .sort((a: { created_at: string }, b: { created_at: string }) => 
                  new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                )[0];
              if (firstActivity && lead.created_at) {
                const days = differenceInDays(new Date(firstActivity.created_at), new Date(lead.created_at));
                totalResponseDays += days;
                responseCount++;
              }
            });
            const avgResponseTime = responseCount > 0 ? totalResponseDays / responseCount : 0;

            // Follow-up completion rate
            const completedFollowUps = userFollowUps.filter((f: { is_completed: boolean }) => f.is_completed).length;
            const followUpRate = userFollowUps.length > 0 ? (completedFollowUps / userFollowUps.length) * 100 : 0;

            // Task completion rate
            const completedTasks = userTasks.filter((t: { is_completed: boolean }) => t.is_completed).length;
            const taskRate = userTasks.length > 0 ? (completedTasks / userTasks.length) * 100 : 0;

            // Efficiency score (activities per lead)
            const efficiency = leadsPerUser[uid] ? userActivities.length / leadsPerUser[uid] : 0;

            return {
              name: names[uid] ?? uid.slice(0, 8),
              responseTime: Math.round(avgResponseTime * 10) / 10,
              followUpRate: Math.round(followUpRate),
              taskRate: Math.round(taskRate),
              efficiency: Math.round(efficiency * 10) / 10,
            };
          }).sort((a, b) => b.efficiency - a.efficiency);
          setEmployeeProductivity(empProductivity);

          // NEW: Overall productivity metrics
          const totalResponseTime = empProductivity.reduce((sum, e) => sum + e.responseTime, 0);
          const avgResponseTime = empProductivity.length > 0 ? totalResponseTime / empProductivity.length : 0;
          const totalFollowUpRate = empProductivity.reduce((sum, e) => sum + e.followUpRate, 0);
          const avgFollowUpRate = empProductivity.length > 0 ? totalFollowUpRate / empProductivity.length : 0;
          const totalTaskRate = empProductivity.reduce((sum, e) => sum + e.taskRate, 0);
          const avgTaskRate = empProductivity.length > 0 ? totalTaskRate / empProductivity.length : 0;
          const daysWithData = 30;
          const dailyActivityAvg = activities.length / daysWithData;
          const leadsPerDay = leadList.length / daysWithData;
          const activitiesPerLead = leadList.length > 0 ? activities.length / leadList.length : 0;

          setProductivityMetrics({
            avgResponseTime: Math.round(avgResponseTime * 10) / 10,
            followUpCompletionRate: Math.round(avgFollowUpRate),
            taskCompletionRate: Math.round(avgTaskRate),
            dailyActivityAvg: Math.round(dailyActivityAvg * 10) / 10,
            leadsPerDay: Math.round(leadsPerDay * 10) / 10,
            activitiesPerLead: Math.round(activitiesPerLead * 10) / 10,
          });

          // NEW: Time distribution (hourly activity)
          const hourCounts: Record<number, number> = {};
          activities.forEach((a: { created_at: string }) => {
            const hour = new Date(a.created_at).getHours();
            hourCounts[hour] = (hourCounts[hour] ?? 0) + 1;
          });
          const timeDistData = Array.from({ length: 24 }, (_, i) => ({
            hour: `${i}:00`,
            activities: hourCounts[i] ?? 0,
          })).filter(d => d.activities > 0);
          setTimeDistribution(timeDistData);

          // NEW: Weekly productivity
          const last7Days = Array.from({ length: 7 }, (_, i) => subDays(new Date(), 6 - i));
          const weeklyData = last7Days.map(day => {
            const start = startOfDay(day);
            const end = endOfDay(day);
            const dayActivities = activities.filter((a: { created_at: string }) => {
              const d = new Date(a.created_at);
              return d >= start && d <= end;
            }).length;
            const dayTasks = tasks.filter((t: { created_at: string }) => {
              const d = new Date(t.created_at);
              return d >= start && d <= end;
            }).length;
            const dayFollowUps = followUps.filter((f: { created_at: string }) => {
              const d = new Date(f.created_at);
              return d >= start && d <= end;
            }).length;
            return {
              day: format(day, 'EEE'),
              activities: dayActivities,
              tasks: dayTasks,
              followUps: dayFollowUps,
            };
          });
          setWeeklyProductivity(weeklyData);

          // NEW: Lead velocity (avg days in each stage)
          const stageVelocity: Record<string, { total: number; count: number }> = {};
          (allLeadsForConv.data ?? []).forEach((l: { status_id: string | null; created_at: string }) => {
            if (!l.status_id) return;
            const stageName = statusNames[l.status_id] ?? 'Unknown';
            const daysInStage = differenceInDays(new Date(), new Date(l.created_at));
            if (!stageVelocity[stageName]) stageVelocity[stageName] = { total: 0, count: 0 };
            stageVelocity[stageName].total += daysInStage;
            stageVelocity[stageName].count++;
          });
          const velocityData = Object.entries(stageVelocity).map(([stage, { total, count }]) => ({
            stage,
            avgDays: Math.round((total / count) * 10) / 10,
          }));
          setLeadVelocity(velocityData);

        } else {
          // Employee: Enhanced personal productivity metrics
          const myLeadIds = leadList.map((l: { id?: string }) => l.id).filter(Boolean);
          if (myLeadIds.length > 0) {
            const [myActivitiesRes, myTasksRes, myStatusesRes, myFollowUpsRes] = await Promise.all([
              supabase.from('lead_activities').select('activity_type, created_at, lead_id').in('lead_id', myLeadIds),
              supabase.from('tasks').select('is_completed, created_at, due_date').eq('assignee_id', user.id),
              supabase.from('leads').select('status:lead_statuses(name), created_at').eq('owner_id', user.id),
              supabase.from('follow_ups').select('is_completed, scheduled_at, created_at, completed_at').eq('user_id', user.id),
            ]);

            const myActivities = myActivitiesRes.data ?? [];
            const myTasks = myTasksRes.data ?? [];
            const myFollowUps = myFollowUpsRes.data ?? [];

            // Activity breakdown
            const actCounts = { call: 0, email: 0, meeting: 0, note: 0 };
            myActivities.forEach((a: { activity_type: string }) => {
              if (a.activity_type in actCounts) actCounts[a.activity_type as keyof typeof actCounts]++;
            });
            const colors = { call: 'hsl(var(--primary))', email: 'hsl(var(--accent))', meeting: 'hsl(var(--success))', note: 'hsl(var(--warning))' };
            setMyActivityBreakdown(
              (Object.keys(actCounts) as Array<keyof typeof actCounts>)
                .filter((k) => actCounts[k] > 0)
                .map((k) => ({ name: k, value: actCounts[k], color: colors[k] }))
            );
            const totalAct = Object.values(actCounts).reduce((s, v) => s + v, 0);

            // Average lead score
            const avgScore = leadList.length > 0 ? leadList.reduce((sum: number, l: { lead_score?: number | null }) => sum + (l.lead_score ?? 0), 0) / leadList.length : 0;

            // Tasks completed
            const completed = myTasks.filter((t: { is_completed: boolean }) => t.is_completed).length;

            // Conversion rate
            const won = (myStatusesRes.data ?? []).filter((l: { status?: { name?: string } }) => l.status?.name?.toLowerCase().includes('won')).length;
            const convRate = leadList.length > 0 ? `${Math.round((won / leadList.length) * 100)}%` : '0%';

            setMyPerformance({ totalActivities: totalAct, avgLeadScore: Math.round(avgScore), tasksCompleted: completed, conversionRate: convRate });

            // NEW: Personal productivity metrics
            const completedFollowUps = myFollowUps.filter((f: { is_completed: boolean }) => f.is_completed).length;
            const followUpRate = myFollowUps.length > 0 ? (completedFollowUps / myFollowUps.length) * 100 : 0;
            const taskRate = myTasks.length > 0 ? (completed / myTasks.length) * 100 : 0;
            const daysWithData = 30;
            const dailyActivityAvg = myActivities.length / daysWithData;
            const leadsPerDay = leadList.length / daysWithData;
            const activitiesPerLead = leadList.length > 0 ? myActivities.length / leadList.length : 0;

            // Average response time
            let totalResponseDays = 0;
            let responseCount = 0;
            myLeadIds.forEach(leadId => {
              const lead = leadList.find((l: { id: string }) => l.id === leadId);
              if (!lead) return;
              const firstActivity = myActivities
                .filter((a: { lead_id: string }) => a.lead_id === leadId)
                .sort((a: { created_at: string }, b: { created_at: string }) => 
                  new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                )[0];
              if (firstActivity && lead.created_at) {
                const days = differenceInDays(new Date(firstActivity.created_at), new Date(lead.created_at));
                totalResponseDays += days;
                responseCount++;
              }
            });
            const avgResponseTime = responseCount > 0 ? totalResponseDays / responseCount : 0;

            setProductivityMetrics({
              avgResponseTime: Math.round(avgResponseTime * 10) / 10,
              followUpCompletionRate: Math.round(followUpRate),
              taskCompletionRate: Math.round(taskRate),
              dailyActivityAvg: Math.round(dailyActivityAvg * 10) / 10,
              leadsPerDay: Math.round(leadsPerDay * 10) / 10,
              activitiesPerLead: Math.round(activitiesPerLead * 10) / 10,
            });

            // Time distribution
            const hourCounts: Record<number, number> = {};
            myActivities.forEach((a: { created_at: string }) => {
              const hour = new Date(a.created_at).getHours();
              hourCounts[hour] = (hourCounts[hour] ?? 0) + 1;
            });
            const timeDistData = Array.from({ length: 24 }, (_, i) => ({
              hour: `${i}:00`,
              activities: hourCounts[i] ?? 0,
            })).filter(d => d.activities > 0);
            setTimeDistribution(timeDistData);

            // Weekly productivity
            const last7Days = Array.from({ length: 7 }, (_, i) => subDays(new Date(), 6 - i));
            const weeklyData = last7Days.map(day => {
              const start = startOfDay(day);
              const end = endOfDay(day);
              const dayActivities = myActivities.filter((a: { created_at: string }) => {
                const d = new Date(a.created_at);
                return d >= start && d <= end;
              }).length;
              const dayTasks = myTasks.filter((t: { created_at: string }) => {
                const d = new Date(t.created_at);
                return d >= start && d <= end;
              }).length;
              const dayFollowUps = myFollowUps.filter((f: { created_at: string }) => {
                const d = new Date(f.created_at);
                return d >= start && d <= end;
              }).length;
              return {
                day: format(day, 'EEE'),
                activities: dayActivities,
                tasks: dayTasks,
                followUps: dayFollowUps,
              };
            });
            setWeeklyProductivity(weeklyData);
          }
        }
      } catch (error) {
        console.error('Reports loading error:', error);
        setLoading(false);
      }
    })();
  }, [user?.id, isAdmin]);

  const exportReport = () => {
    const rows = [
      ['Lead status', 'Count'],
      ...byStatus.map((s) => [s.name, String(s.value)]),
      [],
      ['Country', 'Leads'],
      ...byCountry.map((c) => [c.name, String(c.leads)]),
      [],
      ['Productivity Metrics', 'Value'],
      ['Avg Response Time (days)', String(productivityMetrics.avgResponseTime)],
      ['Follow-up Completion Rate', `${productivityMetrics.followUpCompletionRate}%`],
      ['Task Completion Rate', `${productivityMetrics.taskCompletionRate}%`],
      ['Daily Activity Average', String(productivityMetrics.dailyActivityAvg)],
      ['Leads Per Day', String(productivityMetrics.leadsPerDay)],
      ['Activities Per Lead', String(productivityMetrics.activitiesPerLead)],
      ...(isAdmin && teamActivity.length ? [[], ['Team member', 'Activities'], ...teamActivity.map((t) => [t.name, String(t.activities)])] : []),
      ...(isAdmin && employeeProductivity.length ? [[], ['Employee', 'Response Time', 'Follow-up Rate', 'Task Rate', 'Efficiency'], ...employeeProductivity.map((e) => [e.name, String(e.responseTime), `${e.followUpRate}%`, `${e.taskRate}%`, String(e.efficiency)])] : []),
    ];
    const csv = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `productivity-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Report exported' });
  };

  return (
    <AppLayout>
      <div className="space-y-8">
        <div className="animate-fade-in-up flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground tracking-tight">
              {isAdmin ? 'Team Productivity & Analytics' : 'My Performance & Productivity'}
            </h1>
            <p className="text-muted-foreground mt-1.5">
              {isAdmin ? 'Comprehensive team insights and productivity metrics' : 'Track your performance and productivity'}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={exportReport} className="gap-2">
            <Download className="h-4 w-4" />
            Export Report
          </Button>
        </div>

        {loading ? (
          <Skeleton className="h-80 w-full rounded-xl animate-fade-in-up animate-fade-in-up-delay-1" />
        ) : (
          <>
            {/* Productivity KPI Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 animate-fade-in-up animate-fade-in-up-delay-2">
              <Card className="card-shadow rounded-xl border-border/80 animate-inner-card-hover">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Avg Response</p>
                      <p className="text-2xl font-bold text-primary">{productivityMetrics.avgResponseTime}d</p>
                    </div>
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Timer className="h-5 w-5 text-primary" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="card-shadow rounded-xl border-border/80 animate-inner-card-hover">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Follow-up Rate</p>
                      <p className="text-2xl font-bold text-success">{productivityMetrics.followUpCompletionRate}%</p>
                    </div>
                    <div className="p-2 rounded-lg bg-success/10">
                      <CheckCircle2 className="h-5 w-5 text-success" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="card-shadow rounded-xl border-border/80 animate-inner-card-hover">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Task Rate</p>
                      <p className="text-2xl font-bold text-accent">{productivityMetrics.taskCompletionRate}%</p>
                    </div>
                    <div className="p-2 rounded-lg bg-accent/10">
                      <CheckCircle2 className="h-5 w-5 text-accent" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="card-shadow rounded-xl border-border/80 animate-inner-card-hover">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Daily Activity</p>
                      <p className="text-2xl font-bold text-warning">{productivityMetrics.dailyActivityAvg}</p>
                    </div>
                    <div className="p-2 rounded-lg bg-warning/10">
                      <Zap className="h-5 w-5 text-warning" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="card-shadow rounded-xl border-border/80 animate-inner-card-hover">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Leads/Day</p>
                      <p className="text-2xl font-bold text-blue-500">{productivityMetrics.leadsPerDay}</p>
                    </div>
                    <div className="p-2 rounded-lg bg-blue-500/10">
                      <TrendingUp className="h-5 w-5 text-blue-500" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="card-shadow rounded-xl border-border/80 animate-inner-card-hover">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Activity/Lead</p>
                      <p className="text-2xl font-bold text-purple-500">{productivityMetrics.activitiesPerLead}</p>
                    </div>
                    <div className="p-2 rounded-lg bg-purple-500/10">
                      <Activity className="h-5 w-5 text-purple-500" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              {/* Weekly Productivity Trend */}
              <Card className="card-shadow rounded-xl border-border/80 animate-inner-card-hover lg:col-span-2 animate-fade-in-up animate-fade-in-up-delay-3">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 font-display">
                    <Calendar className="h-5 w-5" />
                    Weekly Productivity Overview
                  </CardTitle>
                  <CardDescription>Last 7 days activity breakdown</CardDescription>
                </CardHeader>
                <CardContent>
                  {weeklyProductivity.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-8 text-center">No data</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={300}>
                      <AreaChart data={weeklyProductivity} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorActivities" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="colorTasks" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="colorFollowUps" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--accent))" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="hsl(var(--accent))" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Legend />
                        <Area type="monotone" dataKey="activities" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorActivities)" />
                        <Area type="monotone" dataKey="tasks" stroke="hsl(var(--success))" fillOpacity={1} fill="url(#colorTasks)" />
                        <Area type="monotone" dataKey="followUps" stroke="hsl(var(--accent))" fillOpacity={1} fill="url(#colorFollowUps)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              {/* Time Distribution */}
              {timeDistribution.length > 0 && (
                <Card className="card-shadow rounded-xl border-border/80 animate-inner-card-hover animate-fade-in-up animate-fade-in-up-delay-4">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 font-display">
                      <Clock className="h-5 w-5" />
                      Activity Time Distribution
                    </CardTitle>
                    <CardDescription>When activities happen most</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={timeDistribution} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="hour" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Bar dataKey="activities" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {/* Lead Velocity */}
              {isAdmin && leadVelocity.length > 0 && (
                <Card className="card-shadow rounded-xl border-border/80 animate-inner-card-hover animate-fade-in-up animate-fade-in-up-delay-5">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 font-display">
                      <TrendingUp className="h-5 w-5" />
                      Lead Velocity by Stage
                    </CardTitle>
                    <CardDescription>Average days in each stage</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={leadVelocity} layout="vertical" margin={{ left: 80 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis type="number" />
                        <YAxis dataKey="stage" type="category" width={70} tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Bar dataKey="avgDays" fill="hsl(var(--warning))" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {/* Leads by Status */}
              <Card className="card-shadow rounded-xl border-border/80 animate-inner-card-hover animate-fade-in-up animate-fade-in-up-delay-6">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 font-display">
                    <PieChart className="h-5 w-5" />
                    Leads by Status
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {byStatus.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-8 text-center">No data</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={260}>
                      <RechartsPie>
                        <Pie data={byStatus} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${name}: ${value}`}>
                          {byStatus.map((entry, i) => (
                            <Cell key={i} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </RechartsPie>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              {/* Leads by Country */}
              <Card className="card-shadow rounded-xl border-border/80 animate-inner-card-hover animate-fade-in-up animate-fade-in-up-delay-7">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 font-display">
                    <BarChart3 className="h-5 w-5" />
                    Leads by Country
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {byCountry.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-8 text-center">No data</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={byCountry} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Bar dataKey="leads" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              {/* Admin: Employee Productivity Table */}
              {isAdmin && employeeProductivity.length > 0 && (
                <Card className="card-shadow rounded-xl border-border/80 animate-inner-card-hover lg:col-span-2 animate-fade-in-up animate-fade-in-up-delay-8">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 font-display">
                      <Users className="h-5 w-5" />
                      Employee Productivity Scorecard
                    </CardTitle>
                    <CardDescription>Detailed performance metrics for each team member</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-3 px-2 font-semibold">Employee</th>
                            <th className="text-right py-3 px-2 font-semibold">Response Time</th>
                            <th className="text-right py-3 px-2 font-semibold">Follow-up Rate</th>
                            <th className="text-right py-3 px-2 font-semibold">Task Rate</th>
                            <th className="text-right py-3 px-2 font-semibold">Efficiency</th>
                          </tr>
                        </thead>
                        <tbody>
                          {employeeProductivity.map((e, idx) => (
                            <tr key={idx} className="border-b last:border-0 hover:bg-accent/10">
                              <td className="py-3 px-2 font-medium">{e.name}</td>
                              <td className="py-3 px-2 text-right">
                                <Badge variant={e.responseTime <= 1 ? 'default' : e.responseTime <= 3 ? 'secondary' : 'destructive'}>
                                  {e.responseTime}d
                                </Badge>
                              </td>
                              <td className="py-3 px-2 text-right">
                                <Badge variant={e.followUpRate >= 80 ? 'default' : e.followUpRate >= 60 ? 'secondary' : 'destructive'}>
                                  {e.followUpRate}%
                                </Badge>
                              </td>
                              <td className="py-3 px-2 text-right">
                                <Badge variant={e.taskRate >= 80 ? 'default' : e.taskRate >= 60 ? 'secondary' : 'destructive'}>
                                  {e.taskRate}%
                                </Badge>
                              </td>
                              <td className="py-3 px-2 text-right font-semibold text-primary">{e.efficiency}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Admin: Activity Trends */}
              {isAdmin && activityTrends.length > 0 && (
                <Card className="card-shadow rounded-xl border-border/80 animate-inner-card-hover lg:col-span-2 animate-fade-in-up animate-fade-in-up-delay-9">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 font-display">
                      <TrendingUp className="h-5 w-5" />
                      Activity Trends (14 Days)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={280}>
                      <LineChart data={activityTrends} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="calls" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
                        <Line type="monotone" dataKey="emails" stroke="hsl(var(--accent))" strokeWidth={2} dot={{ r: 3 }} />
                        <Line type="monotone" dataKey="meetings" stroke="hsl(var(--success))" strokeWidth={2} dot={{ r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {/* Admin: Top Performers */}
              {isAdmin && topPerformers.length > 0 && (
                <Card className="card-shadow rounded-xl border-border/80 animate-inner-card-hover lg:col-span-2 animate-fade-in-up animate-fade-in-up-delay-10">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 font-display">
                      <Award className="h-5 w-5" />
                      Top Performers
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-3 px-2 font-semibold">Team Member</th>
                            <th className="text-right py-3 px-2 font-semibold">Activities</th>
                            <th className="text-right py-3 px-2 font-semibold">Leads</th>
                            <th className="text-right py-3 px-2 font-semibold">Conversion Rate</th>
                          </tr>
                        </thead>
                        <tbody>
                          {topPerformers.map((p, idx) => (
                            <tr key={idx} className="border-b last:border-0 hover:bg-accent/10">
                              <td className="py-3 px-2 font-medium">
                                {idx === 0 && <Award className="inline h-4 w-4 text-yellow-500 mr-2" />}
                                {p.name}
                              </td>
                              <td className="py-3 px-2 text-right">{p.activities}</td>
                              <td className="py-3 px-2 text-right">{p.leads}</td>
                              <td className="py-3 px-2 text-right">
                                <span className="inline-flex items-center px-2 py-1 rounded-md bg-primary/10 text-primary font-semibold text-xs">
                                  {p.conversionRate}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Employee: Activity Breakdown */}
              {!isAdmin && myActivityBreakdown.length > 0 && (
                <Card className="card-shadow rounded-xl border-border/80 animate-inner-card-hover animate-fade-in-up animate-fade-in-up-delay-8">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 font-display">
                      <Activity className="h-5 w-5" />
                      My Activity Breakdown
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={260}>
                      <RechartsPie>
                        <Pie data={myActivityBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${name}: ${value}`}>
                          {myActivityBreakdown.map((entry, i) => (
                            <Cell key={i} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </RechartsPie>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {/* Employee: Performance Summary */}
              {!isAdmin && (
                <Card className="card-shadow rounded-xl border-border/80 animate-inner-card-hover animate-fade-in-up animate-fade-in-up-delay-9">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 font-display">
                      <Award className="h-5 w-5" />
                      Performance Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                        <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Total Activities</p>
                        <p className="text-2xl font-bold text-primary">{myPerformance.totalActivities}</p>
                      </div>
                      <div className="p-4 rounded-lg bg-success/5 border border-success/20">
                        <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Avg Lead Score</p>
                        <p className="text-2xl font-bold text-success">{myPerformance.avgLeadScore}</p>
                      </div>
                      <div className="p-4 rounded-lg bg-accent/5 border border-accent/20">
                        <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Tasks Completed</p>
                        <p className="text-2xl font-bold text-accent">{myPerformance.tasksCompleted}</p>
                      </div>
                      <div className="p-4 rounded-lg bg-warning/5 border border-warning/20">
                        <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Conversion Rate</p>
                        <p className="text-2xl font-bold text-warning">{myPerformance.conversionRate}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
