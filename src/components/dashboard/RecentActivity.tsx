import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Phone, Mail, Calendar, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

const activities = [
  { 
    id: 1, 
    type: 'call', 
    description: 'Called TechCorp Inc.',
    user: 'John Doe',
    time: '10 min ago'
  },
  { 
    id: 2, 
    type: 'email', 
    description: 'Sent proposal to DataFlow',
    user: 'Jane Smith',
    time: '25 min ago'
  },
  { 
    id: 3, 
    type: 'meeting', 
    description: 'Demo with Global Systems',
    user: 'Mike Wilson',
    time: '1 hour ago'
  },
  { 
    id: 4, 
    type: 'note', 
    description: 'Updated lead score for Acme Corp',
    user: 'Sarah Brown',
    time: '2 hours ago'
  },
  { 
    id: 5, 
    type: 'call', 
    description: 'Follow-up call with CloudNet',
    user: 'John Doe',
    time: '3 hours ago'
  },
];

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

export function RecentActivity() {
  return (
    <Card className="card-shadow h-full">
      <CardHeader>
        <CardTitle className="font-display">Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {activities.map((activity) => {
            const Icon = iconMap[activity.type as keyof typeof iconMap];
            const colorClass = colorMap[activity.type as keyof typeof colorMap];
            
            return (
              <div key={activity.id} className="flex items-start gap-3">
                <div className={cn("p-2 rounded-lg", colorClass)}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{activity.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {activity.user} • {activity.time}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
