import { Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { KPICard } from '@/components/dashboard/KPICard';
import { LeadsChart } from '@/components/dashboard/LeadsChart';
import { RecentActivity } from '@/components/dashboard/RecentActivity';
import { WorldDemographics } from '@/components/dashboard/WorldDemographics';
import { useDashboardData } from '@/hooks/useDashboardData';
import { Users, Target, Flame, CheckSquare, Calendar, Bell, ArrowRight, TrendingUp, Activity, Award } from 'lucide-react';
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
    topPerformers,
    myActivityBreakdown,
    myTasksCompleted,
    myTasksTotal,
    worldDemographics,
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
      <div className="space-y-8 relative">
        {/* Header with subtle gradient glow (login theme) */}
        <div className="relative rounded-2xl border border-border/60 bg-card/50 backdrop-blur-sm px-6 py-5 animate-fade-in-up">
          <div className="absolute inset-0 rounded-2xl bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,hsl(var(--primary)/0.08),transparent)] pointer-events-none" />
          <div className="relative">
            <h1 className="text-2xl font-display font-bold text-foreground tracking-tight">
              {isAdmin ? 'Admin Dashboard' : 'My Dashboard'}
            </h1>
            <p className="text-muted-foreground mt-1.5">
              {isAdmin ? 'Overview of all team activities and leads' : 'Your personal performance overview'}
            </p>
          </div>
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
        <div className="grid gap-6 lg:grid-cols-[1fr_1fr] lg:items-stretch">
          <div className="animate-fade-in-up animate-fade-in-up-delay-2 min-h-0 min-w-0 flex w-full">
            <LeadsChart
              isAdmin={isAdmin}
              statusData={statusData}
              countryData={countryData}
              activityData={activityData}
              loading={loading}
            />
          </div>
          <div className="animate-fade-in-up animate-fade-in-up-delay-3 min-h-0 min-w-0 flex w-full">
            <RecentActivity activities={recentActivities} loading={loading} />
          </div>
        </div>

        {/* World Demographics Map */}
        <div className="animate-fade-in-up animate-fade-in-up-delay-4">
          <WorldDemographics data={worldDemographics} loading={loading} />
        </div>

        {/* Employee: Upcoming Tasks & Reminders + My Hot Leads */}
        {!isAdmin && (
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="card-shadow rounded-xl border-border/80 animate-inner-card-hover animate-fade-in-up animate-fade-in-up-delay-4">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 font-display">
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
            <Card className="card-shadow rounded-xl border-border/80 animate-inner-card-hover animate-fade-in-up animate-fade-in-up-delay-5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 font-display">
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
          <Card className="card-shadow rounded-xl border-border/80 animate-inner-card-hover animate-fade-in-up animate-fade-in-up-delay-4">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="font-display">Quick Access — Leads</CardTitle>
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

        {/* Admin: Top Performers */}
        {isAdmin && (
          <Card className="card-shadow rounded-xl border-border/80 animate-inner-card-hover animate-fade-in-up animate-fade-in-up-delay-5">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Award className="h-5 w-5 text-primary" />
                <CardTitle className="font-display">Top Performers</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-32 w-full" />
              ) : topPerformers.length === 0 ? (
                <p className="text-sm text-muted-foreground">No data yet.</p>
              ) : (
                <div className="space-y-3">
                  {topPerformers.map((performer, idx) => (
                    <div
                      key={performer.userId}
                      className="flex items-center justify-between p-3 rounded-lg bg-accent/20 border border-border/50"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-semibold text-sm">
                          {idx + 1}
                        </div>
                        <div>
                          <p className="font-medium">{performer.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {performer.leads} lead{performer.leads !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="gap-1">
                          <Activity className="h-3 w-3" />
                          {performer.activities}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Employee: My Activity Breakdown */}
        {!isAdmin && (
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="card-shadow rounded-xl border-border/80 animate-inner-card-hover animate-fade-in-up animate-fade-in-up-delay-6">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  <CardTitle className="font-display">My Activity Breakdown</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-48 w-full" />
                ) : myActivityBreakdown.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No activities yet.</p>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-center h-48">
                      <svg viewBox="0 0 200 200" className="w-full h-full max-w-[200px]">
                        {(() => {
                          const total = myActivityBreakdown.reduce((sum, item) => sum + item.count, 0);
                          let currentAngle = -90;
                          return myActivityBreakdown.map((item) => {
                            const percentage = (item.count / total) * 100;
                            const angle = (percentage / 100) * 360;
                            const startAngle = currentAngle;
                            const endAngle = currentAngle + angle;
                            currentAngle = endAngle;

                            const startX = 100 + 80 * Math.cos((startAngle * Math.PI) / 180);
                            const startY = 100 + 80 * Math.sin((startAngle * Math.PI) / 180);
                            const endX = 100 + 80 * Math.cos((endAngle * Math.PI) / 180);
                            const endY = 100 + 80 * Math.sin((endAngle * Math.PI) / 180);
                            const largeArc = angle > 180 ? 1 : 0;

                            return (
                              <path
                                key={item.type}
                                d={`M 100 100 L ${startX} ${startY} A 80 80 0 ${largeArc} 1 ${endX} ${endY} Z`}
                                fill={item.color}
                                opacity="0.9"
                              />
                            );
                          });
                        })()}
                        <circle cx="100" cy="100" r="50" fill="hsl(var(--card))" />
                      </svg>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {myActivityBreakdown.map((item) => (
                        <div key={item.type} className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: item.color }}
                          />
                          <span className="text-sm capitalize">{item.type}s: {item.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="card-shadow rounded-xl border-border/80 animate-inner-card-hover animate-fade-in-up animate-fade-in-up-delay-6">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <CheckSquare className="h-5 w-5 text-success" />
                  <CardTitle className="font-display">Task Completion</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-48 w-full" />
                ) : (
                  <div className="space-y-4">
                    <div className="text-center py-6">
                      <div className="text-5xl font-bold text-primary mb-2">
                        {myTasksTotal > 0 ? Math.round((myTasksCompleted / myTasksTotal) * 100) : 0}%
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {myTasksCompleted} of {myTasksTotal} tasks completed
                      </p>
                    </div>
                    <div className="w-full bg-secondary/30 rounded-full h-3 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-primary to-primary/70 h-full rounded-full transition-all duration-500"
                        style={{
                          width: myTasksTotal > 0 ? `${(myTasksCompleted / myTasksTotal) * 100}%` : '0%',
                        }}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
