import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Phone, Mail, Calendar, FileText, ExternalLink } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { RecentActivityItem } from '@/hooks/useDashboardData';

const iconMap = {
  call: Phone,
  email: Mail,
  meeting: Calendar,
  note: FileText,
};

const colorMap = {
  call: 'bg-primary/10 text-primary',
  email: 'bg-accent/10 text-accent',
  meeting: 'bg-success/10 text-success',
  note: 'bg-warning/10 text-warning',
};

interface RecentActivityProps {
  activities?: RecentActivityItem[];
  loading?: boolean;
}

export function RecentActivity({ activities = [], loading = false }: RecentActivityProps) {
  return (
    <Card className="card-shadow h-full rounded-xl border-border/80 animate-inner-card-hover">
      <CardHeader>
        <CardTitle className="font-display">Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {activities.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recent activity.</p>
            ) : (
              activities.map((activity) => {
                const Icon = iconMap[activity.type as keyof typeof iconMap] ?? FileText;
                const colorClass = colorMap[activity.type as keyof typeof colorMap] ?? 'bg-muted text-muted-foreground';
                return (
                  <div key={activity.id} className="flex items-start gap-3">
                    <div className={cn('p-2 rounded-lg shrink-0', colorClass)}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{activity.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {activity.user} • {activity.time}
                        {activity.leadName && ` • ${activity.leadName}`}
                      </p>
                    </div>
                    {activity.leadId && (
                      <Button variant="ghost" size="sm" className="shrink-0 gap-1" asChild>
                        <Link to={`/leads/${activity.leadId}`}>
                          View
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      </Button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
