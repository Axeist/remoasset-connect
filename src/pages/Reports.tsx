import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { BarChart3, Download, PieChart, TrendingUp, Activity, Award, Target } from 'lucide-react';
import { PieChart as RechartsPie, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';

export default function Reports() {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const isAdmin = role === 'admin';
  const [loading, setLoading] = useState(true);
  const [byStatus, setByStatus] = useState<{ name: string; value: number; color: string }[]>([]);
  const [byCountry, setByCountry] = useState<{ name: string; leads: number }[]>([]);
  const [teamActivity, setTeamActivity] = useState<{ name: string; activities: number }[]>([]);
  const [leadScoreDistribution, setLeadScoreDistribution] = useState<{ range: string; count: number }[]>([]);
  const [activityTrends, setActivityTrends] = useState<{ date: string; calls: number; emails: number; meetings: number }[]>([]);
  const [topPerformers, setTopPerformers] = useState<{ name: string; activities: number; leads: number; conversionRate: string }[]>([]);
  const [myActivityBreakdown, setMyActivityBreakdown] = useState<{ name: string; value: number; color: string }[]>([]);
  const [myPerformance, setMyPerformance] = useState({ totalActivities: 0, avgLeadScore: 0, tasksCompleted: 0, conversionRate: '0%' });

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        // Batch 1: Fetch basic data in parallel
        const leadsQuery = supabase.from('leads').select('id, status_id, country_id, owner_id, lead_score');
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

        // Batch 2: Fetch additional analytics in background
        if (isAdmin) {
          // Fetch all admin analytics in parallel
          const [activitiesRes, allLeadsForConv, statusesForConv] = await Promise.all([
            supabase.from('lead_activities').select('user_id, activity_type, created_at'),
            supabase.from('leads').select('owner_id, status_id'),
            supabase.from('lead_statuses').select('id, name'),
          ]);

          const activities = activitiesRes.data ?? [];
          const counts: Record<string, number> = {};
          activities.forEach((a: { user_id: string }) => {
            counts[a.user_id] = (counts[a.user_id] ?? 0) + 1;
          });
          const userIds = Object.keys(counts);
          
          // Fetch profiles for users with activities
          let names: Record<string, string> = {};
          if (userIds.length > 0) {
            const { data: profiles } = await supabase.from('profiles').select('user_id, full_name').in('user_id', userIds);
            names = (profiles ?? []).reduce((acc, p) => { acc[p.user_id] = p.full_name || 'Unknown'; return acc; }, {} as Record<string, string>);
            setTeamActivity(userIds.map((uid) => ({ name: names[uid] ?? uid.slice(0, 8), activities: counts[uid] })));
          }

          // Lead score distribution (from existing leadList)
          const scoreCounts = { '0-25': 0, '26-50': 0, '51-75': 0, '76-100': 0 };
          leadList.forEach((l: { lead_score?: number | null }) => {
            const score = l.lead_score ?? 0;
            if (score <= 25) scoreCounts['0-25']++;
            else if (score <= 50) scoreCounts['26-50']++;
            else if (score <= 75) scoreCounts['51-75']++;
            else scoreCounts['76-100']++;
          });
          setLeadScoreDistribution(Object.entries(scoreCounts).map(([range, count]) => ({ range, count })));

          // Activity trends over last 14 days (optimized - process all at once)
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
        } else {
          // Employee: My activity breakdown + performance summary
          const myLeadIds = leadList.map((l: { id?: string }) => l.id).filter(Boolean);
          if (myLeadIds.length > 0) {
            const [myActivitiesRes, myTasksRes, myStatusesRes] = await Promise.all([
              supabase.from('lead_activities').select('activity_type').in('lead_id', myLeadIds),
              supabase.from('tasks').select('is_completed').eq('assignee_id', user.id),
              supabase.from('leads').select('status:lead_statuses(name)').eq('owner_id', user.id),
            ]);

            // Activity breakdown
            const actCounts = { call: 0, email: 0, meeting: 0, note: 0 };
            (myActivitiesRes.data ?? []).forEach((a: { activity_type: string }) => {
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
            const completed = (myTasksRes.data ?? []).filter((t: { is_completed: boolean }) => t.is_completed).length;

            // Conversion rate
            const won = (myStatusesRes.data ?? []).filter((l: { status?: { name?: string } }) => l.status?.name?.toLowerCase().includes('won')).length;
            const convRate = leadList.length > 0 ? `${Math.round((won / leadList.length) * 100)}%` : '0%';

            setMyPerformance({ totalActivities: totalAct, avgLeadScore: Math.round(avgScore), tasksCompleted: completed, conversionRate: convRate });
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
      ...(isAdmin && teamActivity.length ? [[], ['Team member', 'Activities'], ...teamActivity.map((t) => [t.name, String(t.activities)])] : []),
      ...(isAdmin && leadScoreDistribution.length ? [[], ['Lead score range', 'Count'], ...leadScoreDistribution.map((d) => [d.range, String(d.count)])] : []),
      ...(isAdmin && topPerformers.length ? [[], ['Top performer', 'Activities', 'Leads', 'Conversion rate'], ...topPerformers.map((p) => [p.name, String(p.activities), String(p.leads), p.conversionRate])] : []),
      ...(!isAdmin && myActivityBreakdown.length ? [[], ['Activity type', 'Count'], ...myActivityBreakdown.map((a) => [a.name, String(a.value)])] : []),
      ...(!isAdmin ? [[], ['Performance metric', 'Value'], ['Total activities', String(myPerformance.totalActivities)], ['Avg lead score', String(myPerformance.avgLeadScore)], ['Tasks completed', String(myPerformance.tasksCompleted)], ['Conversion rate', myPerformance.conversionRate]] : []),
    ];
    const csv = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reports-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Report exported' });
  };

  return (
    <AppLayout>
      <div className="space-y-8">
        <div className="animate-fade-in-up flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground tracking-tight">Reports</h1>
            <p className="text-muted-foreground mt-1.5">
              {isAdmin ? 'Pipeline and team analytics' : 'Your pipeline summary'}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={exportReport} className="gap-2">
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>

        {loading ? (
          <Skeleton className="h-80 w-full rounded-xl animate-fade-in-up animate-fade-in-up-delay-1" />
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="card-shadow rounded-xl border-border/80 animate-inner-card-hover animate-fade-in-up animate-fade-in-up-delay-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 font-display">
                  <PieChart className="h-5 w-5" />
                  Leads by status
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

            <Card className="card-shadow rounded-xl border-border/80 animate-inner-card-hover animate-fade-in-up animate-fade-in-up-delay-3">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 font-display">
                  <BarChart3 className="h-5 w-5" />
                  Leads by country
                </CardTitle>
              </CardHeader>
              <CardContent>
                {byCountry.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">No data</p>
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={byCountry} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
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

            {isAdmin && teamActivity.length > 0 && (
              <Card className="card-shadow rounded-xl border-border/80 animate-inner-card-hover lg:col-span-2 animate-fade-in-up animate-fade-in-up-delay-4">
                <CardHeader>
                  <CardTitle className="font-display">Team activity</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={teamActivity} layout="vertical" margin={{ left: 80 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis type="number" />
                      <YAxis dataKey="name" type="category" width={70} tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Bar dataKey="activities" fill="hsl(var(--accent))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* Admin: Lead Score Distribution */}
            {isAdmin && leadScoreDistribution.length > 0 && (
              <Card className="card-shadow rounded-xl border-border/80 animate-inner-card-hover animate-fade-in-up animate-fade-in-up-delay-5">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 font-display">
                    <Target className="h-5 w-5" />
                    Lead score distribution
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={leadScoreDistribution} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="range" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Bar dataKey="count" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* Admin: Activity Trends */}
            {isAdmin && activityTrends.length > 0 && (
              <Card className="card-shadow rounded-xl border-border/80 animate-inner-card-hover animate-fade-in-up animate-fade-in-up-delay-6">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 font-display">
                    <TrendingUp className="h-5 w-5" />
                    Activity trends (14 days)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={activityTrends} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
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

            {/* Admin: Top Performers Table */}
            {isAdmin && topPerformers.length > 0 && (
              <Card className="card-shadow rounded-xl border-border/80 animate-inner-card-hover lg:col-span-2 animate-fade-in-up animate-fade-in-up-delay-7">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 font-display">
                    <Award className="h-5 w-5" />
                    Top performers
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-3 px-2 font-semibold">Team member</th>
                          <th className="text-right py-3 px-2 font-semibold">Activities</th>
                          <th className="text-right py-3 px-2 font-semibold">Leads</th>
                          <th className="text-right py-3 px-2 font-semibold">Conversion rate</th>
                        </tr>
                      </thead>
                      <tbody>
                        {topPerformers.map((p, idx) => (
                          <tr key={idx} className="border-b last:border-0 hover:bg-accent/10">
                            <td className="py-3 px-2 font-medium">{p.name}</td>
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

            {/* Employee: My Activity Breakdown */}
            {!isAdmin && myActivityBreakdown.length > 0 && (
              <Card className="card-shadow rounded-xl border-border/80 animate-inner-card-hover animate-fade-in-up animate-fade-in-up-delay-5">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 font-display">
                    <Activity className="h-5 w-5" />
                    My activity breakdown
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
              <Card className="card-shadow rounded-xl border-border/80 animate-inner-card-hover animate-fade-in-up animate-fade-in-up-delay-6">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 font-display">
                    <Award className="h-5 w-5" />
                    My performance summary
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Total activities</p>
                      <p className="text-2xl font-bold text-primary">{myPerformance.totalActivities}</p>
                    </div>
                    <div className="p-4 rounded-lg bg-success/5 border border-success/20">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Avg lead score</p>
                      <p className="text-2xl font-bold text-success">{myPerformance.avgLeadScore}</p>
                    </div>
                    <div className="p-4 rounded-lg bg-accent/5 border border-accent/20">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Tasks completed</p>
                      <p className="text-2xl font-bold text-accent">{myPerformance.tasksCompleted}</p>
                    </div>
                    <div className="p-4 rounded-lg bg-warning/5 border border-warning/20">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Conversion rate</p>
                      <p className="text-2xl font-bold text-warning">{myPerformance.conversionRate}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
