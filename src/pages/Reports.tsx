import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { BarChart3, Download, PieChart } from 'lucide-react';
import { PieChart as RechartsPie, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function Reports() {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const isAdmin = role === 'admin';
  const [loading, setLoading] = useState(true);
  const [byStatus, setByStatus] = useState<{ name: string; value: number; color: string }[]>([]);
  const [byCountry, setByCountry] = useState<{ name: string; leads: number }[]>([]);
  const [teamActivity, setTeamActivity] = useState<{ name: string; activities: number }[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const leadsQuery = supabase.from('leads').select('status_id, country_id, owner_id');
      if (!isAdmin) {
        leadsQuery.eq('owner_id', user.id);
      }
      const { data: leads } = await leadsQuery;
      const leadList = leads ?? [];

      const { data: statusRows } = await supabase.from('lead_statuses').select('id, name, color');
      const statusMap = (statusRows ?? []).reduce((acc, s) => { acc[s.id] = { name: s.name, color: s.color }; return acc; }, {} as Record<string, { name: string; color: string }>);
      const statusCounts: Record<string, { count: number; color: string }> = {};
      leadList.forEach((l: { status_id: string | null }) => {
        const s = l.status_id ? statusMap[l.status_id] : null;
        const name = s?.name ?? 'Unassigned';
        const color = s?.color ?? '#6B7280';
        if (!statusCounts[name]) statusCounts[name] = { count: 0, color };
        statusCounts[name].count++;
      });
      setByStatus(Object.entries(statusCounts).map(([name, { count, color }]) => ({ name, value: count, color })));

      const { data: countryRows } = await supabase.from('countries').select('id, code');
      const countryMap = (countryRows ?? []).reduce((acc, c) => { acc[c.id] = c.code; return acc; }, {} as Record<string, string>);
      const countryCounts: Record<string, number> = {};
      leadList.forEach((l: { country_id: string | null }) => {
        const code = l.country_id ? (countryMap[l.country_id] ?? 'Other') : 'Other';
        countryCounts[code] = (countryCounts[code] ?? 0) + 1;
      });
      setByCountry(Object.entries(countryCounts).map(([name, leads]) => ({ name, leads })));

      if (isAdmin) {
        const { data: activities } = await supabase.from('lead_activities').select('user_id');
        const counts: Record<string, number> = {};
        (activities ?? []).forEach((a: { user_id: string }) => {
          counts[a.user_id] = (counts[a.user_id] ?? 0) + 1;
        });
        const userIds = Object.keys(counts);
        if (userIds.length > 0) {
          const { data: profiles } = await supabase.from('profiles').select('user_id, full_name').in('user_id', userIds);
          const names = (profiles ?? []).reduce((acc, p) => { acc[p.user_id] = p.full_name || 'Unknown'; return acc; }, {} as Record<string, string>);
          setTeamActivity(userIds.map((uid) => ({ name: names[uid] ?? uid.slice(0, 8), activities: counts[uid] })));
        }
      }
      setLoading(false);
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
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">Reports</h1>
            <p className="text-muted-foreground mt-1">
              {isAdmin ? 'Pipeline and team analytics' : 'Your pipeline summary'}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={exportReport} className="gap-2">
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>

        {loading ? (
          <Skeleton className="h-80 w-full rounded-xl" />
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="card-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
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

            <Card className="card-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
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
              <Card className="card-shadow lg:col-span-2">
                <CardHeader>
                  <CardTitle>Team activity</CardTitle>
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
          </div>
        )}
      </div>
    </AppLayout>
  );
}
