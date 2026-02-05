import { Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { KPICard } from '@/components/dashboard/KPICard';
import { LeadsChart } from '@/components/dashboard/LeadsChart';
import { RecentActivity } from '@/components/dashboard/RecentActivity';
import { useDashboardData } from '@/hooks/useDashboardData';
import { Users, Target, Flame, CheckSquare, Calendar, Bell, ArrowRight } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';

export default function Dashboard() {
  const {
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
  } = useDashboardData();

  const kpiCards = isAdmin
    ? [
        { title: 'Total Leads', value: String(kpis.totalLeads), change: '', icon: Users, variant: 'primary' as const },
        { title: 'Conversion Rate', value: kpis.conversionRate, change: '', icon: Target, variant: 'success' as const },
        { title: 'Hot Leads', value: String(kpis.hotLeads), change: '', icon: Flame, variant: 'accent' as const },
        { title: 'Tasks Due', value: String(kpis.tasksDue), change: '', icon: CheckSquare, variant: 'warning' as const },
      ]
    : [
        { title: 'My Leads', value: String(kpis.totalLeads), change: '', icon: Users, variant: 'primary' as const },
        { title: 'Tasks Due Today', value: String(kpis.tasksDue), change: '', icon: CheckSquare, variant: 'accent' as const },
        { title: 'Follow-ups', value: String(kpis.followUps ?? 0), change: '', icon: Target, variant: 'success' as const },
        { title: 'Hot Leads', value: String(kpis.hotLeads), change: '', icon: Flame, variant: 'warning' as const },
      ];

  return (
    <AppLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="animate-fade-in-up">
          <h1 className="text-2xl font-display font-bold text-foreground tracking-tight">
            {isAdmin ? 'Admin Dashboard' : 'My Dashboard'}
          </h1>
          <p className="text-muted-foreground mt-1.5">
            {isAdmin ? 'Overview of all team activities and leads' : 'Your personal performance overview'}
          </p>
        </div>

        {/* KPI Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-32 rounded-xl" />
              ))
            : kpiCards.map((kpi, i) => (
                <div
                  key={kpi.title}
                  className={`animate-fade-in-up opacity-0 ${i === 0 ? 'animate-fade-in-up-delay-1' : i === 1 ? 'animate-fade-in-up-delay-2' : i === 2 ? 'animate-fade-in-up-delay-3' : 'animate-fade-in-up-delay-4'}`}
                >
                  <KPICard {...kpi} />
                </div>
              ))}
        </div>

        {/* Charts & Activity */}
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="animate-fade-in-up animate-fade-in-up-delay-2">
            <LeadsChart
              isAdmin={isAdmin}
              statusData={statusData}
              countryData={countryData}
              activityData={activityData}
              loading={loading}
            />
          </div>
          <div className="animate-fade-in-up animate-fade-in-up-delay-3">
            <RecentActivity activities={recentActivities} loading={loading} />
          </div>
        </div>

        {/* Employee: Upcoming Tasks & Reminders + My Hot Leads */}
        {!isAdmin && (
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="card-shadow rounded-xl border-border/80 animate-inner-card-hover">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Upcoming Tasks & Reminders
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-24 w-full" />
                ) : upcomingTasks.length === 0 && upcomingFollowUps.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nothing upcoming.</p>
                ) : (
                  <ul className="space-y-2">
                    {upcomingTasks.map((t) => (
                      <li key={t.id} className="flex items-center justify-between text-sm">
                        <Link to="/tasks" className="font-medium hover:underline truncate flex-1">
                          {t.title}
                        </Link>
                        <span className="text-muted-foreground shrink-0 ml-2">
                          {t.due_date ? format(new Date(t.due_date), 'MMM d') : '—'}
                        </span>
                      </li>
                    ))}
                    {upcomingFollowUps.map((f) => (
                      <li key={f.id} className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-1.5 truncate flex-1">
                          <Bell className="h-4 w-4 text-muted-foreground" />
                          <Link to="/follow-ups" className="font-medium hover:underline">
                            Follow-up
                          </Link>
                          {f.notes && <span className="text-muted-foreground truncate">— {f.notes}</span>}
                        </span>
                        <span className="text-muted-foreground shrink-0 ml-2">
                          {format(new Date(f.scheduled_at), 'MMM d, HH:mm')}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
            <Card className="card-shadow rounded-xl border-border/80 animate-inner-card-hover">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Flame className="h-5 w-5 text-orange-500" />
                  My Hot Leads
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-24 w-full" />
                ) : hotLeadsList.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No hot leads (score ≥ 70).</p>
                ) : (
                  <ul className="space-y-2">
                    {hotLeadsList.map((l) => (
                      <li key={l.id}>
                        <Link
                          to={`/leads/${l.id}`}
                          className="flex items-center justify-between text-sm hover:bg-muted/50 rounded px-2 py-1.5 -mx-2"
                        >
                          <span className="font-medium truncate">{l.company_name}</span>
                          <Badge variant="secondary" className="shrink-0 ml-2">
                            {l.lead_score ?? 0}
                          </Badge>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Admin: Quick Access leads table */}
        {isAdmin && (
          <Card className="card-shadow rounded-xl border-border/80 animate-inner-card-hover">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Quick Access — Leads</CardTitle>
              <Button variant="outline" size="sm" asChild>
                <Link to="/leads" className="gap-1">
                  View all
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-32 w-full" />
              ) : quickAccessLeads.length === 0 ? (
                <p className="text-sm text-muted-foreground">No leads yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 font-medium">Company</th>
                        <th className="text-left py-2 font-medium">Status</th>
                        <th className="text-right py-2 font-medium">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {quickAccessLeads.map((l) => (
                        <tr key={l.id} className="border-b last:border-0">
                          <td className="py-2 font-medium">{l.company_name}</td>
                          <td className="py-2">
                            {l.status ? (
                              <Badge style={{ backgroundColor: l.status.color }} className="text-white border-0 text-xs">
                                {l.status.name}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="py-2 text-right">
                            <Button variant="ghost" size="sm" asChild>
                              <Link to={`/leads/${l.id}`}>View</Link>
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
