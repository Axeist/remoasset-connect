import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { safeFormat } from '@/lib/date';
import { Calendar, Check, Loader2 } from 'lucide-react';

interface FollowUpRow {
  id: string;
  lead_id: string;
  scheduled_at: string;
  reminder_type: string;
  notes: string | null;
  is_completed: boolean;
  created_at: string;
  lead?: { company_name: string } | null;
}

export default function FollowUps() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [followUps, setFollowUps] = useState<FollowUpRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'upcoming' | 'past' | 'all'>('upcoming');

  const fetchFollowUps = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('follow_ups')
      .select(`
        id,
        lead_id,
        scheduled_at,
        reminder_type,
        notes,
        is_completed,
        created_at,
        lead:leads(company_name)
      `)
      .eq('user_id', user.id)
      .order('scheduled_at', { ascending: true });
    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
      setLoading(false);
      return;
    }
    setFollowUps((data as FollowUpRow[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    if (user) fetchFollowUps();
  }, [user?.id]);

  const markDone = async (id: string) => {
    const { error } = await supabase.from('follow_ups').update({ is_completed: true }).eq('id', id);
    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
      return;
    }
    toast({ title: 'Marked as done' });
    setFollowUps((prev) => prev.map((f) => (f.id === id ? { ...f, is_completed: true } : f)));
  };

  const now = new Date().toISOString();
  const upcoming = followUps.filter((f) => !f.is_completed && f.scheduled_at >= now);
  const past = followUps.filter((f) => f.is_completed || f.scheduled_at < now);
  const displayed =
    filter === 'upcoming' ? upcoming : filter === 'past' ? past : followUps;

  return (
    <AppLayout>
      <div className="space-y-8">
        <div className="animate-fade-in-up flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground tracking-tight">Follow-ups</h1>
            <p className="text-muted-foreground mt-1.5">Your scheduled lead follow-ups</p>
          </div>
          <div className="flex gap-2">
            {(['upcoming', 'past', 'all'] as const).map((f) => (
              <Button
                key={f}
                variant={filter === f ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter(f)}
              >
                {f === 'upcoming' && `Upcoming (${upcoming.length})`}
                {f === 'past' && `Past (${past.length})`}
                {f === 'all' && 'All'}
              </Button>
            ))}
          </div>
        </div>

        <Card className="card-shadow rounded-xl border-border/80 animate-inner-card-hover">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display">
              <Calendar className="h-5 w-5" />
              {filter === 'upcoming' ? 'Upcoming' : filter === 'past' ? 'Past' : 'All'} follow-ups
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-48 w-full" />
            ) : displayed.length === 0 ? (
              <p className="text-muted-foreground text-sm py-8 text-center">
                {filter === 'upcoming' ? 'No upcoming follow-ups.' : filter === 'past' ? 'No past follow-ups.' : 'No follow-ups yet. Schedule one from a lead’s Follow-ups tab.'}
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {displayed.map((f) => (
                  <li
                    key={f.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => navigate(`/leads/${f.lead_id}`)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/leads/${f.lead_id}`); } }}
                    className="py-4 first:pt-0 flex flex-wrap items-center justify-between gap-2 cursor-pointer hover:bg-muted/50 -mx-2 px-2 rounded-lg transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-primary">
                        {f.lead?.company_name ?? 'Unknown lead'}
                      </p>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {safeFormat(f.scheduled_at, 'PPp')}
                        {f.notes && ` · ${f.notes}`}
                      </p>
                      <div className="flex gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">
                          {f.reminder_type}
                        </Badge>
                        {f.is_completed && (
                          <Badge variant="secondary" className="text-xs gap-1">
                            <Check className="h-3 w-3" />
                            Done
                          </Badge>
                        )}
                      </div>
                    </div>
                    {!f.is_completed && (
                      <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); markDone(f.id); }}>
                        Mark done
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
