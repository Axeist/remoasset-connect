import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { KPICard } from '@/components/dashboard/KPICard';
import { LeadsChart } from '@/components/dashboard/LeadsChart';
import { RecentActivity } from '@/components/dashboard/RecentActivity';
import { Users, Target, Flame, CheckSquare } from 'lucide-react';

export default function Dashboard() {
  const { role } = useAuth();
  const isAdmin = role === 'admin';

  const kpis = isAdmin ? [
    { title: 'Total Leads', value: '156', change: '+12%', icon: Users, variant: 'primary' as const },
    { title: 'Conversion Rate', value: '24.5%', change: '+3.2%', icon: Target, variant: 'success' as const },
    { title: 'Hot Leads', value: '28', change: '+5', icon: Flame, variant: 'accent' as const },
    { title: 'Tasks Due', value: '12', change: '-3', icon: CheckSquare, variant: 'warning' as const },
  ] : [
    { title: 'My Leads', value: '34', change: '+4', icon: Users, variant: 'primary' as const },
    { title: 'Tasks Due Today', value: '5', change: '0', icon: CheckSquare, variant: 'accent' as const },
    { title: 'Follow-ups', value: '8', change: '+2', icon: Target, variant: 'success' as const },
    { title: 'Hot Leads', value: '7', change: '+1', icon: Flame, variant: 'warning' as const },
  ];

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">
            {isAdmin ? 'Admin Dashboard' : 'My Dashboard'}
          </h1>
          <p className="text-muted-foreground mt-1">
            {isAdmin ? 'Overview of all team activities and leads' : 'Your personal performance overview'}
          </p>
        </div>

        {/* KPI Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {kpis.map((kpi) => (
            <KPICard key={kpi.title} {...kpi} />
          ))}
        </div>

        {/* Charts & Activity */}
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <LeadsChart isAdmin={isAdmin} />
          </div>
          <div>
            <RecentActivity />
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
